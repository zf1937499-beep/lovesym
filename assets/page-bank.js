/* 恋爱银行：券包 / 发行 / 使用 / 流水 */
HM.page(function (HM) {
  const bank = HM.bank;
  const me = HM.me();
  const partner = HM.partner();

  const couponPane = document.getElementById("couponPane");
  const txPane = document.getElementById("txPane");
  const cntMine = document.getElementById("cntMine");
  const cntTheirs = document.getElementById("cntTheirs");

  let tab = "mine";

  /* ---------------- 账户 ---------------- */
  function renderAccount() {
    const acc = bank.account(HM.who);
    document.getElementById("myName").textContent = me.name;
    document.getElementById("myAva").textContent = me.initial;
    if (me.avatar) {
      document.getElementById("myAva").style.backgroundImage = `url('${me.avatar}')`;
      document.getElementById("myAva").textContent = "";
    }
    document.getElementById("myBalance").textContent = acc.balance;
    document.getElementById("myEarned").textContent = acc.earned;
    document.getElementById("mySpent").textContent = acc.spent;
  }

  function renderRules() {
    const rows = [
      ["✅", "每日打卡", "+2 / 天"],
      ["🎯", "完成全部打卡任务", "+5 / 天"],
      ["📖", "写一篇日记", "+5（每日上限 15）"],
      ["📷", "上传一张照片", "+1（每日上限 10）"],
      ["🌠", "完成一个愿望", "+3（每日上限 6）"],
    ];
    document.getElementById("rules").innerHTML = rows
      .map((r) => `<li><span>${r[0]}</span><em>${r[1]}</em><b>${r[2]}</b></li>`)
      .join("");
  }

  /* ---------------- 券 ---------------- */
  function couponCard(c, ownerKey) {
    const mine = c.to === HM.who;
    const used = c.status === "used";
    const fromName = HM.persona(c.from).name;
    const toName = HM.persona(c.to).name;

    const acts = [];
    if (mine && !used) acts.push(`<button class="btn btn--sm" type="button" data-use="${c.id}">使用</button>`);
    acts.push(`<button class="btn btn--ghost btn--sm" type="button" data-del="${c.id}">删除</button>`);

    return `
      <article class="coupon ${used ? "is-used" : ""}">
        <div class="coupon__stub">
          <span class="coupon__emoji">${c.emoji || "🎟"}</span>
          <span class="coupon__price">${c.price} 分</span>
        </div>
        <div class="coupon__body">
          <div class="coupon__title">
            ${HM.esc(c.title)}
            ${used ? '<span class="pill pill--mute">已使用</span>' : '<span class="pill">待使用</span>'}
          </div>
          <div class="coupon__from">${fromName} → ${toName}</div>
          ${c.note ? `<p class="coupon__note">「${HM.esc(c.note)}」</p>` : ""}
          ${
            used
              ? `<div class="coupon__used">${HM.fmtDateTime(c.usedAt)} 使用${c.useNote ? ` · ${HM.esc(c.useNote)}` : ""}</div>`
              : `<div class="coupon__used">${HM.fmtRelative(c.createdAt)} 发行</div>`
          }
          <div class="coupon__acts">${acts.join("")}</div>
        </div>
      </article>`;
  }

  function renderCoupons() {
    const targetKey = tab === "mine" ? HM.who : HM.who === "me" ? "her" : "me";
    const list = bank.couponsOf(targetKey);

    cntMine.textContent = bank.couponsOf(HM.who).length;
    cntTheirs.textContent = bank.couponsOf(HM.who === "me" ? "her" : "me").length;

    if (!list.length) {
      couponPane.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <b>🎟</b>
          ${tab === "mine" ? "券包还是空的，等对方发一张，或者自己发一张过去" : "还没有发给对方的券"}<br />
          <button class="btn btn--soft btn--sm" type="button" id="emptyIssue" style="margin-top:14px">+ 发行券</button>
        </div>`;
      const b = document.getElementById("emptyIssue");
      if (b) b.addEventListener("click", openIssue);
      return;
    }

    couponPane.innerHTML = list.map((c) => couponCard(c, targetKey)).join("");
  }

  function renderTx() {
    const rows = bank.data().tx.filter((t) => t.account === HM.who).slice(0, 40);
    if (!rows.length) {
      txPane.innerHTML = `<div class="empty"><b>📜</b>还没有任何记录</div>`;
      return;
    }
    txPane.innerHTML = rows
      .map((t) => {
        const plus = t.amount > 0;
        return `<div class="row">
          <div class="row__body">
            <div class="row__title">${HM.esc(t.reason)}</div>
            <div class="row__meta">${HM.fmtDateTime(t.at)}</div>
          </div>
          <div class="row__side">
            <span class="tx-amount ${plus ? "is-plus" : t.amount < 0 ? "is-minus" : ""}">
              ${t.amount > 0 ? "+" : ""}${t.amount === 0 ? "—" : t.amount}
            </span>
          </div>
        </div>`;
      })
      .join("");
  }

  function render() {
    renderAccount();
    if (tab === "tx") {
      couponPane.hidden = true;
      txPane.hidden = false;
      renderTx();
    } else {
      txPane.hidden = true;
      couponPane.hidden = false;
      renderCoupons();
    }
  }

  /* ---------------- 发行 ---------------- */
  function openIssue() {
    const acc = bank.account(HM.who);
    let typeId = "praise";
    let typeEmoji = bank.types[0].emoji;

    const typeTiles = bank.types
      .map(
        (t) => `<button class="type-tile ${t.id === typeId ? "is-on" : ""}" type="button" data-type="${t.id}"
            data-name="${t.name}" data-emoji="${t.emoji}" data-price="${t.price}">
            <span>${t.emoji}</span><b>${t.name}</b><em>${t.price} 分</em>
          </button>`
      )
      .join("");

    HM.modal({
      title: "发行一张券",
      html: `
        <p class="hint" style="margin-bottom:12px">券会直接进入 <b>${HM.esc(partner.name)}</b> 的券包，发行时从你的余额里扣积分。</p>

        <div class="field">
          <label>选一种</label>
          <div class="type-grid" id="typeGrid">
            ${typeTiles}
            <button class="type-tile" type="button" data-type="custom" data-name="" data-emoji="🎟" data-price="0">
              <span>🎟</span><b>自定义</b><em>自己定价</em>
            </button>
          </div>
        </div>

        <div class="row-2">
          <div class="field">
            <label for="cTitle">券名</label>
            <input class="input" id="cTitle" maxlength="16" value="${HM.attr(bank.types[0].name)}" />
          </div>
          <div class="field">
            <label for="cPrice">价格（积分）</label>
            <input class="input" id="cPrice" type="number" min="0" max="999" value="${bank.types[0].price}" />
          </div>
        </div>

        <div class="field">
          <label for="cNote">想说的话（可选）</label>
          <input class="input" id="cNote" maxlength="40" placeholder="例如：今天也要好好夸我" />
        </div>

        <p class="hint">当前余额 <b id="balNow">${acc.balance}</b> 分，发行后剩 <b id="balLeft">${acc.balance - bank.types[0].price}</b> 分。</p>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "发行",
          onClick: (body, close) => {
            const title = body.querySelector("#cTitle").value.trim();
            const price = Number(body.querySelector("#cPrice").value) || 0;
            const note = body.querySelector("#cNote").value;

            const res = bank.issue({ typeId, title, price, note, emoji: typeEmoji });
            if (!res.ok) {
              HM.toast(res.msg);
              return;
            }
            close();
            tab = "theirs";
            document.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === "theirs"));
            render();
            HM.toast(`发给了${partner.name}，记得提醒对方用 ♡`);
          },
        },
      ],
      onMount(body) {
        const titleEl = body.querySelector("#cTitle");
        const priceEl = body.querySelector("#cPrice");
        const balNow = body.querySelector("#balNow");
        const balLeft = body.querySelector("#balLeft");
        const grid = body.querySelector("#typeGrid");

        const paintLeft = () => {
          const left = acc.balance - (Number(priceEl.value) || 0);
          balLeft.textContent = left;
          balLeft.style.color = left < 0 ? "#d9455f" : "";
        };

        grid.addEventListener("click", (e) => {
          const tile = e.target.closest("[data-type]");
          if (!tile) return;
          grid.querySelectorAll(".type-tile").forEach((t) => t.classList.toggle("is-on", t === tile));
          typeId = tile.dataset.type;
          typeEmoji = tile.dataset.emoji || "🎟";
          titleEl.value = tile.dataset.name || "";
          priceEl.value = tile.dataset.price || 0;
          paintLeft();
        });

        priceEl.addEventListener("input", paintLeft);
        paintLeft();
        balNow.textContent = acc.balance;
      },
    });
  }

  /* ---------------- 使用 ---------------- */
  function openUse(id) {
    const c = bank.data().coupons.find((x) => x.id === id);
    if (!c) return;

    HM.modal({
      title: `使用「${c.title}」`,
      size: "sm",
      html: `
        <div class="use-preview">
          <span>${c.emoji || "🎟"}</span>
          <div>
            <b>${HM.esc(c.title)}</b>
            <small>来自 ${HM.persona(c.from).name} · ${c.price} 积分</small>
          </div>
        </div>
        ${c.note ? `<p class="hint" style="margin:10px 0">「${HM.esc(c.note)}」</p>` : ""}
        <div class="field" style="margin-top:12px">
          <label for="useNote">用在哪里了（可选）</label>
          <input class="input" id="useNote" maxlength="40" placeholder="例如：今天晚上的碗归你了" />
        </div>
        <p class="hint">确认后这张券会标记为已使用，不能撤回。</p>
      `,
      footer: [
        { text: "再想想", variant: "ghost" },
        {
          text: "确认使用",
          onClick: (body, close) => {
            const res = bank.use(id, body.querySelector("#useNote").value);
            if (!res.ok) {
              HM.toast(res.msg);
              return;
            }
            close();
            render();
            HM.toast("用掉啦，记得让对方兑现 ♡");
          },
        },
      ],
    });
  }

  /* ---------------- 事件 ---------------- */
  document.getElementById("issueBtn").addEventListener("click", openIssue);

  document.getElementById("seg").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    tab = btn.dataset.tab;
    document.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("is-on", b === btn));
    render();
  });

  couponPane.addEventListener("click", async (e) => {
    const useBtn = e.target.closest("[data-use]");
    if (useBtn) {
      openUse(useBtn.dataset.use);
      return;
    }

    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      const c = bank.data().coupons.find((x) => x.id === delBtn.dataset.del);
      if (!c) return;
      const ok = await HM.confirm({
        title: "删除这张券？",
        text: `「${c.title}」会被永久删除，积分不会退回。`,
        okText: "删除",
        danger: true,
      });
      if (!ok) return;
      bank.remove(c.id);
      render();
      HM.toast("已删除");
    }
  });

  renderRules();
  render();
});
