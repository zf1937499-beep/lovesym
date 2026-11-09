/* 愿望：卡片列表 / 创建 / 编辑 / 认领 / 完成 */
HM.page(function (HM) {
  const S = HM.state;
  const listEl = document.getElementById("list");
  let filter = "all";

  const STATUS = {
    open: { label: "待认领", cls: "pill" },
    claimed: { label: "进行中", cls: "pill pill--warn" },
    done: { label: "已完成", cls: "pill pill--ok" },
  };

  function render() {
    const data = S.wishes
      .filter((w) => (filter === "all" ? true : w.status === filter))
      .sort((a, b) => {
        const order = { claimed: 0, open: 1, done: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    if (!data.length) {
      listEl.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <b>🌠</b>
          ${filter === "all" ? "还没有愿望，说说想一起做什么吧" : "这个分类下还没有愿望"}<br />
          <button class="btn btn--soft btn--sm" type="button" id="emptyAdd" style="margin-top:14px">+ 许个愿</button>
        </div>`;
      const b = document.getElementById("emptyAdd");
      if (b) b.addEventListener("click", () => openForm());
      return;
    }

    listEl.innerHTML = data
      .map((w) => {
        const st = STATUS[w.status] || STATUS.open;
        const claimedByMe = w.claimedBy === HM.who;
        const claimerName = w.claimedBy ? HM.persona(w.claimedBy).name : "";
        const mine = w.author === HM.who || !w.author;

        let acts = "";
        if (w.status === "open") {
          acts = `<button class="btn btn--soft btn--sm" type="button" data-claim="${w.id}">我来认领</button>`;
        } else if (w.status === "claimed") {
          acts = `
            ${claimedByMe ? `<button class="btn btn--ghost btn--sm" type="button" data-release="${w.id}">放弃</button>` : ""}
            <button class="btn btn--soft btn--sm" type="button" data-done="${w.id}">标记完成</button>`;
        } else {
          acts = `<button class="btn btn--ghost btn--sm" type="button" data-reopen="${w.id}">重新打开</button>`;
        }

        acts += `
          <button class="btn btn--ghost btn--sm" type="button" data-edit="${w.id}">编辑</button>
          <button class="btn btn--danger btn--sm" type="button" data-del="${w.id}">删除</button>`;

        return `
        <article class="wish ${w.status === "done" ? "is-done" : ""}">
          <div class="wish__title">
            <span>${w.status === "done" ? "✅" : w.status === "claimed" ? "✨" : "🌠"}</span>
            <span>${HM.esc(w.title)}</span>
          </div>
          <div><span class="${st.cls}">${st.label}${claimerName ? ` · ${claimerName}` : ""}</span></div>
          ${w.desc ? `<p class="wish__desc">${HM.esc(w.desc)}</p>` : `<p class="wish__desc"></p>`}
          <div class="wish__foot">
            <span class="hint">${HM.fmtRelative(w.createdAt)}</span>
            <div class="wish__acts">${acts}</div>
          </div>
        </article>`;
      })
      .join("");
  }

  function openForm(item) {
    const isEdit = Boolean(item);
    const w = item || { title: "", desc: "" };

    HM.modal({
      title: isEdit ? "编辑愿望" : "许个愿",
      html: `
        <div class="field">
          <label for="wTitle">想做的事</label>
          <input class="input" id="wTitle" maxlength="30" placeholder="例如：一起看一次日出" value="${HM.attr(w.title)}" />
        </div>
        <div class="field">
          <label for="wDesc">补充说明（可选）</label>
          <textarea class="textarea" id="wDesc" maxlength="140" style="min-height:90px" placeholder="想怎么实现？有没有想去的地方？">${HM.esc(w.desc || "")}</textarea>
        </div>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: isEdit ? "保存" : "创建",
          onClick: (body, close) => {
            const title = body.querySelector("#wTitle").value.trim();
            if (!title) {
              HM.toast("写点具体的事吧");
              return;
            }
            const desc = body.querySelector("#wDesc").value.trim();
            if (isEdit) {
              Object.assign(item, { title, desc });
            } else {
              S.wishes.push({ id: HM.uid(), title, desc, status: "open", claimedBy: "", author: HM.who, createdAt: Date.now() });
            }
            HM.save();
            close();
            render();
            HM.toast(isEdit ? "改好了 ♡" : "愿望记下啦 ♡");
          },
        },
      ],
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm());

  document.getElementById("seg").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-f]");
    if (!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("is-on", b === btn));
    render();
  });

  listEl.addEventListener("click", async (e) => {
    const t = e.target;
    const find = (id) => S.wishes.find((w) => w.id === id);

    const claimBtn = t.closest("[data-claim]");
    if (claimBtn) {
      const w = find(claimBtn.dataset.claim);
      w.status = "claimed";
      w.claimedBy = HM.who;
      HM.save();
      render();
      HM.toast("认领成功，一起加油 ♡");
      return;
    }

    const releaseBtn = t.closest("[data-release]");
    if (releaseBtn) {
      const w = find(releaseBtn.dataset.release);
      w.status = "open";
      w.claimedBy = "";
      HM.save();
      render();
      HM.toast("已放回待认领");
      return;
    }

    const doneBtn = t.closest("[data-done]");
    if (doneBtn) {
      const w = find(doneBtn.dataset.done);
      w.status = "done";
      w.doneAt = Date.now();
      HM.save();
      render();
      const got = HM.bank.award("wish_done", { refKey: `wish:${w.id}` });
      HM.toast(got ? `完成一件，+${got} 积分 🎉` : "完成一件，好耶 🎉");
      return;
    }

    const reopenBtn = t.closest("[data-reopen]");
    if (reopenBtn) {
      const w = find(reopenBtn.dataset.reopen);
      w.status = w.claimedBy ? "claimed" : "open";
      HM.save();
      render();
      return;
    }

    const editBtn = t.closest("[data-edit]");
    if (editBtn) {
      openForm(find(editBtn.dataset.edit));
      return;
    }

    const delBtn = t.closest("[data-del]");
    if (delBtn) {
      const w = find(delBtn.dataset.del);
      const ok = await HM.confirm({
        title: "删除这个愿望？",
        text: `「${w.title}」会被删掉。`,
        okText: "删除",
        danger: true,
      });
      if (!ok) return;
      S.wishes = S.wishes.filter((x) => x.id !== w.id);
      HM.save();
      render();
      HM.toast("已删除");
    }
  });

  /* ---- AI 约会策划 ---- */
  const PLAN_TAGS = ["吃海鲜", "安静", "拍照", "户外", "逛街", "看电影", "咖啡"];

  document.getElementById("aiPlanBtn").addEventListener("click", () => {
    if (!HM.ai) {
      HM.toast("AI 还没接上，先手动写吧");
      return;
    }
    openPlanner();
  });

  function openPlanner() {
    const picked = new Set(["吃海鲜"]);

    HM.modal({
      title: "✨ AI 策划约会",
      html: `
        <div class="row-2">
          <div class="field">
            <label for="plCity">城市</label>
            <select class="select" id="plCity">
              <option value="寿光">寿光</option>
              <option value="临海">临海</option>
              <option value="__other">其他</option>
            </select>
          </div>
          <div class="field">
            <label for="plBudget">人均预算（元）</label>
            <input class="input" id="plBudget" type="number" min="0" max="3000" value="200" />
          </div>
        </div>
        <div class="field" id="plOtherField" hidden>
          <label for="plCityOther">城市名</label>
          <input class="input" id="plCityOther" maxlength="12" placeholder="例如：杭州西湖区" />
        </div>
        <div class="field">
          <label>偏好（可多选）</label>
          <div class="chip-row" id="plTags">
            ${PLAN_TAGS.map(
              (t) => `<button class="chip-task ${picked.has(t) ? "is-on" : ""}" type="button" data-tag="${t}">${t}</button>`
            ).join("")}
          </div>
        </div>
        <p class="hint">只会给具体能执行的安排，不会有"感受当地氛围"这种空话。</p>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "生成行程",
          onClick: async (body, close) => {
            const sel = body.querySelector("#plCity").value;
            const city = sel === "__other" ? body.querySelector("#plCityOther").value.trim() : sel;
            if (!city) {
              HM.toast("填一下城市名");
              return;
            }
            const budget = Number(body.querySelector("#plBudget").value) || 200;
            const tags = Array.from(picked);

            const res = await HM.ai.post("date", { city, budget, tags });
            if (!res.ok) {
              HM.toast(HM.ai.failMessage(res));
              return;
            }
            close();
            showPlan(res.data);
          },
        },
      ],
      onMount(body) {
        const citySel = body.querySelector("#plCity");
        const otherField = body.querySelector("#plOtherField");
        citySel.addEventListener("change", () => {
          otherField.hidden = citySel.value !== "__other";
          if (!otherField.hidden) body.querySelector("#plCityOther").focus();
        });

        body.querySelector("#plTags").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-tag]");
          if (!btn) return;
          const t = btn.dataset.tag;
          if (picked.has(t)) {
            picked.delete(t);
            btn.classList.remove("is-on");
          } else {
            picked.add(t);
            btn.classList.add("is-on");
          }
        });
      },
    });
  }

  function showPlan(plan) {
    const nodes = plan.nodes || [];

    HM.modal({
      title: `🗺 ${plan.title}`,
      html: `
        <div class="plan">
          ${nodes
            .map(
              (n) => `
            <div class="plan__node">
              <time class="plan__time">${HM.esc(n.time)}</time>
              <div class="plan__body">
                <div class="plan__title">${HM.esc(n.title)}</div>
                ${n.detail ? `<p class="plan__detail">${HM.esc(n.detail)}</p>` : ""}
                ${n.cost ? `<span class="plan__cost">${HM.esc(n.cost)}</span>` : ""}
              </div>
            </div>`
            )
            .join("")}
        </div>
        <p class="hint" style="margin-top:12px">AI 只做参考，地点和价格记得自己核对一下。</p>
      `,
      footer: [
        { text: "先不存", variant: "ghost" },
        {
          text: "全部加入愿望清单",
          onClick: (body, close) => {
            nodes.forEach((n) => {
              S.wishes.push({
                id: HM.uid(),
                title: `约会 · ${n.title}`.slice(0, 30),
                desc: `${n.time} ${n.detail}${n.cost ? `（${n.cost}）` : ""}`.slice(0, 140),
                status: "open",
                claimedBy: "",
                author: HM.who,
                createdAt: Date.now(),
              });
            });
            HM.save();
            close();
            render();
            HM.toast(`已加入 ${nodes.length} 个待办 ♡`);
          },
        },
      ],
    });
  }

  render();
});
