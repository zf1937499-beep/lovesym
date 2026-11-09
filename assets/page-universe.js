/* 小宇宙：本月报告 / 成就徽章 / 默契问答 / 决策转盘 / 暗号 */
HM.page(function (HM) {
  const S = HM.state;
  const pad = (n) => String(n).padStart(2, "0");
  const partnerKey = HM.who === "me" ? "her" : "me";
  const partnerName = HM.persona(partnerKey).name;

  /* ---------------- 标签切换 ---------------- */
  const PANES = ["report", "badges", "quiz", "spin", "secret"];
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    const key = btn.dataset.tab;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("is-on", b === btn));
    PANES.forEach((k) => {
      const pane = document.getElementById("pane-" + k);
      if (pane) pane.hidden = k !== key;
    });
  });

  /* =========================================================
     1. 本月报告
     ========================================================= */
  function monthKeyOf(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function rangeOf(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
    };
  }

  function statsOf(range) {
    const inMonth = (ts) => Boolean(ts) && monthKeyOf(ts) === range.key;

    const photos = S.albums.reduce(
      (n, a) => n + (a.photos || []).filter((p) => inMonth(p.addedAt || a.createdAt)).length,
      0
    );
    const diaries = S.diary.filter(
      (d) => inMonth(d.createdAt) && (d.visibility !== "private" || d.author === HM.who)
    );
    const words = diaries.reduce((n, d) => n + (d.content || "").replace(/\s/g, "").length, 0);
    const checkinDays = S.checkins.filter((c) => c.date.startsWith(range.key) && (c.tasks || []).length).length;
    const wishes = S.wishes.filter((w) => w.status === "done" && inMonth(w.doneAt || w.createdAt)).length;
    const coupons = HM.bank.data().coupons.filter((c) => inMonth(c.createdAt)).length;

    return { photos, diaries: diaries.length, words, checkinDays, wishes, coupons };
  }

  function delta(now, prev) {
    const diff = now - prev;
    if (!diff) return "";
    return `<i class="${diff > 0 ? "up" : "down"}">${diff > 0 ? "↑" : "↓"}${Math.abs(diff)}</i>`;
  }

  function renderReport() {
    const now = rangeOf(0);
    const prev = rangeOf(-1);
    const cur = statsOf(now);
    const last = statsOf(prev);
    const totalDays = HM.daysBetween(new Date(S.couple.startDate), new Date()) + 1;

    const parts = [];
    if (cur.photos) parts.push(`拍了 ${cur.photos} 张照片`);
    if (cur.diaries) parts.push(`写了 ${cur.diaries} 篇日记`);
    if (cur.checkinDays) parts.push(`打卡 ${cur.checkinDays} 天`);
    if (cur.wishes) parts.push(`完成了 ${cur.wishes} 个愿望`);
    if (cur.coupons) parts.push(`发出 ${cur.coupons} 张券`);

    const summary = parts.length
      ? `这个月，你们${parts.join("，")}。`
      : "这个月还什么都没记，去拍张照片、写几句吧。";

    const saved = S.reports && S.reports[now.key] ? S.reports[now.key].summary : "";

    document.getElementById("reportBody").innerHTML = `
      <div class="report__eyebrow">我们的 ${now.year} 年 ${now.month} 月</div>
      <h2 class="report__title">在一起的第 ${totalDays} 天<br />我们又多了一个月</h2>

      <div class="report__grid">
        <div class="report-stat"><b>${cur.photos}</b><span>张照片 ${delta(cur.photos, last.photos)}</span></div>
        <div class="report-stat"><b>${cur.diaries}</b><span>篇日记 ${delta(cur.diaries, last.diaries)}</span></div>
        <div class="report-stat"><b>${cur.words.toLocaleString("en-US")}</b><span>个字</span></div>
        <div class="report-stat"><b>${cur.checkinDays}</b><span>天打卡 ${delta(cur.checkinDays, last.checkinDays)}</span></div>
        <div class="report-stat"><b>${cur.wishes}</b><span>个愿望</span></div>
        <div class="report-stat"><b>${cur.coupons}</b><span>张券</span></div>
      </div>

      <p class="report__line">${summary}</p>

      <div class="report__ai" id="reportAi">
        ${
          saved
            ? `<p class="report__ai-text">${HM.esc(saved)}</p>
               <div class="report__ai-acts">
                 <button class="btn btn--ghost btn--sm" type="button" id="aiMonthlyBtn">再生成一版</button>
               </div>`
            : `<button class="btn btn--ghost btn--sm" type="button" id="aiMonthlyBtn">✨ 生成 AI 总结</button>
               <p class="hint" style="margin-top:6px">不会自动调用，点了才生成</p>`
        }
      </div>

      <p class="report__foot">瀚海遇伊梦 · 我们的小宇宙</p>`;

    bindReportAI(now, cur);
  }

  function bindReportAI(now, cur) {
    const first = document.getElementById("aiMonthlyBtn");
    if (!first) return;

    if (!HM.ai) {
      first.disabled = true;
      first.textContent = "AI 未连接";
      return;
    }

    async function run(trigger) {
      const res = await HM.ai.busy(trigger, "AI 正在写…", () =>
        HM.ai.post("monthly", { month: `${now.year} 年 ${now.month} 月`, stats: cur })
      );

      if (!res.ok) {
        HM.toast(HM.ai.failMessage(res));
        return;
      }

      const text = res.data.summary;
      const box = document.getElementById("reportAi");
      box.innerHTML = `
        <p class="report__ai-text">${HM.esc(text)}</p>
        <div class="report__ai-acts">
          <button class="btn btn--soft btn--sm" type="button" id="aiSaveBtn">保存到月报</button>
          <button class="btn btn--ghost btn--sm" type="button" id="aiMonthlyBtn">再来一版</button>
        </div>`;

      document.getElementById("aiSaveBtn").addEventListener("click", () => {
        if (!S.reports || typeof S.reports !== "object") S.reports = {};
        S.reports[now.key] = { summary: text, at: Date.now() };
        HM.save();
        renderReport();
        HM.toast("已存进这个月的月报 ♡");
      });

      const again = document.getElementById("aiMonthlyBtn");
      again.addEventListener("click", () => run(again));
    }

    first.addEventListener("click", () => run(first));
  }

  document.getElementById("printReport").addEventListener("click", () => window.print());

  /* =========================================================
     2. 成就徽章
     ========================================================= */
  function maxStreak() {
    const days = S.checkins
      .filter((c) => (c.tasks || []).length)
      .map((c) => c.date)
      .sort();
    let best = 0;
    let run = 0;
    let prevTime = null;
    days.forEach((d) => {
      const t = new Date(d + "T00:00:00").getTime();
      if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) run += 1;
      else run = 1;
      prevTime = t;
      best = Math.max(best, run);
    });
    return best;
  }

  function totals() {
    const visibleDiary = S.diary.filter((d) => d.visibility !== "private" || d.author === HM.who);
    return {
      photos: S.albums.reduce((n, a) => n + (a.photos || []).length, 0),
      diaries: visibleDiary.length,
      words: visibleDiary.reduce((n, d) => n + (d.content || "").replace(/\s/g, "").length, 0),
      checkinDays: S.checkins.filter((c) => (c.tasks || []).length).length,
      streak: maxStreak(),
      wishesDone: S.wishes.filter((w) => w.status === "done").length,
      coupons: HM.bank.data().coupons.length,
      days: HM.daysBetween(new Date(S.couple.startDate), new Date()),
    };
  }

  const BADGES = [
    { id: "photo1", icon: "📷", name: "第一张照片", desc: "上传第一张照片", test: (t) => t.photos >= 1 },
    { id: "photo10", icon: "🖼", name: "照片墙成型", desc: "累计 10 张照片", test: (t) => t.photos >= 10 },
    { id: "diary1", icon: "📖", name: "第一篇日记", desc: "写下第一篇日记", test: (t) => t.diaries >= 1 },
    { id: "diary10", icon: "📚", name: "记录成瘾", desc: "累计 10 篇日记", test: (t) => t.diaries >= 10 },
    { id: "words10k", icon: "✍️", name: "万字情书", desc: "日记累计 10000 字", test: (t) => t.words >= 10000 },
    { id: "streak7", icon: "✅", name: "七天不断更", desc: "连续打卡 7 天", test: (t) => t.streak >= 7 },
    { id: "streak30", icon: "🔥", name: "一个月不断更", desc: "连续打卡 30 天", test: (t) => t.streak >= 30 },
    { id: "wish1", icon: "🌠", name: "愿望成真", desc: "完成第一个愿望", test: (t) => t.wishesDone >= 1 },
    { id: "coupon1", icon: "🎟", name: "第一张券", desc: "发行或收到第一张券", test: (t) => t.coupons >= 1 },
    { id: "day100", icon: "🕯", name: "一百天", desc: "在一起 100 天", test: (t) => t.days >= 99 },
    { id: "day365", icon: "🎂", name: "一年了", desc: "在一起 365 天", test: (t) => t.days >= 364 },
    { id: "day1000", icon: "💍", name: "一千天", desc: "在一起 1000 天", test: (t) => t.days >= 999 },
  ];

  function renderBadges() {
    if (!S.badges || typeof S.badges !== "object") S.badges = {};
    const t = totals();
    const newly = [];

    BADGES.forEach((b) => {
      if (b.test(t) && !S.badges[b.id]) {
        S.badges[b.id] = Date.now();
        newly.push(b);
      }
    });

    const unlocked = BADGES.filter((b) => S.badges[b.id]).length;

    if (newly.length) {
      HM.save();
      HM.toast(`解锁新徽章：${newly.map((b) => b.name).join("、")} ♡`);
    }

    document.getElementById("badgeCount").textContent = `${unlocked} / ${BADGES.length}`;
    document.getElementById("badgeBar").style.width = `${(unlocked / BADGES.length) * 100}%`;

    document.getElementById("badgeGrid").innerHTML = BADGES.map((b) => {
      const at = S.badges[b.id];
      return `
        <div class="badge ${at ? "is-on" : ""}">
          <span class="badge__icon">${at ? b.icon : "🔒"}</span>
          <div class="badge__name">${b.name}</div>
          <div class="badge__desc">${at ? HM.fmtDate(new Date(at), true) + " 解锁" : b.desc}</div>
        </div>`;
    }).join("");
  }

  /* =========================================================
     3. 每日默契问答
     ========================================================= */
  const QUIZ_BANK = [
    { q: "如果突然多出一天假，最想做什么？", o: ["睡到自然醒", "出门吃好吃的", "窝着看电影", "随便走走"] },
    { q: "吵架之后，你更需要什么？", o: ["先抱一下", "各自冷静一会", "把话说清楚", "吃顿好的就好了"] },
    { q: "理想的周末是什么样？", o: ["宅在家里", "短途旅行", "逛街买东西", "约朋友一起"] },
    { q: "对方难过的时候，你通常会？", o: ["立刻安慰", "安静陪着", "帮 TA 分析", "想办法逗笑"] },
    { q: "如果养宠物，最想养？", o: ["猫", "狗", "鱼或者植物", "先不养"] },
    { q: "哪种礼物最戳你？", o: ["实用的", "制造惊喜的", "手写手作的", "吃的"] },
    { q: "一起旅行时，你负责？", o: ["订行程", "找吃的", "拍照", "跟着走就行"] },
    { q: "纪念日你更喜欢怎么过？", o: ["好好吃一顿", "出去玩一趟", "在家做饭", "低调过"] },
    { q: "你更不能接受？", o: ["被冷落", "被误解", "被敷衍", "被管太多"] },
    { q: "睡前最想做的一件事？", o: ["聊聊天", "刷会儿手机", "抱一下", "直接睡"] },
  ];

  const todayKey = HM.todayStr();
  const dayIndex = Math.floor(Date.now() / 86400000);

  /** 内置题库 + AI 生成的问卷 */
  function allQuestions() {
    const custom = Array.isArray(S.aiQuiz) ? S.aiQuiz : [];
    return QUIZ_BANK.concat(custom);
  }

  function quizRecord() {
    if (!S.quiz || typeof S.quiz !== "object") S.quiz = {};

    let rec = S.quiz[todayKey];
    if (!rec) {
      const bank = allQuestions();
      const q = bank[dayIndex % bank.length];
      rec = { qid: dayIndex % bank.length, q: q.q, o: q.o, reason: q.reason || "", answers: {} };
      S.quiz[todayKey] = rec;
    }
    if (!rec.answers) rec.answers = {};

    // 兼容早期只存了 qid 的记录
    if (!rec.q) {
      const bank = allQuestions();
      const q = bank[Math.abs(rec.qid || 0) % bank.length];
      rec.q = q.q;
      rec.o = q.o;
      rec.reason = q.reason || "";
    }
    return rec;
  }

  function renderQuiz() {
    const rec = quizRecord();
    const mine = rec.answers[HM.who];
    const theirs = rec.answers[partnerKey];
    const both = mine !== undefined && theirs !== undefined;
    const agree = both && mine === theirs;

    const options = rec.o
      .map((text, i) => {
        const isMine = mine === i;
        const isTheirs = both && theirs === i;
        let cls = "quiz-opt";
        if (isMine) cls += " is-mine";
        if (both && isTheirs) cls += " is-theirs";
        if (both && agree && isMine && isTheirs) cls += " is-agree";
        return `
          <button class="${cls}" type="button" data-opt="${i}" ${mine !== undefined ? "disabled" : ""}>
            <span class="quiz-opt__key">${String.fromCharCode(65 + i)}</span>
            <span class="quiz-opt__text">${HM.esc(text)}</span>
            ${isMine ? '<span class="quiz-opt__tag">你</span>' : ""}
            ${both && isTheirs && !isMine ? `<span class="quiz-opt__tag quiz-opt__tag--ta">${HM.esc(partnerName)}</span>` : ""}
          </button>`;
      })
      .join("");

    let status = "";
    if (mine === undefined) {
      status = `<p class="hint">选一个答案，${HM.esc(partnerName)}答完就能看到彼此的</p>`;
    } else if (theirs === undefined) {
      status = `<p class="hint">已经记下你的答案，等 ${HM.esc(partnerName)} 也答完就揭晓</p>`;
    } else {
      status = `<p class="quiz-result ${agree ? "is-agree" : ""}">
          ${agree ? "心有灵犀！这题你们选的一样 ♡" : `这题你们选的不一样，下次再努力～`}
        </p>`;
    }

    document.getElementById("quizCard").innerHTML = `
      <div class="quiz__head">
        <span class="pill">今日一题</span>
        <button class="btn btn--soft btn--sm" type="button" id="aiQuizBtn">✨ AI 出题</button>
      </div>
      <h2 class="quiz__q">${HM.esc(rec.q)}</h2>
      ${rec.reason ? `<p class="hint" style="margin:-6px 0 12px">出题理由：${HM.esc(rec.reason)}</p>` : ""}
      <div class="quiz__opts">${options}</div>
      ${status}`;

    // 统计
    const keys = Object.keys(S.quiz).filter((k) => {
      const r = S.quiz[k];
      return r && r.answers && r.answers.me !== undefined && r.answers.her !== undefined;
    });
    const matches = keys.filter((k) => S.quiz[k].answers.me === S.quiz[k].answers.her).length;
    const rate = keys.length ? Math.round((matches / keys.length) * 100) : 0;

    document.getElementById("quizStats").innerHTML = `
      <div class="card__head"><h2 class="card__title"><span>💞</span>默契档案</h2></div>
      <div class="stats">
        <div class="stat"><b>${keys.length}</b><span>已揭晓</span></div>
        <div class="stat"><b>${matches}</b><span>想法一致</span></div>
        <div class="stat"><b>${rate}%</b><span>默契度</span></div>
      </div>
      <p class="hint" style="margin-top:12px">
        ${keys.length ? `你们已经一起答了 ${keys.length} 天，继续保持 ♡` : "还没有揭晓过的题目，今天就开始吧"}
      </p>`;

    document.querySelectorAll("#quizCard [data-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = quizRecord();
        if (r.answers[HM.who] !== undefined) return;
        r.answers[HM.who] = Number(btn.dataset.opt);
        HM.save();
        renderQuiz();
        if (r.answers[partnerKey] !== undefined) HM.toast("揭晓啦，快看看你们默契不 ♡");
        else HM.toast("答案已记录，等 TA 来答");
      });
    });

    const aiBtn = document.getElementById("aiQuizBtn");
    if (aiBtn) {
      if (!HM.ai) {
        aiBtn.disabled = true;
        aiBtn.textContent = "AI 未连接";
      } else {
        aiBtn.addEventListener("click", () => generateQuiz(aiBtn));
      }
    }
  }

  /** AI 出 5 道个性化题目 */
  async function generateQuiz(btn) {
    // 只传关键词：取最近三个愿望的开头几个字，不传正文
    const keywords = S.wishes.slice(0, 3).map((w) => (w.title || "").slice(0, 8)).filter(Boolean);

    const res = await HM.ai.busy(btn, "出题中…", () =>
      HM.ai.post("quiz", {
        nicknames: [HM.persona("me").name, HM.persona("her").name],
        keywords,
      })
    );

    if (!res.ok) {
      HM.toast(HM.ai.failMessage(res));
      return;
    }

    const list = (res.data.questions || []).map((q) => ({
      id: HM.uid(),
      q: q.q,
      o: q.options,
      reason: q.reason,
    }));

    if (!list.length) {
      HM.toast("这次没出成题，再试一次");
      return;
    }

    S.aiQuiz = (Array.isArray(S.aiQuiz) ? S.aiQuiz : []).concat(list).slice(-40);

    // 今天还没人答，就直接换成第一道新题
    const rec = quizRecord();
    if (rec.answers.me === undefined && rec.answers.her === undefined) {
      rec.q = list[0].q;
      rec.o = list[0].o;
      rec.reason = list[0].reason;
      rec.qid = -1;
    }

    HM.save();
    renderQuiz();
    HM.toast(`出了 ${list.length} 道题 ♡`);
  }

  /* =========================================================
     4. 决策转盘
     ========================================================= */
  const WHEEL_COLORS = ["#ffb3d3", "#ffd9a8", "#cdb8ff", "#a8e6cf", "#ffc9de", "#ffe3a3"];

  function spinOptions() {
    if (!Array.isArray(S.spinOptions) || !S.spinOptions.length) {
      S.spinOptions = ["火锅", "烧烤", "日料", "随便"];
    }
    return S.spinOptions;
  }

  let rotation = 0;
  let spinning = false;

  function renderWheel() {
    const opts = spinOptions();
    const seg = 360 / opts.length;
    const disc = document.getElementById("wheelDisc");

    disc.style.background = `conic-gradient(from -90deg, ${opts
      .map((o, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
      .join(", ")})`;

    disc.innerHTML = opts
      .map((o, i) => {
        const angle = i * seg + seg / 2;
        return `<span class="wheel__label" style="transform: translate(-50%,-50%) rotate(${angle}deg) translate(0,-86px) rotate(${-angle}deg)">${HM.esc(o)}</span>`;
      })
      .join("");

    document.getElementById("spinOptions").innerHTML = opts
      .map(
        (o, i) =>
          `<div class="spin-opt"><i style="background:${WHEEL_COLORS[i % WHEEL_COLORS.length]}"></i>${HM.esc(o)}</div>`
      )
      .join("");

    const history = Array.isArray(S.spins) ? S.spins.slice(0, 5) : [];
    document.getElementById("spinHistory").innerHTML = history.length
      ? history
          .map(
            (h) => `<div class="row" style="padding:10px 12px">
              <div class="row__body">
                <div class="row__title" style="font-size:0.88rem">${HM.esc(h.result)}</div>
                <div class="row__meta">${HM.persona(h.by).name} 转的 · ${HM.fmtRelative(h.at)}</div>
              </div>
            </div>`
          )
          .join("")
      : `<p class="hint">还没转过，今天吃什么交给它吧</p>`;
  }

  document.getElementById("spinBtn").addEventListener("click", () => {
    if (spinning) return;
    const opts = spinOptions();
    const seg = 360 / opts.length;
    const idx = Math.floor(Math.random() * opts.length);
    const disc = document.getElementById("wheelDisc");

    spinning = true;
    document.getElementById("spinResult").textContent = "转啊转…";

    let target = rotation + 360 * 4;
    const cur = ((target % 360) + 360) % 360;
    const desired = ((360 - (idx * seg + seg / 2)) % 360 + 360) % 360;
    target += ((desired - cur) + 360) % 360;
    rotation = target;

    disc.style.transition = "transform 3.1s cubic-bezier(.17,.67,.15,1)";
    disc.style.transform = `rotate(${rotation}deg)`;

    setTimeout(() => {
      spinning = false;
      if (!Array.isArray(S.spins)) S.spins = [];
      S.spins.unshift({
        id: HM.uid(),
        pool: opts.join(" / "),
        result: opts[idx],
        at: Date.now(),
        by: HM.who,
      });
      S.spins = S.spins.slice(0, 30);
      HM.save();
      document.getElementById("spinResult").innerHTML = `就它了：<b>${HM.esc(opts[idx])}</b> ♡`;
      renderWheel();
    }, 3200);
  });

  document.getElementById("spinEdit").addEventListener("click", () => {
    const current = spinOptions().join("\n");
    HM.modal({
      title: "改选项",
      size: "sm",
      html: `
        <div class="field">
          <label for="spinText">一行一个，2~6 个</label>
          <textarea class="textarea" id="spinText" style="min-height:140px">${HM.esc(current)}</textarea>
        </div>`,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "保存",
          onClick: (body, close) => {
            const list = body
              .querySelector("#spinText")
              .value.split("\n")
              .map((s) => s.trim())
              .filter(Boolean);

            if (list.length < 2) {
              HM.toast("至少写两个选项");
              return;
            }
            if (list.length > 6) {
              HM.toast("最多 6 个，转盘才好看");
              return;
            }
            S.spinOptions = list;
            HM.save();
            close();
            renderWheel();
            HM.toast("选项更新啦");
          },
        },
      ],
    });
  });

  /* =========================================================
     5. 暗号惊喜
     ========================================================= */
  let secretOpen = false;

  function secretData() {
    if (!S.secret || typeof S.secret !== "object") {
      S.secret = { code: "0520", date: "", title: "给伊梦的惊喜", content: "" };
    }
    return S.secret;
  }

  function renderSecret() {
    const sec = secretData();
    const todayIsTheDay = Boolean(sec.date) && sec.date === HM.todayStr();
    const open = secretOpen || todayIsTheDay;

    if (!open) {
      document.getElementById("secretBody").innerHTML = `
        <div class="card card--pad secret-lock">
          <div class="secret-lock__icon">🔐</div>
          <h2 class="secret-lock__title">这里锁着一封惊喜</h2>
          <p class="secret-lock__sub">输入你们的暗号才能打开${sec.date ? `，或者等到 ${HM.fmtDate(sec.date, true)}` : ""}</p>
          <form class="secret-lock__form" id="secretForm">
            <input class="input secret-lock__input" id="secretCode" maxlength="12" placeholder="暗号" autocomplete="off" />
            <button class="btn" type="submit">打开</button>
          </form>
          <p class="gate__err" id="secretErr" hidden>暗号不对，再想想～</p>
        </div>`;

      const form = document.getElementById("secretForm");
      const input = document.getElementById("secretCode");
      const err = document.getElementById("secretErr");
      setTimeout(() => input.focus(), 100);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (input.value.trim() === String(sec.code)) {
          secretOpen = true;
          renderSecret();
          HM.toast("咔哒，打开了 ♡");
        } else {
          err.hidden = false;
          input.select();
        }
      });
      return;
    }

    document.getElementById("secretBody").innerHTML = `
      <div class="card card--pad secret-open">
        <div class="card__head">
          <h2 class="card__title"><span>💌</span>${HM.esc(sec.title || "给对方的惊喜")}</h2>
          <button class="btn btn--ghost btn--sm" type="button" id="secretEdit">编辑</button>
        </div>
        <div class="md">${HM.md(sec.content || "（还是空的，点右上角写点什么吧）")}</div>
        <p class="hint" style="margin-top:16px">
          暗号：<b>${HM.esc(sec.code)}</b>${sec.date ? ` · 到 ${HM.fmtDate(sec.date, true)} 自动打开` : ""}
        </p>
      </div>`;

    document.getElementById("secretEdit").addEventListener("click", openSecretEditor);
  }

  function openSecretEditor() {
    const sec = secretData();
    HM.modal({
      title: "编辑惊喜",
      html: `
        <div class="row-2">
          <div class="field">
            <label for="secCode">暗号</label>
            <input class="input" id="secCode" maxlength="12" value="${HM.attr(sec.code)}" />
          </div>
          <div class="field">
            <label for="secDate">到这天自动打开（可选）</label>
            <input class="input" id="secDate" type="date" value="${HM.attr(sec.date || "")}" />
          </div>
        </div>
        <div class="field">
          <label for="secTitle">标题</label>
          <input class="input" id="secTitle" maxlength="24" value="${HM.attr(sec.title || "")}" />
        </div>
        <div class="field">
          <label for="secContent">内容（支持 Markdown）</label>
          <textarea class="textarea" id="secContent" style="min-height:160px">${HM.esc(sec.content || "")}</textarea>
        </div>
        <p class="hint">只有输入暗号（或到了指定日期）才能看到内容。</p>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "保存",
          onClick: (body, close) => {
            const code = body.querySelector("#secCode").value.trim();
            if (!code) {
              HM.toast("暗号不能为空");
              return;
            }
            sec.code = code;
            sec.date = body.querySelector("#secDate").value;
            sec.title = body.querySelector("#secTitle").value.trim();
            sec.content = body.querySelector("#secContent").value;
            HM.save();
            close();
            secretOpen = true;
            renderSecret();
            HM.toast("保存好啦 ♡");
          },
        },
      ],
    });
  }

  /* ---------------- 初始化 ---------------- */
  renderReport();
  renderBadges();
  renderQuiz();
  renderWheel();
  renderSecret();

  // 切到暗号标签时刷新一次状态（跨天自动解锁）
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-tab="secret"]');
    if (btn) renderSecret();
  });
});
