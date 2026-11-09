/* =========================================================
   瀚海遇伊梦 · 核心
   数据层 / 身份 / 导航 / 弹窗 / Markdown / 工具函数
   ========================================================= */

const HM = (function () {
  const DB_KEY = "hm.db.v2";
  const WHO_KEY = "hm.who";

  /* ---------------- 默认数据 ---------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function shift(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function buildDefault() {
    return {
      version: 2,
      couple: {
        startDate: "2023-05-20T20:00:00",
        me: { name: "瀚瀚", avatar: "" },
        her: { name: "伊梦", avatar: "" },
      },
      anniversaries: [
        { id: uid(), title: "在一起纪念日", date: "2023-05-20", yearly: true, note: "那天我们决定在一起" },
        { id: uid(), title: "伊梦的生日", date: "2000-08-18", yearly: true, note: "记得提前订蛋糕" },
        { id: uid(), title: "第一次一起去看海", date: "2024-05-02", yearly: false, note: "海风很大，你笑得很轻" },
      ],
      albums: [
        { id: uid(), name: "我们的日常", emoji: "🌷", photos: [], createdAt: Date.now() },
        { id: uid(), name: "第一次旅行", emoji: "🏖", photos: [], createdAt: Date.now() },
      ],
      diary: [
        {
          id: uid(),
          title: "关于今天的一点小事",
          content:
            "今天下班的时候下雨了，你发消息让我别淋着。\n\n结果我还是没带伞，站在便利店门口等雨停，**忽然觉得这样也挺好**。\n\n> 有人说喜欢是一瞬间的事，我觉得不是。\n\n是每天重复的、很轻的一点点。",
          mood: "🥰",
          visibility: "shared",
          author: "me",
          unlockAt: "",
          createdAt: Date.now() - 86400000 * 2,
          updatedAt: Date.now() - 86400000 * 2,
        },
        {
          id: uid(),
          title: "写给你的第三封信",
          content:
            "这封先锁起来，等到纪念日那天再给你看。\n\n- 第一件事：谢谢你总是记得我不吃香菜\n- 第二件事：下次想看日出，要一起\n\n（剩下的那天再说）",
          mood: "💌",
          visibility: "shared",
          author: "her",
          unlockAt: shift(3) + "T00:00",
          createdAt: Date.now() - 86400000 * 5,
          updatedAt: Date.now() - 86400000 * 5,
        },
        {
          id: uid(),
          title: "emo 的一天",
          content: "有些话只写给自己看。\n\n明天要早起，早点睡。",
          mood: "🥲",
          visibility: "private",
          author: "me",
          unlockAt: "",
          createdAt: Date.now() - 86400000 * 8,
          updatedAt: Date.now() - 86400000 * 8,
        },
      ],
      wishes: [
        { id: uid(), title: "一起看一次日出", desc: "定个四点的闹钟，去海边或者楼顶都行。", status: "open", claimedBy: "", createdAt: Date.now() - 86400000 * 12 },
        { id: uid(), title: "养一只猫", desc: "橘猫优先，名字已经想好了。", status: "claimed", claimedBy: "me", createdAt: Date.now() - 86400000 * 20 },
        { id: uid(), title: "拍一组情侣写真", desc: "不要那种僵硬的，要笑得很傻的。", status: "open", claimedBy: "", createdAt: Date.now() - 86400000 * 6 },
        { id: uid(), title: "一起做一次蛋糕", desc: "上次翻车了，这次一定行。", status: "done", claimedBy: "her", createdAt: Date.now() - 86400000 * 30 },
      ],
      tasks: [
        { id: "t1", emoji: "🍚", name: "一起吃饭" },
        { id: "t2", emoji: "🚶", name: "散步聊天" },
        { id: "t3", emoji: "💬", name: "说一句我爱你" },
        { id: "t4", emoji: "📞", name: "视频通话" },
        { id: "t5", emoji: "🏃", name: "一起运动" },
        { id: "t6", emoji: "🌙", name: "互道晚安" },
      ],
      checkins: [
        { date: shift(-1), tasks: ["t1", "t3", "t6"], mood: "😊", note: "" },
        { date: shift(-2), tasks: ["t1", "t2", "t4", "t6"], mood: "🥰", note: "" },
        { date: shift(-3), tasks: ["t1", "t6"], mood: "😐", note: "" },
        { date: shift(-5), tasks: ["t1", "t3"], mood: "😊", note: "" },
      ],
      bank: {
        accounts: {
          me: { balance: 30, earned: 30, spent: 0 },
          her: { balance: 55, earned: 85, spent: 30 },
        },
        coupons: [
          {
            id: uid(),
            typeId: "praise",
            title: "夸夸券",
            emoji: "🌸",
            price: 10,
            note: "今天也要好好夸我",
            from: "her",
            to: "me",
            status: "active",
            createdAt: Date.now() - 86400000 * 2,
          },
          {
            id: uid(),
            typeId: "treat",
            title: "请客券",
            emoji: "🍰",
            price: 25,
            note: "想吃什么随便点，我付",
            from: "me",
            to: "her",
            status: "active",
            createdAt: Date.now() - 86400000 * 4,
          },
          {
            id: uid(),
            typeId: "chore",
            title: "家务券",
            emoji: "🧹",
            price: 20,
            note: "",
            from: "her",
            to: "me",
            status: "used",
            createdAt: Date.now() - 86400000 * 9,
            usedAt: Date.now() - 86400000 * 3,
            useNote: "用在了洗碗上，洗得很干净",
          },
        ],
        tx: [
          { id: uid(), account: "me", kind: "adjust", amount: 30, reason: "开卡零花钱", at: Date.now() - 86400000 * 10 },
          { id: uid(), account: "her", kind: "adjust", amount: 30, reason: "开卡零花钱", at: Date.now() - 86400000 * 10 },
        ],
      },
      security: { me: null, her: null },
      memoriesSeen: [],
      quiz: {},
      spins: [],
      badges: {},
      secret: {
        code: "0520",
        date: "",
        title: "给伊梦的惊喜",
        content:
          "写点只有到那天才能看的东西吧。\n\n比如：生日礼物藏在衣柜最上层，别提前翻。\n\n或者：其实那天我已经请好假了，准备带你去海边。",
      },
    };
  }

  /* ---------------- 存储 ---------------- */
  let storageOK = true;

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        const fresh = buildDefault();
        localStorage.setItem(DB_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const data = JSON.parse(raw);
      // 补齐可能缺失的字段
      const base = buildDefault();
      Object.keys(base).forEach((k) => {
        if (data[k] === undefined) data[k] = base[k];
      });
      return data;
    } catch (e) {
      storageOK = false;
      return buildDefault();
    }
  }

  const state = load();

  /* ---------------- 服务端同步（有后端就用后端，没有就退本地） ---------------- */
  const REMOTE = { on: false, rev: 0, timer: null, saving: false, endpoint: "/api/state" };

  /** 从服务端拉一次数据；服务端还没数据时保留本地，等下第一次保存再推上去 */
  async function remoteLoad() {
    if (typeof location === "undefined" || location.protocol === "file:") return false;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(REMOTE.endpoint, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      if (!res.ok) return false;

      const body = await res.json();
      REMOTE.on = true;
      REMOTE.rev = Number(body.rev) || 0;

      if (body.data && typeof body.data === "object") {
        // 原地替换，保持 HM.state 引用不变（各页面缓存的引用依然有效）
        Object.keys(state).forEach((k) => {
          if (!(k in body.data)) delete state[k];
        });
        // 服务端数据可能来自旧版本，缺的字段用默认值补齐
        const base = buildDefault();
        Object.keys(base).forEach((k) => {
          if (body.data[k] === undefined) body.data[k] = base[k];
        });
        Object.assign(state, body.data);
        try {
          localStorage.setItem(DB_KEY, JSON.stringify(state));
        } catch (e) {}
      } else {
        // 服务端还是空的：把本地的初始数据推上去
        queueRemoteSave();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function queueRemoteSave() {
    if (!REMOTE.on) return;
    clearTimeout(REMOTE.timer);
    REMOTE.timer = setTimeout(pushRemote, 500);
  }

  async function pushRemote() {
    if (!REMOTE.on) return;
    if (REMOTE.saving) {
      queueRemoteSave();
      return;
    }

    REMOTE.saving = true;
    try {
      const res = await fetch(REMOTE.endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rev: REMOTE.rev, data: state }),
      });

      if (res.status === 409) {
        const body = await res.json();
        REMOTE.rev = Number(body.rev) || 0;
        if (body.data) Object.assign(state, body.data);
        toast("对方刚更新了内容，正在同步…");
        setTimeout(() => location.reload(), 1000);
        return;
      }

      if (!res.ok) throw new Error("save failed");
      const body = await res.json();
      REMOTE.rev = Number(body.rev) || REMOTE.rev;
    } catch (e) {
      toast("暂时没连上服务器，改动已存在本地");
    } finally {
      REMOTE.saving = false;
    }
  }

  function save() {
    let localOK = true;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(state));
    } catch (e) {
      localOK = false;
    }

    if (REMOTE.on) {
      queueRemoteSave();
      return true;
    }

    if (!localOK) {
      toast("存储空间满了，试试删掉一些照片 🥲");
      return false;
    }
    return true;
  }

  /** dataURL → Blob，用于上传 */
  function dataUrlToBlob(dataUrl) {
    const [meta, b64] = String(dataUrl).split(",");
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /** 图片落盘：有后端就传文件换 URL，没后端就保留 base64 */
  async function uploadImage(dataUrl, filename) {
    if (!REMOTE.on || !String(dataUrl).startsWith("data:")) return dataUrl;

    try {
      const blob = dataUrlToBlob(dataUrl);
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const res = await fetch(`/api/upload?ext=${ext}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!res.ok) throw new Error("upload failed");
      const body = await res.json();
      return body.url;
    } catch (e) {
      // 上传失败就退回 base64，照片不能丢
      return dataUrl;
    }
  }

  /* ---------------- 身份 ---------------- */
  let who = "me";
  try {
    who = localStorage.getItem(WHO_KEY) || "";
  } catch (e) {
    who = "me";
  }

  function setWho(next) {
    who = next;
    try {
      localStorage.setItem(WHO_KEY, next);
    } catch (e) {}
  }

  /* ---------------- 口令 ---------------- */
  const DEFAULT_PASS = "12345678";

  function ensureSecurity() {
    if (!state.security || typeof state.security !== "object") {
      state.security = { me: null, her: null };
    }
    return state.security;
  }

  async function hashPass(pass, salt) {
    const text = salt + "::" + pass;
    try {
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return (
          "sha256:" +
          Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        );
      }
    } catch (e) {
      /* 非安全上下文（file://）会失败，走下面的兜底 */
    }
    // 没有 SubtleCrypto 时的兜底摘要：不是加密强度，但也不会明文存口令
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return "djb2:" + (h >>> 0).toString(16);
  }

  /** 读某天某人记的心情（兼容早期只有单人心情的旧数据） */
  function moodGet(rec, key) {
    if (!rec) return "";
    if (rec.moods && typeof rec.moods === "object") return rec.moods[key] || "";
    if (key === "me") return rec.mood || "";
    return "";
  }

  function moodSet(rec, key, value) {
    if (!rec.moods || typeof rec.moods !== "object") {
      rec.moods = { me: "", her: "" };
      if (rec.mood) rec.moods.me = rec.mood;
      delete rec.mood;
    }
    rec.moods[key] = value;
  }

  /** 校验口令；没设过口令时接受初始口令，并让调用方去落一次哈希 */
  async function checkPass(key, input) {
    const rec = ensureSecurity()[key];
    if (!rec || !rec.hash) return { ok: input === DEFAULT_PASS, init: true };
    return { ok: (await hashPass(input, rec.salt)) === rec.hash, init: false };
  }

  async function setPass(key, pass) {
    const sec = ensureSecurity();
    const salt = uid();
    sec[key] = { salt, hash: await hashPass(pass, salt), at: Date.now() };
    save();
  }

  function persona(key) {
    const p = key === "me" ? state.couple.me : state.couple.her;
    return { key, name: p.name || (key === "me" ? "瀚瀚" : "伊梦"), avatar: p.avatar || "", initial: (p.name || "我").slice(-1) };
  }

  /* ---------------- 日期工具 ---------------- */
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDate(str) {
    if (!str) return null;
    const s = String(str).slice(0, 10).split("-");
    if (s.length !== 3) return null;
    const d = new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  }

  function fmtDate(d, withYear) {
    if (!d) return "";
    const dt = typeof d === "string" ? parseDate(d) : d;
    if (!dt) return "";
    const base = `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
    return withYear ? `${dt.getFullYear()} 年 ${base}` : base;
  }

  function fmtDateTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtRelative(ts) {
    if (!ts) return "";
    const diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} 天前`;
    return fmtDateTime(ts).slice(0, 10);
  }

  /** 纪念日的下一次发生日期 */
  function nextOccurrence(anniv, from) {
    const base = parseDate(anniv.date);
    if (!base) return null;
    const now = startOfDay(from || new Date());
    if (!anniv.yearly) return base;

    let next = new Date(now.getFullYear(), base.getMonth(), base.getDate());
    if (startOfDay(next) < now) {
      next = new Date(now.getFullYear() + 1, base.getMonth(), base.getDate());
    }
    return next;
  }

  /* ---------------- 小工具 ---------------- */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /** 迷你 Markdown 渲染 */
  function md(src) {
    let text = String(src || "").replace(/\r\n/g, "\n");
    const codes = [];
    text = text.replace(/```([\s\S]*?)```/g, (m, code) => {
      codes.push(code.replace(/^\n/, ""));
      return `\u0000${codes.length - 1}\u0000`;
    });
    text = esc(text);

    text = text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const lines = text.split("\n");
    const out = [];
    let listType = null;

    const closeList = () => {
      if (listType) {
        out.push(`</${listType}>`);
        listType = null;
      }
    };

    lines.forEach((line) => {
      const t = line.trim();

      if (!t) {
        closeList();
        return;
      }
      if (/^\u0000\d+\u0000$/.test(t)) {
        closeList();
        out.push(`<pre><code>${codes[Number(t.replace(/\u0000/g, ""))] || ""}</code></pre>`);
        return;
      }
      const h = t.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        closeList();
        out.push(`<h${h[1].length}>${h[2]}</h${h[1].length}>`);
        return;
      }
      if (/^(-{3,}|\*{3,})$/.test(t)) {
        closeList();
        out.push("<hr />");
        return;
      }
      if (/^>\s?/.test(t)) {
        closeList();
        out.push(`<blockquote>${t.replace(/^>\s?/, "")}</blockquote>`);
        return;
      }
      if (/^[-*+]\s+/.test(t)) {
        if (listType !== "ul") {
          closeList();
          out.push("<ul>");
          listType = "ul";
        }
        out.push(`<li>${t.replace(/^[-*+]\s+/, "")}</li>`);
        return;
      }
      if (/^\d+\.\s+/.test(t)) {
        if (listType !== "ol") {
          closeList();
          out.push("<ol>");
          listType = "ol";
        }
        out.push(`<li>${t.replace(/^\d+\.\s+/, "")}</li>`);
        return;
      }
      closeList();
      out.push(`<p>${t}</p>`);
    });

    closeList();
    return out.join("");
  }

  /** HTML 事件里用的转义（放到属性中） */
  function attr(str) {
    return esc(str).replace(/'/g, "&#39;");
  }

  /** 图片压缩成 dataURL */
  function compressImage(file, max, quality) {
    const limit = max || 1280;
    const q = quality || 0.82;
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("不是图片文件"));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, limit / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片读取失败"));
      };
      img.src = url;
    });
  }

  /* ---------------- 弹窗 ---------------- */
  let openModals = 0;

  function modal(options) {
    const opt = options || {};
    const mask = document.createElement("div");
    mask.className = "mask";

    const btns = (opt.footer || [])
      .map((b, i) => {
        const variant = b.variant ? ` btn--${b.variant}` : "";
        return `<button type="button" class="btn${variant}" data-idx="${i}">${esc(b.text)}</button>`;
      })
      .join("");

    mask.innerHTML = `
      <div class="modal ${opt.size === "sm" ? "modal--sm" : ""}" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3 class="modal__title">${esc(opt.title || "")}</h3>
          <button type="button" class="modal__x" aria-label="关闭">✕</button>
        </div>
        <div class="modal__body"></div>
        ${btns ? `<div class="modal__foot">${btns}</div>` : ""}
      </div>`;

    const body = mask.querySelector(".modal__body");
    if (typeof opt.html === "string") body.innerHTML = opt.html;
    else if (opt.html) body.appendChild(opt.html);

    function close() {
      mask.remove();
      openModals = Math.max(0, openModals - 1);
      document.removeEventListener("keydown", onKey);
      if (opt.onClose) opt.onClose();
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    mask.querySelector(".modal__x").addEventListener("click", close);
    mask.addEventListener("mousedown", (e) => {
      if (e.target === mask && opt.dismissible !== false) close();
    });

    (opt.footer || []).forEach((b, i) => {
      const el = mask.querySelector(`[data-idx="${i}"]`);
      if (el) {
        el.addEventListener("click", () => {
          if (b.onClick) b.onClick(body, close);
          else if (b.close !== false) close();
        });
      }
    });

    document.body.appendChild(mask);
    openModals += 1;
    document.addEventListener("keydown", onKey);

    if (opt.onMount) opt.onMount(body, close);

    const first = body.querySelector("input, textarea, select");
    if (first && opt.autofocus !== false) setTimeout(() => first.focus(), 60);

    return { el: mask, close };
  }

  function confirm(options) {
    const opt = options || {};
    return new Promise((resolve) => {
      let answered = false;
      modal({
        title: opt.title || "确定吗？",
        size: "sm",
        dismissible: true,
        html: `<p class="hint" style="font-size:.86rem;line-height:1.7;color:#86606e">${esc(opt.text || "")}</p>`,
        footer: [
          { text: opt.cancelText || "再想想", variant: "ghost", onClick: (b, close) => { answered = true; close(); resolve(false); } },
          { text: opt.okText || "确定", variant: opt.danger ? "danger" : "primary", onClick: (b, close) => { answered = true; close(); resolve(true); } },
        ],
        onClose: () => {
          if (!answered) resolve(false);
        },
      });
    });
  }

  /* ---------------- 恋爱银行 / 券系统 ---------------- */
  const COUPON_TYPES = [
    { id: "praise", name: "夸夸券", emoji: "🌸", price: 10, desc: "兑换一句超长的彩虹屁" },
    { id: "sorry", name: "道歉券", emoji: "🙇", price: 15, desc: "一次无条件道歉，不许记账" },
    { id: "wish", name: "愿望券", emoji: "🌠", price: 30, desc: "提一个愿望，对方尽量满足" },
    { id: "chore", name: "家务券", emoji: "🧹", price: 20, desc: "一次家务代劳，指哪打哪" },
    { id: "treat", name: "请客券", emoji: "🍰", price: 25, desc: "一餐请客，随便点" },
  ];

  /** 积分规则：dailyCap 为每日上限，不设则不限 */
  const POINTS = {
    checkin_day: { points: 2, label: "每日打卡", once: true },
    checkin_all: { points: 5, label: "完成全部打卡任务", once: true },
    diary: { points: 5, label: "写一篇日记", dailyCap: 15 },
    photo: { points: 1, label: "上传一张照片", dailyCap: 10 },
    wish_done: { points: 3, label: "完成一个愿望", dailyCap: 6 },
  };

  function bankData() {
    if (!state.bank) state.bank = buildDefault().bank;
    const b = state.bank;
    if (!b.accounts) b.accounts = { me: { balance: 0, earned: 0, spent: 0 }, her: { balance: 0, earned: 0, spent: 0 } };
    if (!b.coupons) b.coupons = [];
    if (!b.tx) b.tx = [];
    return b;
  }

  function account(key) {
    const b = bankData();
    return b.accounts[key || (who || "me")];
  }

  function txAdd(row) {
    const b = bankData();
    b.tx.unshift(Object.assign({ id: uid(), at: Date.now() }, row));
    if (b.tx.length > 200) b.tx.length = 200;
  }

  /** 赚积分：幂等（同一 refKey 只发放一次）+ 每日上限 */
  function award(event, options) {
    const opt = options || {};
    const rule = POINTS[event];
    if (!rule) return 0;

    const b = bankData();
    const key = who || "me";
    const today = todayStr();
    const qty = opt.qty || 1;

    if (opt.refKey && b.tx.some((t) => t.refKey === opt.refKey)) return 0;
    if (rule.once && b.tx.some((t) => t.event === event && t.account === key && t.date === today)) return 0;

    let points = rule.points * qty;
    if (rule.dailyCap) {
      const gained = b.tx
        .filter((t) => t.event === event && t.account === key && t.date === today && t.kind === "earn")
        .reduce((sum, t) => sum + t.amount, 0);
      points = Math.min(points, Math.max(0, rule.dailyCap - gained));
    }

    if (points <= 0) {
      if (rule.dailyCap) toast("今天的这项积分已经拿满了 🙂");
      return 0;
    }

    const acc = account(key);
    acc.balance += points;
    acc.earned += points;

    txAdd({
      account: key,
      kind: "earn",
      amount: points,
      reason: opt.reason || rule.label + (qty > 1 ? ` ×${qty}` : ""),
      event,
      date: today,
      refKey: opt.refKey || "",
      couponId: opt.couponId || "",
    });

    save();
    return points;
  }

  /** 发行券：从发行人账户扣积分，券进入对方券包 */
  function issueCoupon(input) {
    const b = bankData();
    const from = who || "me";
    const to = from === "me" ? "her" : "me";
    const price = Math.max(0, Number(input.price) || 0);
    const acc = account(from);

    if (!input.title || !input.title.trim()) return { ok: false, msg: "给券起个名字吧" };
    if (acc.balance < price) return { ok: false, msg: "积分不够，先去打卡赚一点吧" };

    acc.balance -= price;
    acc.spent += price;

    const coupon = {
      id: uid(),
      typeId: input.typeId || "custom",
      title: input.title.trim(),
      emoji: input.emoji || "🎟",
      price,
      note: (input.note || "").trim(),
      from,
      to,
      status: "active",
      createdAt: Date.now(),
    };
    b.coupons.unshift(coupon);

    txAdd({
      account: from,
      kind: "issue",
      amount: -price,
      reason: `发行「${coupon.title}」给${persona(to).name}`,
      couponId: coupon.id,
      event: "issue",
      date: todayStr(),
    });

    save();
    return { ok: true, coupon };
  }

  /** 使用券：只能由收券人使用，记录时间与备注 */
  function useCoupon(id, useNote) {
    const b = bankData();
    const coupon = b.coupons.find((c) => c.id === id);
    const key = who || "me";
    if (!coupon) return { ok: false, msg: "券不存在" };
    if (coupon.to !== key) return { ok: false, msg: "这张券不是给你的哦" };
    if (coupon.status !== "active") return { ok: false, msg: "这张券已经用过了" };

    coupon.status = "used";
    coupon.usedAt = Date.now();
    coupon.useNote = (useNote || "").trim();

    txAdd({
      account: key,
      kind: "use",
      amount: 0,
      reason: `使用了「${coupon.title}」`,
      couponId: coupon.id,
      event: "use",
      date: todayStr(),
    });

    save();
    return { ok: true, coupon };
  }

  /** 删除 / 撤回券 */
  function removeCoupon(id) {
    const b = bankData();
    const coupon = b.coupons.find((c) => c.id === id);
    if (!coupon) return false;
    b.coupons = b.coupons.filter((c) => c.id !== id);
    txAdd({
      account: who || "me",
      kind: "adjust",
      amount: 0,
      reason: `删除了「${coupon.title}」`,
      couponId: coupon.id,
      event: "delete",
      date: todayStr(),
    });
    save();
    return true;
  }

  function couponsOf(key, status) {
    const b = bankData();
    return b.coupons
      .filter((c) => c.to === key)
      .filter((c) => (status ? c.status === status : true))
      .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  }

  /* ---------------- 导航骨架 ---------------- */
  const NAV = [
    { key: "home", href: "index.html", icon: "🏠", label: "首页" },
    { key: "anniversary", href: "anniversary.html", icon: "🎂", label: "纪念日" },
    { key: "albums", href: "albums.html", icon: "📷", label: "相册" },
    { key: "diary", href: "diary.html", icon: "📖", label: "日记" },
    { key: "wishes", href: "wishes.html", icon: "🌠", label: "愿望" },
    { key: "checkin", href: "checkin.html", icon: "✅", label: "打卡" },
    { key: "bank", href: "bank.html", icon: "🎟", label: "券包" },
    { key: "universe", href: "universe.html", icon: "🌌", label: "小宇宙" },
    { key: "settings", href: "settings.html", icon: "⚙️", label: "设置" },
  ];

  function mountChrome() {
    const page = document.body.dataset.page || "home";
    const me = persona(who || "me");

    const navHTML = NAV.map(
      (n) => `<li><a href="${n.href}" class="${n.key === page ? "is-on" : ""}">${n.icon} ${n.label}</a></li>`
    ).join("");

    const tabHTML = NAV.map(
      (n) => `<a href="${n.href}" class="${n.key === page ? "is-on" : ""}"><b>${n.icon}</b>${n.label}</a>`
    ).join("");

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="petals" aria-hidden="true"></div>
      <header class="topbar">
        <a class="brand" href="index.html"><span class="brand__mark">♡</span>瀚海遇伊梦</a>
        <ul class="navlinks">${navHTML}</ul>
        <a class="who" href="settings.html" title="当前身份">
          <span class="who__ava" style="${me.avatar ? `background-image:url('${attr(me.avatar)}')` : ""}">${me.avatar ? "" : esc(me.initial)}</span>
          ${esc(me.name)}
        </a>
      </header>
      <nav class="tabbar">${tabHTML}</nav>
    `;

    document.body.insertBefore(wrap, document.body.firstChild);
  }

  function initPetals() {
    const layer = document.querySelector(".petals");
    if (!layer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glyphs = ["♥", "♡", "❀", "✿", "♥"];
    const count = window.innerWidth < 640 ? 10 : 18;

    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("span");
      el.className = "petal";
      el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      const dur = 18 + Math.random() * 18;
      el.style.left = `${Math.random() * 100}%`;
      el.style.fontSize = `${7 + Math.random() * 13}px`;
      el.style.animationDuration = `${dur}s`;
      el.style.animationDelay = `${-Math.random() * dur}s`;
      el.style.setProperty("--drift", `${(Math.random() - 0.5) * 200}px`);
      el.style.setProperty("--spin", `${(Math.random() - 0.5) * 500}deg`);
      el.style.setProperty("--o", (0.2 + Math.random() * 0.35).toFixed(2));
      el.style.setProperty("--s", (0.8 + Math.random() * 0.5).toFixed(2));
      layer.appendChild(el);
    }
  }

  /* ---------------- 身份选择 ---------------- */
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function mountGate() {
    const a = persona("me");
    const b = persona("her");
    const gate = document.createElement("div");
    gate.className = "gate";

    const chooseHTML = `
      <div class="gate__brand">♡ &nbsp;瀚海遇伊梦</div>
      <h2 class="gate__title">今天是谁来访呀？</h2>
      <p class="gate__sub">选一个身份进来，日记的私密内容只对本人可见</p>
      <div class="gate__list">
        <button class="gate__btn" data-who="me">
          <span class="avatar avatar--me" style="${a.avatar ? `background-image:url('${attr(a.avatar)}')` : ""}">${a.avatar ? "" : esc(a.initial)}</span>
          <span>我是 ${esc(a.name)}</span>
        </button>
        <button class="gate__btn" data-who="her">
          <span class="avatar avatar--her" style="${b.avatar ? `background-image:url('${attr(b.avatar)}')` : ""}">${b.avatar ? "" : esc(b.initial)}</span>
          <span>我是 ${esc(b.name)}</span>
        </button>
      </div>
      <p class="gate__hint">需要口令才能进入 · 初始口令 12345678</p>`;

    gate.innerHTML = `<div class="gate__box">${chooseHTML}</div>`;
    const box = gate.querySelector(".gate__box");

    function enter(whoKey) {
      setWho(whoKey);
      gate.remove();
      mountChrome();
      initPetals();
      resolveReady();
    }

    function askPassword(whoKey) {
      const person = persona(whoKey);
      box.innerHTML = `
        <div class="gate__brand">♡ &nbsp;瀚海遇伊梦</div>
        <span class="avatar ${whoKey === "me" ? "avatar--me" : "avatar--her"} gate__ava"
          style="${person.avatar ? `background-image:url('${attr(person.avatar)}')` : ""}">${person.avatar ? "" : esc(person.initial)}</span>
        <h2 class="gate__title">${esc(person.name)}，口令是？</h2>
        <p class="gate__sub">只有你们两个知道的那串数字</p>
        <form class="gate__form" autocomplete="off">
          <input class="input gate__input" type="password" inputmode="numeric" placeholder="输入口令" maxlength="20" />
          <p class="gate__err" hidden>口令不对，再想想～</p>
          <button class="btn btn--block" type="submit">进入小宇宙</button>
        </form>
        <button class="gate__back" type="button">← 换个身份</button>`;

      const form = box.querySelector(".gate__form");
      const input = box.querySelector(".gate__input");
      const err = box.querySelector(".gate__err");

      box.querySelector(".gate__back").addEventListener("click", () => {
        box.innerHTML = chooseHTML;
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pass = input.value.trim();
        if (!pass) return;

        const result = await checkPass(whoKey, pass);
        if (!result.ok) {
          err.hidden = false;
          box.classList.remove("gate--shake");
          void box.offsetWidth;
          box.classList.add("gate--shake");
          input.select();
          return;
        }

        if (result.init) await setPass(whoKey, pass);
        enter(whoKey);
      });

      setTimeout(() => input.focus(), 90);
    }

    gate.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-who]");
      if (!btn) return;
      askPassword(btn.dataset.who);
    });

    document.body.appendChild(gate);
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // 先尝试从服务端拿数据，拿不到就直接用本地的
    await remoteLoad();

    if (who === "me" || who === "her") {
      mountChrome();
      initPetals();
      resolveReady();
    } else {
      mountGate();
    }
  });

  function page(fn) {
    ready.then(() => {
      try {
        fn(HM);
      } catch (err) {
        console.error("[page]", err);
      }
    });
  }

  /* ---------------- 对外 ---------------- */
  return {
    state,
    save,
    store: { DB_KEY, WHO_KEY },
    get who() {
      return who || "me";
    },
    setWho,
    checkPass,
    setPass,
    moodGet,
    moodSet,
    DEFAULT_PASS,
    persona,
    partner: () => persona(who === "her" ? "me" : "her"),
    me: () => persona(who || "me"),
    NAV,
    ready,
    page,
    toast,
    modal,
    confirm,
    md,
    esc,
    attr,
    uid,
    todayStr,
    parseDate,
    startOfDay,
    daysBetween,
    fmtDate,
    fmtDateTime,
    fmtRelative,
    nextOccurrence,
    compressImage,
    shift,
    storageOK: () => storageOK,
    remote: REMOTE,
    uploadImage,
    bank: {
      types: COUPON_TYPES,
      rules: POINTS,
      account,
      couponsOf,
      data: bankData,
      award,
      issue: issueCoupon,
      use: useCoupon,
      remove: removeCoupon,
    },
  };
})();
