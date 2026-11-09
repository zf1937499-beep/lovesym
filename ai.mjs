/**
 * AI 模块（仅服务端）
 * ------------------------------------------------------------
 * 供应商：小米 MiMo（OpenAI 兼容接口）
 * Key 只存在这个文件里，永远不会返回给浏览器。
 *
 * 导出：
 *   aiComplete(system, user, opts)      纯文本补全
 *   aiJSON(system, user, opts)          要求 JSON 的补全（容错解析）
 *   aiUsage()                           当日用量
 *   AI_KINDS                            允许的功能白名单
 */

import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- 写死的供应商配置 ---------------- */
const MIMO_API_KEY = "sk-ckfgkgh9tsyyraql8rtc6vvzmxik4120y65bvlbo7kmdhyoq";
const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
const MIMO_MODEL = "mimo-v2.6-flash";

/* ---------------- 额度控制 ---------------- */
const DAILY_TOTAL = 40; // 全站每天最多 40 次
const DAILY_BY_KIND = { polish: 15, date: 8, diary: 10, quiz: 5, monthly: 6 };

const USAGE_FILE = path.join(__dirname, "data", "ai-usage.json");

export const AI_KINDS = Object.keys(DAILY_BY_KIND);

const client = new OpenAI({
  apiKey: MIMO_API_KEY,
  baseURL: MIMO_BASE_URL,
  timeout: 30000,
  maxRetries: 1,
});

/* ---------------- 用量持久化 ---------------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readUsage() {
  try {
    const raw = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
    if (raw.date === todayKey()) return raw;
  } catch (e) {
    /* 首次或损坏，重建 */
  }
  return { date: todayKey(), total: 0, byKind: {} };
}

function writeUsage(usage) {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), "utf8");
  } catch (e) {
    console.error("[ai] 用量写入失败", e.message);
  }
}

export function aiUsage() {
  const u = readUsage();
  return {
    date: u.date,
    total: u.total,
    limit: DAILY_TOTAL,
    byKind: u.byKind,
    kinds: DAILY_BY_KIND,
  };
}

/** 扣额度：超了返回 false，不发起请求 */
export function takeQuota(kind) {
  const usage = readUsage();
  const cap = DAILY_BY_KIND[kind] ?? 0;
  if (!cap) return { ok: false, reason: "BAD_KIND" };
  if (usage.total >= DAILY_TOTAL) return { ok: false, reason: "LIMIT_DAY" };
  if ((usage.byKind[kind] || 0) >= cap) return { ok: false, reason: "LIMIT_KIND" };

  usage.total += 1;
  usage.byKind[kind] = (usage.byKind[kind] || 0) + 1;
  writeUsage(usage);
  return { ok: true };
}

/* ---------------- 输出清洗 ---------------- */
export function sanitize(text, max = 2000) {
  let out = String(text || "");

  // 去掉 ```json / ``` 围栏
  out = out.replace(/^\s*```[a-z]*\s*/i, "").replace(/\s*```\s*$/i, "");
  // 去掉常见的"好的，这是……"开场
  out = out.replace(/^(好的|当然|没问题)[，,。:：\s]*/, "");
  // 压缩多余空行
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  if (out.length > max) out = out.slice(0, max).trim();

  return out;
}

/* ---------------- 调用 ---------------- */
function wrapUpstreamError(err) {
  const status = err && err.status;

  const friendly =
    status === 401
      ? "AI 密钥无效，检查一下服务端配置"
      : status === 402
      ? "AI 账户余额不足，充值后就能用了"
      : status === 403
      ? "AI 密钥没有访问这个模型的权限"
      : status === 429
      ? "AI 调用太频繁，等一会儿再试"
      : status >= 500
      ? "AI 服务暂时不稳定"
      : "AI 暂时没空";

  const wrapped = new Error(`UPSTREAM_${status || "ERR"}`);
  wrapped.status = 502;
  wrapped.publicMessage = friendly;
  wrapped.upstream = (err && err.message) || "";
  return wrapped;
}

export async function aiComplete(systemPrompt, userMessage, options = {}) {
  let res;
  try {
    res = await client.chat.completions.create({
      model: options.model || MIMO_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(userMessage || "") },
      ],
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 700,
    });
  } catch (err) {
    throw wrapUpstreamError(err);
  }

  const content = res?.choices?.[0]?.message?.content;
  if (!content) {
    const empty = new Error("EMPTY_COMPLETION");
    empty.status = 502;
    empty.publicMessage = "AI 这次没说话，再试一次";
    throw empty;
  }

  return sanitize(content, options.maxChars ?? 2000);
}

/** 容错解析 JSON：模型偶尔会加解释，这里只截取最外层的 {...} / [...] */
export function parseLooseJSON(text) {
  const raw = String(text || "")
    .replace(/^\s*```[a-z]*\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const first = raw.search(/[[{]/);
  if (first < 0) return null;

  const lastBrace = raw.lastIndexOf("}");
  const lastBracket = raw.lastIndexOf("]");
  const last = Math.max(lastBrace, lastBracket);
  if (last <= first) return null;

  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch (e) {
    return null;
  }
}

export async function aiJSON(systemPrompt, userMessage, options = {}) {
  const text = await aiComplete(systemPrompt, userMessage, {
    temperature: 0.85,
    maxTokens: options.maxTokens ?? 900,
    maxChars: options.maxChars ?? 4000,
  });
  return { text, data: parseLooseJSON(text) };
}
