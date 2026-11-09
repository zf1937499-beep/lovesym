/* 打卡心情：预设任务 / 今日心情 / 连续统计 */
HM.page(function (HM) {
  const S = HM.state;
  const today = HM.todayStr();

  const MOODS = [
    ["😍", "甜到冒泡"],
    ["😊", "开心"],
    ["🥰", "心动"],
    ["😐", "平静"],
    ["🥲", "有点 emo"],
    ["😤", "小别扭"],
  ];

  const taskList = document.getElementById("taskList");
  const moodGrid = document.getElementById("moodGrid");
  const noteEl = document.getElementById("note");
  const countLabel = document.getElementById("countLabel");

  function rec() {
    let r = S.checkins.find((c) => c.date === today);
    if (!r) {
      r = { date: today, tasks: [], mood: "", note: "" };
      S.checkins.push(r);
    }
    return r;
  }

  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function streak() {
    let count = 0;
    const d = new Date();
    const hasToday = S.checkins.some((c) => c.date === today && c.tasks.length);
    if (!hasToday) d.setDate(d.getDate() - 1);

    for (;;) {
      const key = iso(d);
      const hit = S.checkins.find((c) => c.date === key && c.tasks.length);
      if (!hit) break;
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function renderTasks() {
    const r = rec();
    taskList.innerHTML = S.tasks
      .map(
        (t) => `
        <button class="task ${r.tasks.includes(t.id) ? "on" : ""}" type="button" data-task="${t.id}">
          <span class="task__tick">✓</span>
          <span class="task__emoji">${t.emoji}</span>
          <span class="task__name">${HM.esc(t.name)}</span>
          ${t.custom ? `<span class="hint" data-rm="${t.id}" style="padding:0 4px">✕</span>` : ""}
        </button>`
      )
      .join("");

    countLabel.textContent = `${r.tasks.length} / ${S.tasks.length} 完成`;
  }

  function renderMood() {
    const r = rec();
    const myMood = HM.moodGet(r, HM.who);
    moodGrid.innerHTML = MOODS.map(
      (m) => `<button class="mood-btn ${myMood === m[0] ? "is-on" : ""}" type="button" data-mood="${m[0]}">
          <b>${m[0]}</b><span>${m[1]}</span>
        </button>`
    ).join("");
    noteEl.value = r.note || "";
  }

  function renderStats() {
    const done = S.checkins.filter((c) => c.tasks && c.tasks.length);
    document.getElementById("streakNum").textContent = streak();
    document.getElementById("totalNum").textContent = done.length;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("monthNum").textContent = done.filter((c) => c.date.startsWith(monthKey)).length;

    const heat = document.getElementById("heat");
    const cells = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = iso(d);
      const c = S.checkins.find((x) => x.date === key);
      const n = c ? c.tasks.length : 0;
      let lv = "";
      if (n >= 5) lv = "lv3";
      else if (n >= 3) lv = "lv2";
      else if (n >= 1) lv = "lv1";
      cells.push(`<i class="${lv} ${key === today ? "today" : ""}" title="${key} · ${n} 项"></i>`);
    }
    heat.innerHTML = cells.join("");
  }

  /* 任务点击 */
  taskList.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      e.stopPropagation();
      const id = rm.dataset.rm;
      S.tasks = S.tasks.filter((t) => t.id !== id);
      S.checkins.forEach((c) => {
        c.tasks = (c.tasks || []).filter((t) => t !== id);
      });
      HM.save();
      renderTasks();
      renderStats();
      HM.toast("任务已移除");
      return;
    }

    const btn = e.target.closest("[data-task]");
    if (!btn) return;
    const r = rec();
    const id = btn.dataset.task;
    const idx = r.tasks.indexOf(id);
    if (idx >= 0) r.tasks.splice(idx, 1);
    else r.tasks.push(id);
    HM.save();
    renderTasks();
    renderStats();

    // 完成打卡赚积分（每天只发一次）
    if (r.tasks.length) {
      const got = HM.bank.award("checkin_day", { refKey: `checkin_day:${today}` });
      const all = r.tasks.length === S.tasks.length ? HM.bank.award("checkin_all", { refKey: `checkin_all:${today}` }) : 0;
      const total = got + all;
      if (total > 0) {
        HM.toast(all ? `全部完成 +${total} 积分 ♡` : `打卡成功 +${total} 积分`);
      }
    }
  });

  /* 心情 */
  moodGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mood]");
    if (!btn) return;
    const r = rec();
    const cur = HM.moodGet(r, HM.who);
    HM.moodSet(r, HM.who, cur === btn.dataset.mood ? "" : btn.dataset.mood);
    HM.save();
    renderMood();
  });

  /* 备注（防抖保存） */
  let noteTimer = null;
  noteEl.addEventListener("input", () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      rec().note = noteEl.value.trim();
      HM.save();
    }, 400);
  });

  /* 自定义任务 */
  document.getElementById("addTask").addEventListener("click", () => {
    HM.modal({
      title: "添加自定义任务",
      size: "sm",
      html: `
        <div class="row-2">
          <div class="field">
            <label for="tEmoji">图标</label>
            <input class="input" id="tEmoji" maxlength="2" value="💗" />
          </div>
          <div class="field" style="grid-column:span 1">
            <label for="tName">任务名</label>
            <input class="input" id="tName" maxlength="12" placeholder="例如：一起看电影" />
          </div>
        </div>
        <p class="hint">自定义任务只属于你们，可以随时删掉。</p>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "添加",
          onClick: (body, close) => {
            const name = body.querySelector("#tName").value.trim();
            if (!name) {
              HM.toast("写个名字吧");
              return;
            }
            S.tasks.push({
              id: "c" + HM.uid(),
              emoji: body.querySelector("#tEmoji").value.trim() || "💗",
              name,
              custom: true,
            });
            HM.save();
            close();
            renderTasks();
            renderStats();
            HM.toast("加好啦 ♡");
          },
        },
      ],
    });
  });

  /* 头部问候 */
  const hour = new Date().getHours();
  const greet =
    hour < 6 ? "还没睡呀，早点休息" : hour < 11 ? "早上好，今天也一起加油" : hour < 14 ? "午饭时间到，记得好好吃饭" : hour < 19 ? "下午好，今天也想你" : "晚上好，睡前记得说晚安";
  document.getElementById("headSub").textContent = greet;

  renderTasks();
  renderMood();
  renderStats();
});
