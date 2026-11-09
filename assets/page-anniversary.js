/* 纪念日：列表 / 创建 / 编辑 / 删除 / 每年重复 */
HM.page(function (HM) {
  const S = HM.state;
  const listEl = document.getElementById("list");

  function rows() {
    return S.anniversaries
      .map((a) => {
        const next = HM.nextOccurrence(a);
        const days = next ? HM.daysBetween(new Date(), next) : 9999;
        return Object.assign({}, a, { next, days });
      })
      .sort((a, b) => {
        // 已经过去的「一次性纪念日」排在最后
        const aPast = a.days < 0;
        const bPast = b.days < 0;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? b.days - a.days : a.days - b.days;
      });
  }

  function render() {
    const data = rows();

    if (!data.length) {
      listEl.innerHTML = `
        <div class="empty">
          <b>🎂</b>
          还没有纪念日，添加第一个吧<br />
          <button class="btn btn--soft btn--sm" type="button" id="emptyAdd" style="margin-top:14px">+ 新建纪念日</button>
        </div>`;
      const e = document.getElementById("emptyAdd");
      if (e) e.addEventListener("click", () => openForm());
      return;
    }

    const first = data[0];
    listEl.innerHTML = data
      .map((a) => {
        const past = a.days < 0;
        const isNext = a.id === first.id && !past;
        const times = a.yearly ? a.next.getFullYear() - new Date(a.date).getFullYear() + 1 : 1;
        const badgeNum = a.days === 0 ? "今" : Math.abs(a.days);
        const badgeUnit = past ? "天前" : a.days === 0 ? "就是今天" : "天后";
        return `
        <article class="anniv ${isNext ? "is-next" : ""} ${past ? "is-past" : ""}">
          <div class="anniv__badge">
            <b>${badgeNum}</b>
            <small>${badgeUnit}</small>
          </div>
          <div class="anniv__body">
            <div class="anniv__title">
              ${HM.esc(a.title)}
              ${a.yearly ? '<span class="pill">每年重复</span>' : '<span class="pill pill--mute">仅一次</span>'}
              ${a.days === 0 ? '<span class="pill pill--warn">今天</span>' : ""}
              ${past ? '<span class="pill pill--mute">已过去</span>' : ""}
            </div>
            <div class="anniv__meta">
              ${
                past
                  ? `发生在 ${HM.fmtDate(a.date, true)} · 已经过去 ${Math.abs(a.days)} 天`
                  : `下一次 ${HM.fmtDate(a.next, true)}${a.yearly ? ` · 第 ${times} 次` : ""} · 起始 ${HM.fmtDate(a.date, true)}`
              }
            </div>
            ${a.note ? `<div class="anniv__note">${HM.esc(a.note)}</div>` : ""}
          </div>
          <div class="row__side">
            <button class="btn btn--ghost btn--sm" type="button" data-edit="${a.id}">编辑</button>
            <button class="btn btn--danger btn--sm" type="button" data-del="${a.id}">删除</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function openForm(item) {
    const isEdit = Boolean(item);
    const a = item || { title: "", date: HM.todayStr(), yearly: true, note: "" };

    HM.modal({
      title: isEdit ? "编辑纪念日" : "新建纪念日",
      html: `
        <div class="field">
          <label for="fTitle">名称</label>
          <input class="input" id="fTitle" maxlength="20" placeholder="例如：在一起的纪念日" value="${HM.attr(a.title)}" />
        </div>
        <div class="row-2">
          <div class="field">
            <label for="fDate">日期</label>
            <input class="input" id="fDate" type="date" value="${HM.attr(a.date)}" />
          </div>
          <div class="field">
            <label>重复</label>
            <label class="check" style="height:42px">
              <input type="checkbox" id="fYearly" ${a.yearly ? "checked" : ""} />
              <i>✓</i> 每年重复计算
            </label>
          </div>
        </div>
        <div class="field">
          <label for="fNote">备注（可选）</label>
          <input class="input" id="fNote" maxlength="50" placeholder="想提醒对方的一句话" value="${HM.attr(a.note || "")}" />
        </div>
        <p class="hint">勾选「每年重复」后，倒计时会自动算到下一年同一天。</p>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: isEdit ? "保存" : "创建",
          onClick: (body, close) => {
            const title = body.querySelector("#fTitle").value.trim();
            const date = body.querySelector("#fDate").value;
            const yearly = body.querySelector("#fYearly").checked;
            const note = body.querySelector("#fNote").value.trim();

            if (!title) {
              HM.toast("给它起个名字吧");
              return;
            }
            if (!date) {
              HM.toast("选一个日期");
              return;
            }

            if (isEdit) {
              Object.assign(item, { title, date, yearly, note });
            } else {
              S.anniversaries.push({ id: HM.uid(), title, date, yearly, note });
            }
            HM.save();
            close();
            render();
            HM.toast(isEdit ? "改好啦 ♡" : "记下了 ♡");
          },
        },
      ],
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm());

  listEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");

    if (editBtn) {
      const item = S.anniversaries.find((a) => a.id === editBtn.dataset.edit);
      if (item) openForm(item);
      return;
    }

    if (delBtn) {
      const item = S.anniversaries.find((a) => a.id === delBtn.dataset.del);
      if (!item) return;
      const ok = await HM.confirm({
        title: "删除这个纪念日？",
        text: `「${item.title}」会被永久删掉，这一步不能撤销。`,
        okText: "删除",
        danger: true,
      });
      if (!ok) return;
      S.anniversaries = S.anniversaries.filter((a) => a.id !== item.id);
      HM.save();
      render();
      HM.toast("已删除");
    }
  });

  render();
});
