/* 设置：资料 / 头像 / 导出 / 删除 / 退出 */
HM.page(function (HM) {
  const S = HM.state;

  const nameMe = document.getElementById("nameMe");
  const nameHer = document.getElementById("nameHer");
  const startDate = document.getElementById("startDate");
  const avaMe = document.getElementById("avaMe");
  const avaHer = document.getElementById("avaHer");
  const avatarInput = document.getElementById("avatarInput");
  const whoPill = document.getElementById("whoPill");

  let picking = null;

  function paintAvatar(el, persona) {
    if (persona.avatar) {
      el.style.backgroundImage = `url('${persona.avatar}')`;
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.textContent = persona.initial;
    }
  }

  function fill() {
    nameMe.value = S.couple.me.name;
    nameHer.value = S.couple.her.name;
    startDate.value = (S.couple.startDate || "").slice(0, 16);
    paintAvatar(avaMe, HM.persona("me"));
    paintAvatar(avaHer, HM.persona("her"));
    whoPill.textContent = `当前：${HM.me().name}`;
  }

  /* 头像选择 */
  document.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      picking = btn.dataset.pick;
      avatarInput.value = "";
      avatarInput.click();
    });
  });

  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file || !picking) return;
    try {
      const base64 = await HM.compressImage(file, 320, 0.85);
      const target = picking === "me" ? S.couple.me : S.couple.her;
      target.avatar = await HM.uploadImage(base64, file.name);
      HM.save();
      fill();
      HM.toast("头像换好啦 ♡");
    } catch (e) {
      HM.toast("这张图读不出来，换一张试试");
    }
  });

  /* 保存资料 */
  document.getElementById("saveProfile").addEventListener("click", () => {
    const a = nameMe.value.trim() || "瀚瀚";
    const b = nameHer.value.trim() || "伊梦";
    const sd = startDate.value;

    S.couple.me.name = a;
    S.couple.her.name = b;
    if (sd) S.couple.startDate = sd;

    if (!HM.save()) return;
    HM.toast("资料已保存 ♡");
    setTimeout(() => location.reload(), 600);
  });

  /* 切换身份 */
  document.querySelectorAll("[data-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.switch === HM.who) {
        HM.toast("已经是这个身份啦");
        return;
      }
      HM.setWho(btn.dataset.switch);
      location.reload();
    });
  });

  /* 导出 */
  document.getElementById("exportBtn").addEventListener("click", () => {
    const payload = {
      app: "瀚海遇伊梦",
      exportedAt: new Date().toISOString(),
      data: S,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hanmeng-${HM.todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    HM.toast("已导出，收好这份回忆 ♡");
  });

  /* 数据体积 */
  function paintSize() {
    try {
      const raw = JSON.stringify(S);
      const kb = (new Blob([raw]).size / 1024).toFixed(0);
      document.getElementById("dbSize").textContent = `下载一份 JSON 备份 · 当前约 ${kb} KB`;
    } catch (e) {}
  }

  /* 删除我创建的内容 */
  document.getElementById("delMine").addEventListener("click", async () => {
    const myDiary = S.diary.filter((d) => d.author === HM.who).length;
    const myWishes = S.wishes.filter((w) => w.author === HM.who).length;

    const ok = await HM.confirm({
      title: "删除我创建的内容？",
      text: `会删掉你写的 ${myDiary} 篇日记和 ${myWishes} 个愿望，对方的内容不受影响。`,
      okText: "删除",
      danger: true,
    });
    if (!ok) return;

    S.diary = S.diary.filter((d) => d.author !== HM.who);
    S.wishes = S.wishes.filter((w) => w.author !== HM.who);
    HM.save();
    paintSize();
    HM.toast("已经清理干净");
  });

  /* 清空全部 */
  document.getElementById("wipeAll").addEventListener("click", async () => {
    const ok = await HM.confirm({
      title: "清空全部数据？",
      text: "所有相册照片、日记、愿望、打卡记录都会被删除，这个操作不可撤销。建议先导出备份。",
      okText: "我确定清空",
      danger: true,
    });
    if (!ok) return;

    try {
      localStorage.removeItem(HM.store.DB_KEY);
    } catch (e) {}
    HM.toast("已清空，正在重启…");
    setTimeout(() => location.reload(), 700);
  });

  /* 退出 */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const ok = await HM.confirm({
      title: "退出当前身份？",
      text: "退出后需要重新选择「我是谁」，数据不会丢失。",
      okText: "退出",
    });
    if (!ok) return;
    HM.setWho("");
    location.reload();
  });

  /* 修改口令 */
  const passWho = document.getElementById("passWho");
  if (passWho) passWho.textContent = `当前身份：${HM.me().name}`;

  document.getElementById("savePass").addEventListener("click", async () => {
    const oldInput = document.getElementById("passOld");
    const newInput = document.getElementById("passNew");
    const new2Input = document.getElementById("passNew2");

    const oldPass = oldInput.value.trim();
    const nextPass = newInput.value.trim();

    if (!oldPass) return HM.toast("先输入当前口令");
    if (nextPass.length < 6) return HM.toast("新口令至少 6 位");
    if (nextPass !== new2Input.value.trim()) return HM.toast("两次新口令不一致");

    const result = await HM.checkPass(HM.who, oldPass);
    if (!result.ok) return HM.toast("当前口令不对");

    await HM.setPass(HM.who, nextPass);
    oldInput.value = "";
    newInput.value = "";
    new2Input.value = "";
    HM.toast("口令已更新，下次进来用新的 ♡");
  });

  /* 存储位置提示：有后端就说清楚 */
  const note = document.getElementById("storageNote");
  if (note) {
    note.textContent = HM.remote.on
      ? "数据已同步到你的服务器（data/db.json），两个人在不同设备也能看到同一份内容"
      : "当前是本地模式：数据只存在这台设备的浏览器里，换设备不会同步";
  }

  fill();
  paintSize();
});
