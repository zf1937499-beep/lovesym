/**
 * 瀚海遇伊梦 · 后端服务（零依赖）
 * ------------------------------------------------------------
 * 能力：
 *   1. 静态站点托管
 *   2. /api/state   两人共享数据的读写（带版本号，防覆盖）
 *   3. /api/upload  图片落盘，返回 URL（不再把 base64 塞进 JSON）
 *   4. /api/weather 和风天气代理（Key 只在服务端）
 *
 * 数据目录：./data          db.json + uploads/
 * 启动：    node server.mjs   （PORT=8080 可改端口）
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { aiUsage, takeQuota } from "./ai.mjs";
import { runPolish, runDatePlan, runDiaryDraft, runQuiz, runMonthly } from "./ai-features.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "0.0.0.0";

/* ============================ 和风天气配置 ============================ */
const QWEATHER_API_KEY = "00900ecc72ca41018cc722f285cc522b";
const QWEATHER_API_HOST = "pn3bygxrwa.re.qweatherapi.com";
const BASE_URL = `https://${QWEATHER_API_HOST}`;
const WEATHER_TTL = 30 * 60 * 1000;

const CITIES = [
  { key: "hanhan", nick: "瀚瀚", name: "山东潍坊·寿光", short: "寿光", lat: 36.86, lon: 118.79 },
  { key: "yimeng", nick: "伊梦", name: "浙江台州·临海", short: "临海", lat: 28.85, lon: 121.14 },
];

const ICON_MAP = {
  100: "☀️", 150: "🌙",
  101: "⛅", 102: "⛅", 103: "⛅", 104: "☁️", 151: "☁️", 152: "☁️", 153: "☁️",
  300: "🌦️", 301: "⛈️", 302: "⛈️", 303: "⛈️", 304: "⛈️",
  305: "🌧️", 306: "🌧️", 307: "🌧️", 308: "🌧️", 309: "🌦️",
  310: "🌧️", 311: "🌧️", 312: "🌧️", 313: "🌧️", 314: "🌧️",
  315: "🌧️", 316: "🌧️", 317: "🌧️", 318: "🌧️", 399: "🌧️",
  400: "🌨️", 401: "🌨️", 402: "❄️", 403: "❄️", 404: "🌨️",
  405: "🌨️", 406: "🌨️", 407: "🌨️", 408: "🌨️", 409: "❄️", 410: "❄️", 499: "❄️",
  500: "🌫️", 501: "🌫️", 502: "🌫️", 503: "🌪️", 504: "🌫️",
  507: "🌪️", 508: "🌪️", 509: "🌫️", 510: "🌫️", 511: "🌫️",
  512: "🌫️", 513: "🌫️", 514: "🌫️", 515: "🌫️",
  900: "🔥", 901: "🥶", 999: "🌈",
};

function weatherEmoji(code) {
  if (ICON_MAP[code]) return ICON_MAP[code];
  const n = Number(code);
  if (n >= 300 && n < 400) return "🌧️";
  if (n >= 400 && n < 500) return "🌨️";
  if (n >= 500 && n < 600) return "🌫️";
  return "🌈";
}

const weatherCache = new Map();

async function qweatherGet(pathname, params) {
  const search = params ? `?${new URLSearchParams(params).toString()}` : "";
  const url = `${BASE_URL}${pathname}${search}`;

  const hit = weatherCache.get(url);
  if (hit && Date.now() - hit.at < WEATHER_TTL) return hit.data;

  const res = await fetch(url, {
    headers: { "X-QW-Api-Key": QWEATHER_API_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`QWeather ${pathname} -> ${res.status}`);

  const data = await res.json();
  weatherCache.set(url, { at: Date.now(), data });
  return data;
}

const okVal = (r) => (r.status === "fulfilled" ? r.value : null);

async function getWeatherBundle(city) {
  const loc = `${city.lon},${city.lat}`;      // 实时天气：经度,纬度
  const latLon = `${city.lat}/${city.lon}`;   // 空气 / 预警：纬度/经度

  const [nowRes, airRes, alertRes, indicesRes, minutelyRes] = await Promise.allSettled([
    qweatherGet("/v7/weather/now", { location: loc }),
    qweatherGet(`/airquality/v1/current/${latLon}`),
    qweatherGet(`/weatheralert/v1/current/${latLon}`),
    qweatherGet("/v7/indices/1d", { type: "3", location: loc }),
    qweatherGet("/v7/minutely/5m", { location: loc }),
  ]);

  const nowData = okVal(nowRes);
  const now = nowData?.now
    ? {
        temp: Number(nowData.now.temp),
        feelsLike: Number(nowData.now.feelsLike),
        text: nowData.now.text,
        icon: String(nowData.now.icon),
        emoji: weatherEmoji(String(nowData.now.icon)),
        humidity: Number(nowData.now.humidity),
        windDir: nowData.now.windDir,
        windScale: nowData.now.windScale,
        obsTime: nowData.now.obsTime,
      }
    : null;

  const airData = okVal(airRes);
  const airIndex = airData?.indexes?.find((i) => i.code === "cn-mee") ?? airData?.indexes?.[0] ?? null;
  const air = airIndex ? { aqi: Number(airIndex.aqi ?? 0), category: airIndex.category ?? "" } : null;

  const firstAlert = okVal(alertRes)?.alerts?.[0] ?? null;
  const alert = firstAlert
    ? { headline: firstAlert.headline ?? firstAlert.eventType?.name ?? "天气预警", severity: firstAlert.severity ?? "" }
    : null;

  const dressItem = okVal(indicesRes)?.daily?.[0] ?? null;
  const dress = dressItem ? { category: dressItem.category ?? "", text: dressItem.text ?? "" } : null;

  const rainSoon = Boolean(okVal(minutelyRes)?.minutely?.slice(0, 24).some((m) => Number(m.precip ?? 0) > 0));

  return {
    key: city.key,
    nick: city.nick,
    name: city.name,
    short: city.short,
    lat: city.lat,
    lon: city.lon,
    ok: Boolean(now),
    now,
    air,
    alert,
    dress,
    rainSoon,
  };
}

function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h))) / 10) * 10;
}

/* ============================ 数据存储 ============================ */
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

const db = {
  rev: 0,
  updatedAt: null,
  data: null, // 首次为空，由客户端把本地数据推送上来
};

let dirty = false;
let flushTimer = null;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    db.rev = Number(parsed.rev) || 0;
    db.updatedAt = parsed.updatedAt || null;
    db.data = parsed.data ?? null;
  } catch (err) {
    if (err.code !== "ENOENT") console.error("[db] 读取失败，将从空数据开始：", err.message);
  }
}

async function flushDB() {
  if (!dirty) return;
  dirty = false;
  const tmp = `${DB_FILE}.tmp`;
  const payload = JSON.stringify({ rev: db.rev, updatedAt: db.updatedAt, data: db.data });
  await fsp.writeFile(tmp, payload, "utf8");
  await fsp.rename(tmp, DB_FILE); // 原子替换，避免写一半断电
}

function scheduleFlush() {
  dirty = true;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushDB().catch((e) => console.error("[db] 写入失败：", e.message));
  }, 300);
}

loadDB();

/* ============================ 工具 ============================ */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

function sendJSON(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(root, normalized);
  return full.startsWith(root) ? full : null;
}

/* ============================ 路由 ============================ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  try {
    /* ---------- 跨域预检 ---------- */
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      });
      res.end();
      return;
    }

    /* ---------- 健康检查 ---------- */
    if (pathname === "/api/health") {
      sendJSON(res, 200, {
        ok: true,
        rev: db.rev,
        updatedAt: db.updatedAt,
        uptime: Math.round(process.uptime()),
      });
      return;
    }

    /* ---------- 数据读写 ---------- */
    if (pathname === "/api/state") {
      if (req.method === "GET") {
        sendJSON(res, 200, { rev: db.rev, updatedAt: db.updatedAt, data: db.data });
        return;
      }

      if (req.method === "PUT") {
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw.toString("utf8"));
        } catch {
          sendJSON(res, 400, { error: "BAD_JSON" });
          return;
        }

        if (!body || typeof body.data !== "object" || body.data === null) {
          sendJSON(res, 400, { error: "BAD_PAYLOAD" });
          return;
        }

        const clientRev = Number(body.rev) || 0;
        // 版本不一致：说明对方刚改过，让客户端先拉最新
        if (db.data !== null && clientRev !== db.rev) {
          sendJSON(res, 409, { error: "REV_CONFLICT", rev: db.rev, updatedAt: db.updatedAt, data: db.data });
          return;
        }

        db.data = body.data;
        db.rev += 1;
        db.updatedAt = new Date().toISOString();
        scheduleFlush();

        sendJSON(res, 200, { rev: db.rev, updatedAt: db.updatedAt });
        return;
      }

      res.writeHead(405, { Allow: "GET, PUT" }).end();
      return;
    }

    /* ---------- 图片上传 ---------- */
    if (pathname === "/api/upload" && req.method === "POST") {
      const ext = (url.searchParams.get("ext") || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
        sendJSON(res, 400, { error: "BAD_EXT" });
        return;
      }

      const buf = await readBody(req, 8 * 1024 * 1024);
      if (!buf.length) {
        sendJSON(res, 400, { error: "EMPTY_BODY" });
        return;
      }

      const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
      await fsp.writeFile(path.join(UPLOAD_DIR, name), buf);
      sendJSON(res, 200, { url: `/uploads/${name}`, size: buf.length });
      return;
    }

    /* ---------- AI ---------- */
    if (pathname === "/api/ai/usage" && req.method === "GET") {
      sendJSON(res, 200, aiUsage(), { "Access-Control-Allow-Origin": "*" });
      return;
    }

    const aiMatch = pathname.match(/^\/api\/ai\/([a-z]+)$/);
    if (aiMatch && req.method === "POST") {
      const kind = aiMatch[1];
      const handlers = {
        polish: runPolish,
        date: runDatePlan,
        diary: runDiaryDraft,
        quiz: runQuiz,
        monthly: runMonthly,
      };

      if (!handlers[kind]) {
        sendJSON(res, 404, { ok: false, error: "UNKNOWN_KIND" });
        return;
      }

      // 先扣额度，再调用：失败也算一次，避免反复刷
      const quota = takeQuota(kind);
      if (!quota.ok) {
        sendJSON(
          res,
          429,
          {
            ok: false,
            error: quota.reason,
            message:
              quota.reason === "LIMIT_DAY"
                ? "今天的 AI 额度用完了，明天再来吧"
                : "这个功能的 AI 额度用完了，换一个试试",
          },
          { "Access-Control-Allow-Origin": "*" }
        );
        return;
      }

      let payload = {};
      try {
        const raw = await readBody(req, 64 * 1024);
        payload = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      } catch (e) {
        sendJSON(res, 400, { ok: false, error: "BAD_JSON" });
        return;
      }

      try {
        const data = await handlers[kind](payload);
        sendJSON(res, 200, { ok: true, data, used: aiUsage().total }, { "Access-Control-Allow-Origin": "*" });
      } catch (err) {
        console.error("[ai]", kind, err.message, err.upstream ? "| " + err.upstream : "");
        sendJSON(
          res,
          err.status || 502,
          {
            ok: false,
            error: err.message || "UPSTREAM",
            message: err.publicMessage || "AI 暂时没空，先按原来的方式写吧",
          },
          { "Access-Control-Allow-Origin": "*" }
        );
      }
      return;
    }

    /* ---------- 天气 ---------- */
    if (pathname === "/api/weather") {
      try {
        const cities = await Promise.all(CITIES.map(getWeatherBundle));
        const [a, b] = cities;
        const sameCity = Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

        sendJSON(
          res,
          200,
          { cities, sameCity, distanceKm: distanceKm(CITIES[0], CITIES[1]), fetchedAt: new Date().toISOString() },
          {
            "Cache-Control": "public, max-age=1800, stale-while-revalidate=300",
            // 允许本地其它端口（比如编辑器预览）读天气，Key 依然只在服务端
            "Access-Control-Allow-Origin": "*",
          }
        );
      } catch {
        sendJSON(
          res,
          200,
          {
            cities: CITIES.map((c) => ({
              ...c, ok: false, now: null, air: null, alert: null, dress: null, rainSoon: false,
            })),
            sameCity: false,
            fetchedAt: new Date().toISOString(),
            error: "unavailable",
          },
          { "Access-Control-Allow-Origin": "*" }
        );
      }
      return;
    }

    /* ---------- 上传的图片 ---------- */
    if (pathname.startsWith("/uploads/")) {
      const filePath = safeJoin(UPLOAD_DIR, pathname.slice("/uploads/".length));
      if (!filePath) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const data = await fsp.readFile(filePath).catch(() => null);
      if (!data) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.end(data);
      return;
    }

    /* ---------- 静态站点 ---------- */
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }

    let rel = pathname === "/" ? "/index.html" : pathname;

    // 目录式访问：/diary → /diary.html
    if (!path.extname(rel)) {
      const asHtml = `${rel}.html`;
      if (fs.existsSync(path.join(__dirname, asHtml))) rel = asHtml;
    }

    const filePath = safeJoin(__dirname, rel);
    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const data = await fsp.readFile(filePath).catch(() => null);
    if (!data) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<meta charset="utf-8"><div style="font:16px/1.8 -apple-system;padding:80px;text-align:center;color:#86606e">
        这个页面不存在 · <a href="/" style="color:#ef4d88">回首页</a></div>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
    });
    res.end(data);
  } catch (err) {
    if (err.message === "PAYLOAD_TOO_LARGE") {
      sendJSON(res, 413, { error: "TOO_LARGE" });
      return;
    }
    console.error("[server]", err);
    sendJSON(res, 500, { error: "INTERNAL" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  💗 瀚海遇伊梦`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → 数据目录 ${DATA_DIR}`);
  console.log(`  → 接口 /api/weather · /api/state · /api/upload\n`);
});

/* 退出前把没写完的数据落盘 */
async function shutdown(signal) {
  console.log(`\n[server] 收到 ${signal}，保存数据后退出…`);
  clearTimeout(flushTimer);
  await flushDB().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
