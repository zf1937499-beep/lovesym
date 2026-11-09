/* 首页仪表盘 */
HM.page(function (HM) {
  const S = HM.state;

  const MOODS = [
    ["😍", "甜到冒泡"],
    ["😊", "开心"],
    ["🥰", "心动"],
    ["😐", "平静"],
    ["🥲", "有点 emo"],
    ["😤", "小别扭"],
  ];

  const QUOTES = [
    "喜欢你这件事，我打算做很久很久。",
    "世界很吵，但你在的地方很安静。",
    "我攒了好多话想跟你说，一见到你就全忘了。",
    "如果心动有声音，那你大概是全世界最吵的那个人。",
    "我没什么大愿望，就想每天早上都看见你还没睡醒的样子。",
    "你笑起来的时候，我总觉得今天值得。",
    "以后所有的节日，我都想和你一起过。",
    "我们把日子过成什么样都行，只要是一起过。",
  ];

  /* ---------- 顶部 ---------- */
  const me = HM.persona("me");
  const her = HM.persona("her");

  const avaMe = document.getElementById("heroAvaMe");
  const avaHer = document.getElementById("heroAvaHer");
  if (me.avatar) {
    avaMe.style.backgroundImage = `url('${me.avatar}')`;
    avaMe.textContent = "";
  }
  if (her.avatar) {
    avaHer.style.backgroundImage = `url('${her.avatar}')`;
    avaHer.textContent = "";
  }
  document.getElementById("heroSub").textContent = `${me.name} ♡ ${her.name} · 我们的恋爱空间`;

  const start = new Date(S.couple.startDate).getTime();
  function tick() {
    const diff = Math.max(0, Date.now() - start);
    const days = Math.floor(diff / 86400000);
    document.getElementById("daysNum").textContent = days.toLocaleString("en-US");
    document.getElementById("daysSince").textContent = `今天是我们的第 ${(days + 1).toLocaleString("en-US")} 天`;
    const d = new Date(S.couple.startDate);
    document.getElementById("daysStart").textContent = `从 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日开始`;
  }
  tick();
  setInterval(tick, 60000);

  /* ---------- 下一纪念日 ---------- */
  const annivBox = document.getElementById("annivBox");
  const upcoming = S.anniversaries
    .map((a) => {
      const next = HM.nextOccurrence(a);
      return next ? Object.assign({}, a, { next, days: HM.daysBetween(new Date(), next) }) : null;
    })
    .filter(Boolean)
    .filter((a) => a.days >= 0)
    .sort((a, b) => a.days - b.days);

  if (!upcoming.length) {
    annivBox.innerHTML = `<p class="hint">还没有纪念日，去<a href="anniversary.html">添加一个</a>吧 ♡</p>`;
  } else {
    const a = upcoming[0];
    const when = a.days === 0 ? "就是今天" : `还有 ${a.days} 天`;
    annivBox.innerHTML = `
      <div class="count">
        <div class="count__day">
          <b>${a.days === 0 ? "今" : a.days}</b>
          <small>${a.days === 0 ? "天" : "天后"}</small>
        </div>
        <div class="count__body">
          <div class="count__title">${HM.esc(a.title)}</div>
          <div class="count__meta">${HM.fmtDate(a.next, true)} · ${a.yearly ? "每年重复" : "仅一次"} · ${when}</div>
        </div>
      </div>`;
  }

  /* ---------- 最近照片 ---------- */
  const photoBox = document.getElementById("homePhotos");
  const allPhotos = [];
  S.albums.forEach((al) => {
    (al.photos || []).forEach((p) => allPhotos.push(Object.assign({ album: al.name }, p)));
  });
  allPhotos.sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0));

  if (!allPhotos.length) {
    photoBox.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;padding:10px 0">还没有照片，去<a href="albums.html">相册</a>上传吧 ♡</p>`;
  } else {
    photoBox.innerHTML = allPhotos
      .slice(0, 4)
      .map((p) => `<div class="mini-photo" title="${HM.attr(p.album)}">${p.src ? `<img src="${p.src}" alt="${HM.attr(p.name || "")}" />` : "🌸"}</div>`)
      .join("");
  }

  /* ---------- 最近日记 ---------- */
  const diaryBox = document.getElementById("homeDiary");
  const myDiary = S.diary
    .filter((d) => d.visibility !== "private" || d.author === HM.who)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3);

  if (!myDiary.length) {
    diaryBox.innerHTML = `<p class="hint">还没有日记，<a href="diary.html">写第一篇</a>吧 ♡</p>`;
  } else {
    diaryBox.innerHTML = myDiary
      .map((d) => {
        const locked = d.unlockAt && new Date(d.unlockAt).getTime() > Date.now() && d.author !== HM.who;
        return `<a class="mini-diary__item" href="diary.html#id=${d.id}">
            <div class="mini-diary__title">${d.mood || "📝"} ${locked ? "一封还没到时间的信" : HM.esc(d.title)}</div>
            <div class="mini-diary__meta">${HM.fmtRelative(d.createdAt)} · ${HM.persona(d.author).name}${locked ? " · 🔒 未到解锁时间" : ""}</div>
          </a>`;
      })
      .join("");
  }

  /* ---------- 今日打卡 ---------- */
  const today = HM.todayStr();

  function todayRec() {
    let rec = S.checkins.find((c) => c.date === today);
    if (!rec) {
      rec = { date: today, tasks: [], mood: "", note: "" };
      S.checkins.push(rec);
    }
    return rec;
  }

  function streak() {
    let count = 0;
    const d = new Date();
    if (!S.checkins.some((c) => c.date === HM.todayStr() && c.tasks.length)) {
      d.setDate(d.getDate() - 1);
    }
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const rec = S.checkins.find((c) => c.date === key && c.tasks.length);
      if (!rec) break;
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  const tasksBox = document.getElementById("homeTasks");
  const moodBox = document.getElementById("homeMood");
  const moodWeatherBox = document.getElementById("moodWeather");

  const MOOD_SCORE = { "😍": 2, "😊": 2, "🥰": 2, "😐": 0, "🥲": -1, "😤": -2 };

  /** 两个人的心情合成今天的天气 */
  function renderMoodWeather() {
    if (!moodWeatherBox) return;
    const rec = S.checkins.find((c) => c.date === today);
    const mine = HM.moodGet(rec, HM.who);
    const theirs = HM.moodGet(rec, HM.who === "me" ? "her" : "me");
    const partnerName = HM.partner().name;

    if (!mine && !theirs) {
      moodWeatherBox.innerHTML = `
        <div class="mood-weather__head"><span>🌫️</span><b>情绪气象：还没人记心情</b></div>
        <p class="mood-weather__sub">点上面的表情，今天你们的心情会变成一种天气</p>`;
      return;
    }

    const scoreMine = MOOD_SCORE[mine] ?? null;
    const scoreTheirs = MOOD_SCORE[theirs] ?? null;
    const scores = [scoreMine, scoreTheirs].filter((v) => v !== null);
    const min = Math.min(...scores);

    let icon = "🌤️";
    let title = "微风";
    let tip = "平平淡淡也很好，日子本来就是这样的。";

    if (min <= -2) {
      icon = "⛈️";
      title = "雷阵雨";
      tip = "今天有点雷阵雨，先别讲道理，抱一下就好。";
    } else if (min <= -1) {
      icon = "🌧️";
      title = "小雨";
      tip = `给${partnerName}发一句「我在」，比什么都管用。`;
    } else if (scores.length === 2 && scores.every((v) => v >= 2)) {
      icon = "☀️";
      title = "晴天";
      tip = "你们今天都在发光，记得把这份好心情存下来。";
    } else if (scores.length === 1) {
      icon = "🌤️";
      title = "半晴";
      tip = "还有一个人没记心情，去问问 TA 今天怎么样。";
    }

    const both = mine && theirs
      ? `你 ${mine} · ${partnerName} ${theirs}`
      : mine
      ? `你 ${mine} · 等 ${partnerName} 记录`
      : `${partnerName} ${theirs} · 等你自己`;

    moodWeatherBox.innerHTML = `
      <div class="mood-weather__head"><span>${icon}</span><b>情绪气象：${title}</b></div>
      <p class="mood-weather__sub">${both}</p>
      <p class="mood-weather__sub">${tip}</p>`;
  }

  function renderCheckin() {
    const rec = todayRec();
    tasksBox.innerHTML = S.tasks
      .map(
        (t) =>
          `<button type="button" class="chip-task ${rec.tasks.includes(t.id) ? "is-on" : ""}" data-task="${t.id}">${t.emoji} ${HM.esc(t.name)}</button>`
      )
      .join("");

    const streakDays = streak();
    const myMood = HM.moodGet(rec, HM.who);
    moodBox.innerHTML =
      MOODS.map(
        (m) => `<button type="button" class="mood-dot ${myMood === m[0] ? "is-on" : ""}" data-mood="${m[0]}" title="${m[1]}">${m[0]}</button>`
      ).join("") + (streakDays > 1 ? `<span class="pill pill--ok">连续 ${streakDays} 天</span>` : "");

    renderMoodWeather();
  }

  tasksBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-task]");
    if (!btn) return;
    const rec = todayRec();
    const id = btn.dataset.task;
    const idx = rec.tasks.indexOf(id);
    if (idx >= 0) rec.tasks.splice(idx, 1);
    else rec.tasks.push(id);
    HM.save();
    renderCheckin();

    if (rec.tasks.length) {
      const got = HM.bank.award("checkin_day", { refKey: `checkin_day:${today}` });
      const all = rec.tasks.length === S.tasks.length ? HM.bank.award("checkin_all", { refKey: `checkin_all:${today}` }) : 0;
      if (got + all > 0) HM.toast(`+${got + all} 积分 ♡`);
    }
  });

  moodBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mood]");
    if (!btn) return;
    const rec = todayRec();
    const cur = HM.moodGet(rec, HM.who);
    HM.moodSet(rec, HM.who, cur === btn.dataset.mood ? "" : btn.dataset.mood);
    HM.save();
    renderCheckin();
  });

  renderCheckin();

  /* ---------- 券包 ---------- */
  const bank = HM.bank;
  const partnerKey = HM.who === "me" ? "her" : "me";
  const myAcc = bank.account(HM.who);

  document.getElementById("homeBalance").textContent = `${myAcc.balance} 积分`;
  document.getElementById("homeTheirCount").textContent = `${bank.couponsOf(partnerKey, "active").length} 张可用`;

  function miniCoupons(list, emptyText) {
    if (!list.length) return `<p class="hint" style="padding:6px 0">${emptyText}</p>`;
    return list
      .slice(0, 2)
      .map(
        (c) => `<a class="coupon-mini" href="bank.html">
            <span class="coupon-mini__emoji">${c.emoji || "🎟"}</span>
            <span class="coupon-mini__body">
              <b>${HM.esc(c.title)}</b>
              <small>来自 ${HM.persona(c.from).name} · ${c.price} 分</small>
            </span>
            <span class="coupon-mini__go">›</span>
          </a>`
      )
      .join("");
  }

  document.getElementById("homeMyCoupons").innerHTML = miniCoupons(
    bank.couponsOf(HM.who, "active"),
    "还没有可用的券"
  );
  document.getElementById("homeTheirCoupons").innerHTML = miniCoupons(
    bank.couponsOf(partnerKey, "active"),
    "还没有发给对方的券"
  );

  /* ---------- 回忆盲盒 ---------- */
  const memoryBox = document.getElementById("memoryBox");
  const memoryHint = document.getElementById("memoryHint");

  function memoryPool() {
    const pool = [];

    S.albums.forEach((al) => {
      (al.photos || []).forEach((p) => {
        pool.push({
          key: `photo:${p.id}`,
          icon: "📷",
          title: (p.name || "一张照片").replace(/\.[^.]+$/, ""),
          from: `相册「${al.name}」`,
          src: p.src || "",
          at: p.addedAt || al.createdAt || Date.now(),
          href: `albums.html#id=${al.id}`,
        });
      });
    });

    S.diary
      .filter((d) => d.visibility !== "private" || d.author === HM.who)
      .forEach((d) => {
        pool.push({
          key: `diary:${d.id}`,
          icon: d.mood || "📖",
          title: d.title,
          from: `日记 · ${HM.persona(d.author).name}`,
          src: "",
          at: d.createdAt,
          href: `diary.html#id=${d.id}`,
        });
      });

    S.wishes
      .filter((w) => w.status === "done")
      .forEach((w) => {
        pool.push({
          key: `wish:${w.id}`,
          icon: "🌠",
          title: w.title,
          from: "已完成的愿望",
          src: "",
          at: w.doneAt || w.createdAt,
          href: "wishes.html",
        });
      });

    return pool;
  }

  function renderMemory(item) {
    const days = HM.daysBetween(new Date(item.at), new Date());
    const age = days <= 0 ? "就在今天" : `${days} 天前的今天`;

    memoryBox.innerHTML = `
      <div class="memory">
        <div class="memory__thumb">${item.src ? `<img src="${item.src}" alt="" />` : item.icon}</div>
        <div class="memory__body">
          <div class="memory__age">🕰 ${age}</div>
          <div class="memory__title">${HM.esc(item.title)}</div>
          <div class="memory__from">${HM.esc(item.from)} · ${HM.fmtDate(new Date(item.at), true)}</div>
          <div class="memory__acts">
            <a class="btn btn--soft btn--sm" href="${item.href}">回去看看</a>
            <button class="btn btn--ghost btn--sm" type="button" id="memoryNext">换一个 ↻</button>
          </div>
        </div>
      </div>`;

    const next = document.getElementById("memoryNext");
    if (next) next.addEventListener("click", () => pickMemory(true));
  }

  function pickMemory(force) {
    const pool = memoryPool();

    if (!pool.length) {
      memoryBox.innerHTML = `<div class="memory__empty">还没有可以翻的回忆，去传张照片、写篇日记，或者完成一个愿望吧 ♡</div>`;
      if (memoryHint) memoryHint.textContent = "";
      return;
    }

    // 同一天保持同一份回忆，点「换一个」才重新抽
    const todayPick = S.memoryToday;
    if (!force && todayPick && todayPick.date === today) {
      const hit = pool.find((i) => i.key === todayPick.key);
      if (hit) {
        renderMemory(hit);
        return;
      }
    }

    const seen = new Set(Array.isArray(S.memoriesSeen) ? S.memoriesSeen : []);
    let candidates = pool.filter((i) => !seen.has(i.key));
    if (!candidates.length) {
      // 全部翻过了，重新开始
      S.memoriesSeen = [];
      candidates = pool;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    S.memoriesSeen = (Array.isArray(S.memoriesSeen) ? S.memoriesSeen : []).concat(pick.key).slice(-80);
    S.memoryToday = { date: today, key: pick.key };
    HM.save();

    if (memoryHint) {
      memoryHint.textContent = `已翻过 ${S.memoriesSeen.length} 段`;
    }
    renderMemory(pick);
  }

  /* ---------- 情话 ---------- */
  const quoteEl = document.getElementById("quoteText");
  let lastQuote = 0;
  const btnQuote = document.getElementById("quoteBtn");
  quoteEl.textContent = QUOTES[0];
  btnQuote.addEventListener("click", () => {
    let next = Math.floor(Math.random() * QUOTES.length);
    while (next === lastQuote) next = Math.floor(Math.random() * QUOTES.length);
    lastQuote = next;
    quoteEl.style.opacity = "0";
    setTimeout(() => {
      quoteEl.textContent = QUOTES[next];
      quoteEl.style.opacity = "1";
    }, 180);
  });

  pickMemory();
});
