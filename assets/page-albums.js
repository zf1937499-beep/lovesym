/* 相册：列表 / 详情 / 上传 / 灯箱 / 删除 */
HM.page(function (HM) {
  const S = HM.state;
  const viewList = document.getElementById("viewList");
  const viewDetail = document.getElementById("viewDetail");
  const grid = document.getElementById("albumGrid");
  const photoGrid = document.getElementById("photoGrid");
  const fileInput = document.getElementById("fileInput");
  const albumName = document.getElementById("albumName");
  const albumMeta = document.getElementById("albumMeta");
  const albumSummary = document.getElementById("albumSummary");

  let currentId = null;

  function albumById(id) {
    return S.albums.find((a) => a.id === id);
  }

  /* ---------------- 列表 ---------------- */
  function renderList() {
    const totalPhotos = S.albums.reduce((sum, a) => sum + (a.photos || []).length, 0);
    albumSummary.textContent = `${S.albums.length} 个相册 · ${totalPhotos} 张照片`;

    if (!S.albums.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <b>📷</b>
          还没有相册，先建一个吧<br />
          <button class="btn btn--soft btn--sm" type="button" id="emptyNew" style="margin-top:14px">+ 新建相册</button>
        </div>`;
      const b = document.getElementById("emptyNew");
      if (b) b.addEventListener("click", openNewAlbum);
      return;
    }

    grid.innerHTML = S.albums
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((a) => {
        const cover = (a.photos || [])[0];
        const count = (a.photos || []).length;
        return `
        <button class="album" type="button" data-album="${a.id}">
          <div class="album__cover">
            ${cover && cover.src ? `<img src="${cover.src}" alt="${HM.attr(a.name)}" />` : a.emoji || "🌷"}
            <span class="album__count">${count} 张</span>
          </div>
          <div class="album__info">
            <div class="album__name">${HM.esc(a.name)}</div>
            <div class="album__meta">${HM.fmtDate(new Date(a.createdAt || Date.now()), true)} 创建</div>
          </div>
        </button>`;
      })
      .join("");
  }

  /* ---------------- 详情 ---------------- */
  function renderDetail() {
    const album = albumById(currentId);
    if (!album) {
      location.hash = "";
      return;
    }

    albumName.textContent = `${album.emoji || "📷"} ${album.name}`;
    const photos = album.photos || [];
    albumMeta.textContent = `${photos.length} 张照片 · ${HM.fmtDate(new Date(album.createdAt || Date.now()), true)} 创建`;

    if (!photos.length) {
      photoGrid.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;padding:18px 0">这个相册还是空的，上传第一张吧 ♡</p>`;
      return;
    }

    photoGrid.innerHTML = photos
      .slice()
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .map(
        (p) => `
        <div class="ptile" data-photo="${p.id}">
          <img src="${p.src}" alt="${HM.attr(p.name || "照片")}" loading="lazy" />
          <button class="ptile__del" type="button" data-del="${p.id}" title="删除这张">✕</button>
        </div>`
      )
      .join("");
  }

  function route() {
    const m = location.hash.match(/id=([\w-]+)/);
    if (m && albumById(m[1])) {
      currentId = m[1];
      viewList.hidden = true;
      viewDetail.hidden = false;
      renderDetail();
    } else {
      currentId = null;
      viewList.hidden = false;
      viewDetail.hidden = true;
      renderList();
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 新建相册 ---------------- */
  function openNewAlbum() {
    HM.modal({
      title: "新建相册",
      size: "sm",
      html: `
        <div class="field">
          <label for="aName">相册名字</label>
          <input class="input" id="aName" maxlength="16" placeholder="例如：2024 夏天的海" />
        </div>
        <div class="field">
          <label for="aEmoji">封面图标</label>
          <input class="input" id="aEmoji" maxlength="2" value="🌷" />
          <p class="hint">没有照片时显示这个 emoji，也可以换成 🌊 🍰 🎡 🐱</p>
        </div>
      `,
      footer: [
        { text: "取消", variant: "ghost" },
        {
          text: "创建",
          onClick: (body, close) => {
            const name = body.querySelector("#aName").value.trim();
            if (!name) {
              HM.toast("给相册起个名字吧");
              return;
            }
            const album = {
              id: HM.uid(),
              name,
              emoji: body.querySelector("#aEmoji").value.trim() || "🌷",
              photos: [],
              createdAt: Date.now(),
            };
            S.albums.push(album);
            HM.save();
            close();
            location.hash = `id=${album.id}`;
            HM.toast("相册建好啦 ♡");
          },
        },
      ],
    });
  }

  /* ---------------- 上传 ---------------- */
  async function handleFiles(files) {
    const album = albumById(currentId);
    if (!album || !files || !files.length) return;

    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      HM.toast("只能上传图片哦");
      return;
    }

    HM.toast(`正在压缩 ${list.length} 张照片…`);
    let added = 0;

    for (const file of list) {
      try {
        const base64 = await HM.compressImage(file, 1280, 0.82);
        // 有后端就传文件换 URL，没有就退回 base64
        const src = await HM.uploadImage(base64, file.name);
        album.photos = album.photos || [];
        album.photos.push({ id: HM.uid(), name: file.name, src, addedAt: Date.now() + added });
        added += 1;
      } catch (err) {
        console.warn(err);
      }
      if (!HM.save()) break;
    }

    fileInput.value = "";
    renderDetail();
    if (added) {
      const got = HM.bank.award("photo", { qty: added });
      HM.toast(`上传了 ${added} 张 ♡${got ? ` +${got} 积分` : ""}`);
    }
  }

  /* ---------------- 灯箱 ---------------- */
  function openLightbox(photoId) {
    const album = albumById(currentId);
    if (!album) return;
    const photos = (album.photos || []).slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    let index = photos.findIndex((p) => p.id === photoId);
    if (index < 0) return;

    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `
      <div class="lightbox__bar">
        <span class="lightbox__count"></span>
        <button type="button" data-act="close">关闭 ✕</button>
      </div>
      <div class="lightbox__stage"><img alt="照片" /></div>
      <div class="lightbox__nav">
        <button type="button" data-act="prev">← 上一张</button>
        <button type="button" data-act="next">下一张 →</button>
      </div>`;

    const img = box.querySelector("img");
    const counter = box.querySelector(".lightbox__count");

    function paint() {
      img.src = photos[index].src;
      counter.textContent = `${index + 1} / ${photos.length}`;
    }
    paint();

    function close() {
      box.remove();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    }

    function step(delta) {
      index = (index + delta + photos.length) % photos.length;
      paint();
    }

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }

    box.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (act) {
        const a = act.dataset.act;
        if (a === "close") close();
        if (a === "prev") step(-1);
        if (a === "next") step(1);
        return;
      }
      if (e.target === box || e.target.classList.contains("lightbox__stage")) close();
    });

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.body.appendChild(box);
  }

  /* ---------------- 事件 ---------------- */
  document.getElementById("newAlbumBtn").addEventListener("click", openNewAlbum);
  document.getElementById("backBtn").addEventListener("click", () => {
    location.hash = "";
  });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-album]");
    if (!card) return;
    location.hash = `id=${card.dataset.album}`;
  });

  document.getElementById("uploadBtn").addEventListener("click", () => fileInput.click());
  document.getElementById("uploader").addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));

  photoGrid.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const ok = await HM.confirm({
        title: "删除这张照片？",
        text: "照片会从相册里移除，无法恢复。",
        okText: "删除",
        danger: true,
      });
      if (!ok) return;
      const album = albumById(currentId);
      album.photos = (album.photos || []).filter((p) => p.id !== del.dataset.del);
      HM.save();
      renderDetail();
      HM.toast("已删除");
      return;
    }

    const tile = e.target.closest("[data-photo]");
    if (tile) openLightbox(tile.dataset.photo);
  });

  document.getElementById("delAlbumBtn").addEventListener("click", async () => {
    const album = albumById(currentId);
    if (!album) return;
    const ok = await HM.confirm({
      title: "删除整个相册？",
      text: `「${album.name}」里的 ${(album.photos || []).length} 张照片会一起消失，无法恢复。`,
      okText: "删除相册",
      danger: true,
    });
    if (!ok) return;
    S.albums = S.albums.filter((a) => a.id !== album.id);
    HM.save();
    location.hash = "";
    HM.toast("相册已删除");
  });

  window.addEventListener("hashchange", route);
  route();
});
