/**
 * 五个 AI 功能的提示词与结果整形（仅服务端）
 * 原则：AI 只做表达辅助，不替用户判断关系、不自动保存任何内容。
 */

import { aiComplete, aiJSON, sanitize } from "./ai.mjs";

function httpError(code, message, status = 400) {
  const err = new Error(code);
  err.status = status;
  err.publicMessage = message;
  return err;
}

const TONES = {
  温柔: "语气温柔，像在轻声说话，多用短句，避免感叹号。",
  俏皮: "语气俏皮，可以有一点可爱的比喻和轻微的调侃，但不要油腻。",
  真诚: "语气真诚克制，不修饰情绪，像认真把话说完。",
};

/* =========================================================
   1. AI 润色悄悄话
   ========================================================= */
const POLISH_SYSTEM = `你是中文写作助手，只做语言润色，不参与内容创作。

硬性规则：
1. 只能调整措辞、语序、节奏，不得改变原意，不得增加或删减事实。
2. 不评判这段关系，不给建议，不说教，不写鼓励式套话。
3. 保持第一人称和原本的口语感，不要变成作文腔。
4. 三个版本要有明显差异（用词、节奏、句长不同），但都忠于原文。
5. 只输出 JSON，不要任何解释文字。

输出格式：
{"versions": ["版本1", "版本2", "版本3"]}`;

export async function runPolish(input = {}) {
  const draft = String(input.text || "").trim();
  const tone = TONES[input.tone] ? input.tone : "温柔";

  if (draft.length < 6) throw httpError("TOO_SHORT", "先多写几句，AI 才有东西可润色");
  if (draft.length > 800) throw httpError("TOO_LONG", "太长了，先删到 800 字以内");

  const { data, text: raw } = await aiJSON(
    POLISH_SYSTEM,
    `语气要求：${TONES[tone]}\n\n原文：\n${draft}`,
    { maxTokens: 900, maxChars: 3000 }
  );

  let versions = [];
  if (Array.isArray(data?.versions)) versions = data.versions;
  else if (Array.isArray(data)) versions = data;

  // 模型没按 JSON 输出时，按编号/换行兜底切分
  if (!versions.length && raw) {
    versions = raw
      .split(/\n{2,}|(?=\n?\s*(?:版本|方案)?\s*[123][.、:：])/)
      .map((s) => s.replace(/^\s*(?:版本|方案)?\s*[123][.、:：]?\s*/, "").trim())
      .filter(Boolean);
  }

  versions = versions
    .map((v) => sanitize(String(v), 500))
    .filter((v) => v && v !== draft)
    .slice(0, 3);

  if (!versions.length) throw httpError("BAD_OUTPUT", "AI 这次没给出可用版本，再试一次", 502);

  return { versions, tone };
}

/* =========================================================
   2. AI 约会策划
   ========================================================= */
const DATE_SYSTEM = `你是本地生活策划助手，为两个人设计半日（4~5 小时）约会行程。

硬性规则：
1. 输出 3~4 个节点，按时间顺序排列，必须包含时间点。
2. 每个节点要具体到「做什么、在哪类地方、人均大概花多少钱」，禁止「感受当地氛围」这类空话。
3. 考虑走路距离和交通衔接，不要让人来回奔波。
4. 不写鸡汤、不写祝福、不解释恋爱的意义、不使用夸张修辞。
5. 只输出 JSON，不要解释。

城市是中国的县级市/区，请给出该地真实存在的地点类型（不要编造具体店名）。
输出格式：
{"title": "一句话行程名",
 "nodes": [{"time": "14:00", "title": "做什么", "detail": "具体安排", "cost": "人均约 xx 元"}]}`;

export async function runDatePlan(input = {}) {
  const city = String(input.city || "").trim().slice(0, 20) || "寿光";
  const budget = Math.max(0, Math.min(3000, Number(input.budget) || 200));
  const tags = Array.isArray(input.tags) ? input.tags.filter(Boolean).slice(0, 5) : [];

  const { data } = await aiJSON(
    DATE_SYSTEM,
    `城市：${city}\n人均预算：${budget} 元\n偏好：${tags.length ? tags.join("、") : "没有特别偏好"}`,
    { maxTokens: 1000, maxChars: 4000 }
  );

  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  if (!nodes.length) throw httpError("BAD_OUTPUT", "这次没生成出行程，换个偏好再试试", 502);

  return {
    title: sanitize(data.title || `${city}半日约会`, 40),
    city,
    budget,
    nodes: nodes.slice(0, 4).map((n, i) => ({
      time: sanitize(n.time || `${14 + i}:00`, 10),
      title: sanitize(n.title || "安排", 30),
      detail: sanitize(n.detail || "", 120),
      cost: sanitize(n.cost || "", 20),
    })),
  };
}

/* =========================================================
   3. AI 日记代笔（辅助模式）
   ========================================================= */
const DIARY_SYSTEM = `你在帮一对情侣起草一段共同日记。

硬性规则：
1. 100~200 个汉字，不分段或最多两段。
2. 只写输入里真实提供的信息（天气、打卡、照片备注），不虚构情节、不加对话、不编造细节。
3. 用「我们」的口吻，语气温暖但克制，不要抒情过度，不要祝福语，不要总结人生。
4. 不加标题，不写「今天真是美好的一天」这类空话。
5. 只输出正文。`;

export async function runDiaryDraft(input = {}) {
  const weather = String(input.weather || "").slice(0, 120);
  const checkin = String(input.checkin || "").slice(0, 160);
  const photo = String(input.photo || "").slice(0, 120);

  if (!weather && !checkin && !photo) {
    throw httpError("NO_INPUT", "今天还没有可以写的素材，先去打个卡吧");
  }

  const text = await aiComplete(
    DIARY_SYSTEM,
    `今天的天气：${weather || "没有记录"}\n今天一起做的事：${checkin || "没有记录"}\n最近一张照片：${photo || "没有记录"}`,
    { maxTokens: 400, maxChars: 400, temperature: 0.75 }
  );

  // 兜底截断：超过 260 字就切到最后一个句号
  let draft = text.replace(/\s+/g, " ").trim();
  if (draft.length > 260) {
    const cut = draft.slice(0, 240);
    const lastStop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("，"), cut.lastIndexOf("；"));
    draft = (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut) + "…";
  }

  return { draft };
}

/* =========================================================
   4. AI 默契问答出题
   ========================================================= */
const QUIZ_SYSTEM = `你在为两个人设计默契问答题。

硬性规则：
1. 每题 4 个选项，选项互斥、都合理、长度接近（不超过 12 个字）。
2. 题目贴近日常生活场景，有画面感，能看出两个人的偏好差异。
3. 不涉及隐私、不涉及敏感话题、不试探感情深浅。
4. 每题附一句「为什么问这个」，20 字以内，客观描述考察点。
5. 只输出 JSON。

输出格式：
{"questions": [{"q": "问题", "options": ["A", "B", "C", "D"], "reason": "为什么问这个"}]}`;

export async function runQuiz(input = {}) {
  const names = Array.isArray(input.nicknames) ? input.nicknames.filter(Boolean).slice(0, 2) : [];
  const keywords = Array.isArray(input.keywords) ? input.keywords.filter(Boolean).slice(0, 6) : [];

  const { data } = await aiJSON(
    QUIZ_SYSTEM,
    `两个人的称呼：${names.join(" 和 ") || "我们"}\n最近关注的关键词：${keywords.join("、") || "日常"}\n请出 5 道题。`,
    { maxTokens: 1200, maxChars: 4000 }
  );

  const list = Array.isArray(data?.questions) ? data.questions : [];
  const questions = list
    .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, 5)
    .map((q) => ({
      q: sanitize(q.q, 60),
      options: q.options.slice(0, 4).map((o) => sanitize(o, 16)),
      reason: sanitize(q.reason || "", 30),
    }));

  if (!questions.length) throw httpError("BAD_OUTPUT", "这次没出成题，再试一次", 502);

  return { questions };
}

/* =========================================================
   5. AI 月度总结
   ========================================================= */
const MONTHLY_SYSTEM = `你在为两个人的月度记录写一段小结。

硬性规则：
1. 约 150 字，最多 180 字。
2. 必须引用输入里的具体数字，不要编造数据。
3. 语气温暖克制，像自言自语，不像年终总结。
4. 不写祝福语，不写「继续加油」「未来可期」这类套话，不做情感评价。
5. 只输出正文，不分点，不加标题。`;

export async function runMonthly(input = {}) {
  const month = String(input.month || "").slice(0, 20);
  const s = input.stats || {};

  const parts = [
    `月份：${month || "这个月"}`,
    `照片 ${Number(s.photos) || 0} 张`,
    `日记 ${Number(s.diaries) || 0} 篇`,
    `日记总字数 ${Number(s.words) || 0}`,
    `打卡 ${Number(s.checkinDays) || 0} 天`,
    `完成愿望 ${Number(s.wishes) || 0} 个`,
    `发出券 ${Number(s.coupons) || 0} 张`,
  ];

  const text = await aiComplete(MONTHLY_SYSTEM, parts.join("\n"), {
    maxTokens: 400,
    maxChars: 400,
    temperature: 0.8,
  });

  let summary = text.replace(/\s+/g, " ").trim();
  if (summary.length > 220) summary = summary.slice(0, 200) + "…";

  return { summary };
}
