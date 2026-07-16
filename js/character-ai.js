import { friends } from "./data.js";
import {
  state,
  saveCharacterAccountSettings
} from "./state.js";

function getCharacterKey(character) {
  return String(
    character.characterId ||
    character.code ||
    character.name ||
    ""
  );
}

function getCharacterSettings(character) {
  const key = getCharacterKey(character);
  return state.characterAccountSettings?.[key] || {};
}

function getActiveTimeline(character) {
  const settings = getCharacterSettings(character);
  const timelines = Array.isArray(character.timelines) ? character.timelines : [];

  const timelineId =
    settings.timelineId ||
    character.defaultTimelineId ||
    timelines[0]?.id ||
    "";

  return timelines.find((item) => item.id === timelineId) || timelines[0] || null;
}

function getEnabledCharacters() {
  return friends
    .filter((item) => item.accountKind === "character_account")
    .filter((item) => getCharacterSettings(item).enabled === true)
    .map((item) => {
      const timeline = getActiveTimeline(item);
      const settings = getCharacterSettings(item);

      return {
        characterId: getCharacterKey(item),
        name: item.name,
        forumId: timeline?.forumId || item.forumId || item.name,
        code: timeline?.code || item.code || "",
        codeKind: timeline?.codeKind || item.codeKind || "",
        bloodRank: timeline?.bloodRank || item.bloodRank || "",
        timelineName: timeline?.name || "",
        signature: timeline?.signature || item.signature || "",
        desc: timeline?.desc || item.desc || "",
        identityGroups: timeline?.identityGroups || item.identityGroups || [],
        userPrompt: settings.userPrompt || "",
        officialPrompt: settings.adminSettings?.prompt || ""
      };
    });
}

function getEnabledWorldBookText() {
  const settings = state.forumAiSettings || {};
  const books = Array.isArray(settings.worldBooks) ? settings.worldBooks : [];
  const activeBook = books.find((book) => book.id === settings.activeWorldBookId);

  if (!activeBook) return "";

  const enabledIds = Array.isArray(settings.enabledWorldEntryIds)
    ? settings.enabledWorldEntryIds
    : [];

  const entries = Array.isArray(activeBook.entries) ? activeBook.entries : [];

  return entries
    .filter((entry) => enabledIds.includes(entry.id))
    .map((entry) => {
      return [
        `【${entry.title || "世界书条目"}】`,
        entry.keys?.length ? `关键词：${entry.keys.join(" / ")}` : "",
        entry.content || ""
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function updateCharacterCallStatuses(usedCharacterIds = []) {
  const usedSet = new Set(usedCharacterIds.map((item) => String(item)));

  const nextSettings = {
    ...(state.characterAccountSettings || {})
  };

  friends
    .filter((item) => item.accountKind === "character_account")
    .forEach((character) => {
      const key = getCharacterKey(character);
      const current = nextSettings[key] || {};
      const enabled = current.enabled === true;

      nextSettings[key] = {
        ...current,
        lastCallStatus: enabled && usedSet.has(key) ? "online" : "offline"
      };
    });

  saveCharacterAccountSettings(nextSettings);

  window.dispatchEvent(new CustomEvent("characters:status-changed"));
}

function buildGenerationPrompt({ boardName, boardDesc, contextText = "" }) {

  const forumSettings = state.forumAiSettings || {};
  const enabledCharacters = getEnabledCharacters();
  const worldBookText = getEnabledWorldBookText();

  return `
你正在为“守夜人论坛”生成一篇论坛帖子。

【论坛总提示词】
${forumSettings.forumPrompt || "保持龙族同人论坛风格，像真实论坛用户发帖，不要写成旁白。"}

【当前板块】
【当前板块的发帖规则】
只有身份组符合该板块发帖要求的角色才能发帖。
如果角色不符合要求，不要让这个角色出现在 threads 里。

${boardName || "未知板块"}
${boardDesc || ""}
板块发帖权限由论坛程序检查。

【酒馆上下文】
${contextText || "未读取到酒馆上下文。"}

【已启用剧情角色账号】
${enabledCharacters.length ? enabledCharacters.map((character) => {
  return `
- 角色ID：${character.characterId}
  真名：${character.name}
  论坛ID：${character.forumId}
  当前时间线：${character.timelineName || "默认"}
  身份组：${character.identityGroups.join(" / ")}
  签名：${character.signature}
  档案：${character.desc}
  用户档案说明：${character.userPrompt || "无"}
  官方提示词：${character.officialPrompt || "无"}
`;
}).join("\n") : "当前没有启用剧情角色。"}

【世界书】
${worldBookText || "未挂载世界书。"}

【任务】
请生成一篇论坛帖子草稿。

你可以选择是否调用某些剧情角色账号。
如果正文内容不需要某个角色，就不要调用它。
只有被你实际调用的角色，才写入 usedCharacterIds。

请严格返回 JSON，不要返回多余解释：

{
  "title": "帖子标题",
  "tags": ["标签1", "标签2"],
  "content": "帖子正文",
  "usedCharacterIds": ["被调用的角色ID"]
}

`;
}

function getChatCompletionsUrl(apiBaseUrl) {
  const url = String(apiBaseUrl || "").trim().replace(/\/+$/, "");

  if (!url) return "";

  if (url.endsWith("/chat/completions")) {
    return url;
  }

  if (url.endsWith("/v1")) {
    return `${url}/chat/completions`;
  }

  return url;
}

function extractJson(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // 继续尝试从一整段回复里截出 JSON
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI 没有返回 JSON。");
  }

  return JSON.parse(match[0]);
}

export async function generateForumThreadDraft({ boardName, boardDesc, contextText = "" }) {

  const settings = state.forumAiSettings || {};

  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
    throw new Error("请先在“论坛基础”里填写 API 地址、API Key 和模型。");
  }

  const prompt = buildGenerationPrompt({ boardName, boardDesc, contextText });

  const response = await fetch(getChatCompletionsUrl(settings.apiBaseUrl), {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: "你是守夜人论坛的帖子生成器，只返回合法 JSON。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.85
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "AI 生成失败。");
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";

  const draft = extractJson(text);

  const usedCharacterIds = Array.isArray(draft.usedCharacterIds)
    ? draft.usedCharacterIds
    : [];

  updateCharacterCallStatuses(usedCharacterIds);

    return {
    title: String(draft.title || "").trim(),
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    content: String(draft.content || "").trim(),
    usedCharacterIds
  };

}

export async function generateStorySyncBatch({
  boardSlug = "",
  boardName,
  boardDesc,
  postGroups = [],
  allowAiPost = false,
  contextText = "",
  threadCount = 1,
  commentCount = 3
}) {
  const settings = state.forumAiSettings || {};

  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
    throw new Error("请先在“论坛基础”里填写 API 地址、API Key 和模型。");
  }

  const enabledCharacters = getEnabledCharacters();
  const worldBookText = getEnabledWorldBookText();

  const prompt = `
你正在为“守夜人论坛”的剧情区同步内容。

【论坛总提示词】
${settings.forumPrompt || "保持龙族同人论坛风格，像真实论坛用户发帖和回复，不要写成旁白。"}

【当前板块】
【当前板块设置】
板块标识：${boardSlug}
允许剧情角色发帖：${allowAiPost ? "是" : "否"}
发帖所需身份组：${
  Array.isArray(postGroups) && postGroups.length
    ? postGroups.join(" / ")
    : "无限制"
}

【当前板块的发帖规则】
只有身份组符合该板块发帖要求的角色才能发帖。
如果角色不符合要求，不要让这个角色出现在 threads 里。

${boardName || "未知板块"}
${boardDesc || ""}
板块允许剧情角色发帖：${allowAiPost ? "是" : "否"}

【酒馆上下文】
${contextText || "未读取到酒馆上下文。"}

【本次同步数量】
帖子数：${threadCount}
每帖评论数：${commentCount}

【可调用剧情角色账号】
${enabledCharacters.length ? enabledCharacters.map((character) => {
  return `
- 角色ID：${character.characterId}
  真名：${character.name}
  论坛ID：${character.forumId}
  当前时间线：${character.timelineName || "默认"}
  身份组：${character.identityGroups.join(" / ")}
  签名：${character.signature}
  档案：${character.desc}
  用户档案说明：${character.userPrompt || "无"}
  官方提示词：${character.officialPrompt || "无"}
`;
}).join("\n") : "当前没有启用剧情角色。"}

【世界书】
${worldBookText || "未挂载世界书。"}

【任务】
请根据上下文内容生成剧情区论坛内容。

重要规则：
1. 如果【可调用剧情角色账号】里有角色，每一篇帖子都必须由其中一个剧情角色账号发出。
2. 每一条评论也必须尽量由【可调用剧情角色账号】里的角色发出。
3. characterId 必须完全照抄上方列表里的“角色ID”，不要写中文名，不要自己编。
4. 不要把 characterId 留空，除非当前没有任何可调用剧情角色账号。
5. usedCharacterIds 必须包含本次所有发帖和评论中用到的角色ID。
6. 内容要像论坛真实发帖和回复，不要说自己是生成内容。
7. 评论必须尽量形成真实论坛对话，不要全是平铺各说各话。
8. 每条评论都要填写 replyTo：
   - "post" 表示直接回复楼主正文
   - 数字 1 / 2 / 3 ... 表示回复本帖第几条评论（按 comments 顺序，从 1 开始）
9. 只能回复排在自己前面的评论，不能回复后面的评论。
10. 至少让一部分评论互相回复，像真实论坛楼中楼。
11. 评论正文里绝对不要写“回复3楼”“回复路明非：”这种字。
    引用关系只靠 replyTo 字段表达，正文只写真正要说的话。
12. 绝对不能使用号主玩家账号发言。
13. 所有帖子和评论都必须有 characterId，且只能从【可调用剧情角色账号】里选。
14. 如果某个角色不适合发言，就不要生成这条，不要改用号主。

请严格返回 JSON，不要返回多余解释：

{
  "threads": [
    {
      "characterId": "必须填写上方列表里的角色ID，例如 chu-zihang",
      "title": "帖子标题",
      "tags": ["标签1", "标签2"],
      "content": "帖子正文",

            "comments": [
        {
          "characterId": "必须填写上方列表里的角色ID，例如 lu-mingfei",
          "content": "评论内容",
          "replyTo": "post"
        }
      ]

    }
  ],
  "usedCharacterIds": ["本次实际调用过的角色ID"]
}
`;

  const response = await fetch(getChatCompletionsUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: "你是守夜人论坛的剧情同步器，只返回合法 JSON。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.85
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "剧情同步失败。");
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";

  const result = extractJson(text);

  const usedCharacterIds = Array.isArray(result.usedCharacterIds)
    ? result.usedCharacterIds
    : [];

  updateCharacterCallStatuses(usedCharacterIds);

  return {
    threads: Array.isArray(result.threads) ? result.threads : [],
    usedCharacterIds
  };
}

export async function generateStoryThreadReplies({ boardName, boardDesc, thread, contextText = "" }) {
  const settings = state.forumAiSettings || {};

  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
    throw new Error("请先在“论坛基础”里填写 API 地址、API Key 和模型。");
  }

  const enabledCharacters = getEnabledCharacters();
  const worldBookText = getEnabledWorldBookText();

  const prompt = `
你正在为“守夜人论坛”的剧情区帖子生成角色回复。

【论坛总提示词】
${settings.forumPrompt || "保持龙族同人论坛风格，像真实论坛用户回复，不要写成旁白。"}

【当前板块】
【当前板块的发帖规则】
只有身份组符合该板块发帖要求的角色才能发帖。
如果角色不符合要求，不要让这个角色出现在 threads 里。

${boardName || "未知板块"}
${boardDesc || ""}
板块发帖权限由论坛程序检查。

【酒馆上下文】
${contextText || "未读取到酒馆上下文。"}

【帖子】
标题：${thread?.title || ""}
正文：
${thread?.content || ""}
楼主角色：${thread?.author || thread?.authorForumId || "未知"}

【现有评论（按楼层）】
${
  Array.isArray(thread?.comments) && thread.comments.length
    ? thread.comments.map((comment, index) => {
        return [
          `#${index}`,
          `楼层：${comment.floorNo || index + 1}`,
          `评论ID：${comment.id}`,
          `作者：${comment.author || comment.authorForumId || "未知"}`,
          `内容：${comment.isDeleted ? "该评论已删除" : (comment.text || comment.content || "")}`
        ].join("\n");
      }).join("\n\n")
    : "目前还没有评论。"
}

【可调用剧情角色账号】
${enabledCharacters.length ? enabledCharacters.map((character) => {
  return `
- 角色ID：${character.characterId}
  真名：${character.name}
  论坛ID：${character.forumId}
  当前时间线：${character.timelineName || "默认"}
  身份组：${character.identityGroups.join(" / ")}
  签名：${character.signature}
  档案：${character.desc}
  用户档案说明：${character.userPrompt || "无"}
  官方提示词：${character.officialPrompt || "无"}
`;
}).join("\n") : "当前没有启用剧情角色。"}

【世界书】
${worldBookText || "未挂载世界书。"}

【任务】
请判断哪些剧情角色适合回复这篇帖子。
没有必要回复的角色不要调用。

重要规则：
1. replyTo 只能填：
   - "post"：直接回复楼主正文
   - 数字：回复【现有评论】里的楼层号，例如 1 / 2 / 3
2. 不要只生成“话题接得上”的平铺评论。
3. 如果要接某人的话，必须用 replyTo 指向那条评论。
4. 正文里绝对不要写“回复3楼”“回复某某：”这种字。
5. 内容要像真实论坛回复，可以短一点，可以抬杠、附和、追问。
6. 有现有评论时，尽量让一部分回复挂到某层楼，不要全是 post。
7. 绝对不能使用号主玩家账号。
8. 每条回复都必须有 characterId，且只能从可调用角色列表里选。

请严格返回 JSON，不要返回多余解释：

{
  "replies": [
    {
      "characterId": "角色ID",
      "content": "该角色的论坛回复内容",
      "replyTo": "post"
    }
  ],
  "usedCharacterIds": ["实际调用的角色ID"]
}

`;

  const response = await fetch(getChatCompletionsUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: "你是守夜人论坛的剧情角色回复生成器，只返回合法 JSON。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.85
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "剧情同步失败。");
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";

  const result = extractJson(text);

  const usedCharacterIds = Array.isArray(result.usedCharacterIds)
    ? result.usedCharacterIds
    : [];

  updateCharacterCallStatuses(usedCharacterIds);

  return {
    replies: Array.isArray(result.replies) ? result.replies : [],
    usedCharacterIds
  };
}

export function readTavernContextText() {
  const candidates = [];

  try {
    candidates.push(window.CassellTavernContext);
    candidates.push(window.parent?.CassellTavernContext);
  } catch {
    // 忽略跨页面读取失败
  }

  try {
    candidates.push(localStorage.getItem("cassell_tavern_context"));
    candidates.push(localStorage.getItem("tavern_context"));
    candidates.push(localStorage.getItem("world_info"));
    candidates.push(localStorage.getItem("chat_metadata"));
  } catch {
    // 忽略本地缓存读取失败
  }

  const text = candidates
    .filter(Boolean)
    .map((item) => normalizeContextText(item))
    .filter(Boolean)
    .join("\n\n");

  return limitContextText(text, 12000);
}

function normalizeContextText(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeContextText(parsed);
    } catch {
      return trimmed;
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeContextText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = normalizeContextText(item);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(value || "").trim();
}

function limitContextText(text, maxLength = 12000) {
  const value = String(text || "").trim();

  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(value.length - maxLength);
}
