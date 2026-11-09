/* 日记：列表筛选 / Markdown 编辑 / 详情 / 可见性 / 定时解锁 */
HM.page(function (HM) {
  const S = HM.state;
  const listEl = document.getElementById("list");
  const searchEl = document.getElementById("search");

  let filter = "all";
  let keyword = "";

  const MOODS = ["😍", "😊", "🥰", "😐", "🥲", "😤", "💌", "🌙"];

  /* ---------------- 工具 ---------------- */
  function isLocked(d) {
    return Boolean(d.unlockAt) && new Date(d.unlockAt).getTime() > Date.now() && d.author !== HM.who;
  }

  function canSee(d) {
    if (d.author === HM.who) return true;
    return d.visibility !== "private";
  }

  function visibleList() {
    return S.diary
      .filter(canSee)
      .filter((d) => {
        if (filter === "mine") return d.author === HM.who;
        if (filter === "partner") return d.author !== HM.who;
        if (filter === "private") return d.visibility === "private";
        return true;
      })
      .filter((d) => {
        if (!keyword) return true;
        const k = keyword.toLowerCase();
        return (
          (d.title || "").toLowerCase().includes(k) || (d.content || "").toLowerCase().includes(k)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  /* ---------------- 列表 ---------------- */
  function render() {
    const data = visibleList();

    if (!data.length) {
      listEl.innerHTML = `
        <div class="empty">
          <b>📖</b>
          ${keyword ? "没有找到匹配的日记" : "这里还空着，写下第一篇吧"}<br />
          <button class="btn btn--soft btn--sm" type="button" id="emptyWrite" style="margin-top:14px">✎ 写日记</button>
        </div>`;
      const b = document.getElementById("emptyWrite");
      if (b) b.addEventListener("click", () => openEditor());
      return;
    }

    listEl.innerHTML = data
      .map((d) => {
        const locked = isLocked(d);
        const mine = d.author === HM.who;
        const plain = (d.content || "").replace(/[#>*`\-]/g, "").replace(/\n+/g, " ").trim();
        return `
        <article class="diary" data-open="${d.id}">
          <div class="diary__top">
            <span class="diary__mood">${d.mood || "📝"}</span>
            <h2 class="diary__title" style="font-size:1rem">${locked ? "一封还没到时间的信" : HM.esc(d.title)}</h2>
            ${
              d.visibility === "private"
                ? '<span class="pill pill--soft">仅自己</span>'
                : '<span class="pill">双方可见</span>'
            }
            ${locked ? '<span class="pill pill--warn">🔒 未解锁</span>' : ""}
          </div>
          <div class="diary__date">${HM.fmtDateTime(d.createdAt)} · ${HM.persona(d.author).name}</div>
          <p class="diary__excerpt">${locked ? "对方设置了定时解锁，到时间才能看。" : HM.esc(plain)}</p>
          <div class="diary__foot">
            ${mine ? `<span class="pill pill--mute">我写的</span>` : `<span class="pill pill--mute">${HM.persona(d.author).name} 写的</span>`}
            ${d.updatedAt && d.updatedAt !== d.createdAt ? `<span>· 编辑于 ${HM.fmtRelative(d.updatedAt)}</span>` : ""}
            ${d.unlockAt ? `<span>· 解锁于 ${HM.fmtDateTime(new Date(d.unlockAt).getTime())}</span>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  /* ---------------- 详情 ---------------- */
  function openDetail(id) {
    const d = S.diary.find((x) => x.id === id);
    if (!d || !canSee(d)) return;

    const locked = isLocked(d);
    const mine = d.author === HM.who;

    HM.modal({
      title: locked ? "🔒 还没到解锁时间" : d.title,
      html: locked
        ? `<div class="locked">
             <b>💌</b>
             <div>这封信要等到 <strong>${HM.fmtDateTime(new Date(d.unlockAt).getTime())}</strong> 才能打开</div>
             <div class="hint">写信的人：${HM.persona(d.author).name}</div>
           </div>`
        : `<div class="diary__date" style="margin-bottom:14px">
             ${HM.fmtDateTime(d.createdAt)} · ${HM.persona(d.author).name} ·
             ${d.visibility === "private" ? "仅自己可见" : "双方可见"}
             ${d.unlockAt ? ` · 解锁于 ${HM.fmtDateTime(new Date(d.unlockAt).getTime())}` : ""}
           </div>
           <div class="md">${HM.md(d.content)}</div>`,
      footer: mine
        ? [
            {
              text: "删除",
              variant: "danger",
              onClick: async (body, close) => {
                close();
                const ok = await HM.confirm({
                  title: "删除这篇日记？",
                  text: "删掉就找不回来了。",
                  okText: "删除",
                  danger: true,
                });
                if (!ok) return;
                S.diary = S.diary.filter((x) => x.id !== d.id);
                HM.save();
                render();
                HM.toast("已删除");
              },
            },
            {
              text: "编辑",
              variant: "ghost",
              onClick: (body, close) => {
                close();
                openEditor(d);
              },
            },
            { text: "关闭" },
          ]
        : [{ text: "关闭" }],
    });
  }

  /* ---------------- 编辑器 ---------------- */
  function openEditor(entry, prefill) {
    const isEdit = Boolean(entry);
    const blank = {
      title: "",
      content: "",
      mood: "😊",
      visibility: "shared",
      unlockAt: "",
      author: HM.who,
    };
    const d = entry || Object.assign(blank, prefill || {});

    let visibility = d.visibility;
    let mood = d.mood || "😊";

    HM.modal({
      title: isEdit ? "编辑日记" : "写日记",
      html: `
        <div class="field">
          <label for="dTitle">标题</label>
          <input class="input" id="dTitle" maxlength="40" placeholder="今天发生了什么？" value="${HM.attr(d.title)}" />
        </div>

        <div class="field">
          <label>心情</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="moodRow">
            ${MOODS.map(
              (m) => `<button type="button" class="mood-dot ${m === mood ? "is-on" : ""}" data-mood="${m}">${m}</button>`
            ).join("")}
          </div>
        </div>

        <div class="row-2">
          <div class="field">
            <label>谁能看</label>
            <div class="seg" id="visRow">
              <button type="button" data-vis="shared" class="${visibility === "shared" ? "is-on" : ""}">双方可见</button>
              <button type="button" data-vis="private" class="${visibility === "private" ? "is-on" : ""}">仅自己</button>
            </div>
          </div>
          <div class="field">
            <label for="dUnlock">定时解锁（可选）</label>
            <input class="input" id="dUnlock" type="datetime-local" value="${HM.attr(d.unlockAt || "")}" />
          </div>
        </div>
        <p class="hint" style="margin:-6px 0 12px">解锁时间到了对方才能看到内容；你自己可以随时查看。</p>

        <div class="field">
          <label for="dContent">正文（支持 Markdown）</label>
          <div class="md-editor">
            <textarea class="textarea" id="dContent" placeholder="# 今天&#10;&#10;写点什么…&#10;&#10;- 支持列表&#10;- **支持加粗**">${HM.esc(d.content)}</textarea>
            <div class="md-preview md" id="preview"></div>
          </div>
          <p class="hint"># 标题 · **加粗** · *斜体* · - 列表 · &gt; 引用 · \`代码\`</p>
        </div>

        <div class="ai-bar">
          <div class="ai-bar__left">
            <span class="ai-bar__label">✨ AI 只做润色</span>
            <div class="seg seg--sm" id="toneRow">
              <button type="button" data-tone="温柔" class="is-on">温柔</button>
              <button type="button" data-tone="俏皮">俏皮</button>
              <button type="button" data-tone="真诚">真诚</button>
            </div>
          </div>
          <button class="btn btn--soft btn--sm" type="button" id="polishBtn">生成三个版本</button>
        </div>
        <div class="ai-out" id="polishOut"></div>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: isEdit ? "保存" : "发布",
          onClick: (body, close) => {
            const title = body.querySelector("#dTitle").value.trim();
            const content = body.querySelector("#dContent").value.trim();

            if (!title) {
              HM.toast("写个标题吧");
              return;
            }
            if (!content) {
              HM.toast("正文还是空的");
              return;
            }

            const payload = {
              title,
              content,
              mood,
              visibility,
              unlockAt: body.querySelector("#dUnlock").value,
              updatedAt: Date.now(),
            };

            if (isEdit) {
              Object.assign(entry, payload);
            } else {
              payload.id = HM.uid();
              S.diary.push(Object.assign({ author: HM.who, createdAt: Date.now() }, payload));
            }
            HM.save();
            close();
            render();

            if (isEdit) {
              HM.toast("改好了 ♡");
            } else {
              const got = HM.bank.award("diary", { refKey: `diary:${payload.id}` });
              HM.toast(got ? `写下啦 ♡ +${got} 积分` : "写下啦 ♡");
            }
          },
        },
      ],
      onMount(body) {
        const preview = body.querySelector("#preview");
        const content = body.querySelector("#dContent");

        const paint = () => {
          preview.innerHTML = content.value.trim() ? HM.md(content.value) : '<p class="hint">左边写，这里实时预览 ✍️</p>';
        };
        content.addEventListener("input", paint);
        paint();

        body.querySelector("#moodRow").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-mood]");
          if (!btn) return;
          mood = btn.dataset.mood;
          body.querySelectorAll("#moodRow .mood-dot").forEach((b) => b.classList.toggle("is-on", b === btn));
        });

        body.querySelector("#visRow").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-vis]");
          if (!btn) return;
          visibility = btn.dataset.vis;
          body.querySelectorAll("#visRow button").forEach((b) => b.classList.toggle("is-on", b === btn));
        });

        /* ---- AI 润色（只替换草稿，不保存） ---- */
        const toneRow = body.querySelector("#toneRow");
        const polishBtn = body.querySelector("#polishBtn");
        const polishOut = body.querySelector("#polishOut");
        if (!HM.ai) {
          if (polishBtn) polishBtn.disabled = true;
          return;
        }

        let tone = "温柔";
        toneRow.addEventListener("click", (e) => {
          const b = e.target.closest("[data-tone]");
          if (!b) return;
          tone = b.dataset.tone;
          toneRow.querySelectorAll("button").forEach((x) => x.classList.toggle("is-on", x === b));
        });

        polishBtn.addEventListener("click", async () => {
          const draft = content.value.trim();
          if (draft.length < 6) {
            HM.toast("先多写几句，AI 才有东西可润色");
            return;
          }

          polishOut.innerHTML = '<p class="hint">AI 正在读你的句子…</p>';
          const res = await HM.ai.busy(polishBtn, "润色中…", () =>
            HM.ai.post("polish", { text: draft, tone })
          );

          if (!res.ok) {
            polishOut.innerHTML = `<p class="hint">${HM.esc(HM.ai.failMessage(res))}</p>`;
            return;
          }

          polishOut.innerHTML = res.data.versions
            .map(
              (v, i) => `
              <div class="ai-card">
                <p class="ai-card__text">${HM.esc(v)}</p>
                <button class="btn btn--ghost btn--sm" type="button" data-use="${i}">用这个</button>
              </div>`
            )
            .join("");

          polishOut.querySelectorAll("[data-use]").forEach((btn) => {
            btn.addEventListener("click", () => {
              content.value = res.data.versions[Number(btn.dataset.use)];
              content.dispatchEvent(new Event("input"));
              HM.toast("已替换，记得再看一遍 ♡");
            });
          });
        });
      },
    });
  }

  /* ---------------- 事件 ---------------- */
  document.getElementById("writeBtn").addEventListener("click", () => openEditor());

  /* ---- AI 根据今天生成草稿（只进编辑器，不落库） ---- */
  document.getElementById("aiDraftBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!HM.ai) {
      openEditor();
      return;
    }

    // 素材一：两地天气（取不到就跳过）
    let weather = "";
    try {
      const res = await fetch("/api/weather");
      if (res.ok) {
        const data = await res.json();
        weather = (data.cities || [])
          .filter((c) => c.ok && c.now)
          .map((c) => `${c.short} ${c.now.temp}°C ${c.now.text}`)
          .join("；");
      }
    } catch (err) {
      /* 天气失败不影响生成 */
    }

    // 素材二：今天的打卡与心情
    const today = HM.todayStr();
    const rec = S.checkins.find((c) => c.date === today);
    let checkin = "";
    if (rec && rec.tasks && rec.tasks.length) {
      checkin = S.tasks
        .filter((t) => rec.tasks.includes(t.id))
        .map((t) => t.name)
        .join("、");
      const moods = [rec.moods && rec.moods.me, rec.moods && rec.moods.her].filter(Boolean).join(" / ");
      if (moods) checkin += `（心情 ${moods}）`;
    }

    // 素材三：最近一张照片的备注
    const photos = [];
    S.albums.forEach((a) => (a.photos || []).forEach((p) => photos.push({ p, album: a.name })));
    photos.sort((x, y) => (y.p.addedAt || 0) - (x.p.addedAt || 0));
    const photo = photos[0] ? `${photos[0].p.name || "一张照片"}（${photos[0].album}）` : "";

    const res = await HM.ai.busy(btn, "AI 正在写…", () =>
      HM.ai.post("diary", { weather, checkin, photo })
    );

    if (!res.ok) {
      HM.toast(HM.ai.failMessage(res));
      openEditor(); // 降级：照常打开空白编辑器
      return;
    }

    openEditor(null, { content: res.data.draft, mood: "😊" });
    HM.toast("草稿生成好了，改完再保存 ♡");
  });

  document.getElementById("seg").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-f]");
    if (!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("is-on", b === btn));
    render();
  });

  searchEl.addEventListener("input", () => {
    keyword = searchEl.value.trim();
    render();
  });

  listEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-open]");
    if (card) openDetail(card.dataset.open);
  });

  render();

  /* 从首页深链过来时直接打开详情 */
  const m = location.hash.match(/id=([\w-]+)/);
  if (m) openDetail(m[1]);
});
