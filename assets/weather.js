/* 首页「双方天气」卡片（静态站点版）
   数据来自本地服务的 /api/weather，浏览器不接触和风天气 Key */
(function () {
  const card = document.getElementById("weatherCard");
  if (!card) return;

  const body = document.getElementById("wxBody");
  const timeEl = document.getElementById("wxTime");

  const CITIES = {
    hanhan: { short: "寿光", nick: "瀚瀚" },
    yimeng: { short: "临海", nick: "伊梦" },
  };

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function skeleton() {
    body.innerHTML = `
      <div class="wx-grid">
        <div class="wx-skeleton"></div>
        <div class="wx-skeleton"></div>
      </div>`;
  }

  // 本地调试时才提示怎么起服务，正式部署不会出现
  function devHint() {
    const isLocal =
      location.protocol === "file:" ||
      ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    return isLocal
      ? `<p class="wx-fail__dev">本地预览需要先运行 <code>node server.mjs</code></p>`
      : "";
  }

  function failure() {
    timeEl.textContent = "";
    body.innerHTML = `
      <div class="wx-fail">
        <span class="wx-fail__icon">🌧️</span>
        <p class="wx-fail__title">天气暂时获取失败</p>
        <p class="wx-fail__sub">没关系，反正你在的地方就是好天气</p>
        <button class="btn btn--ghost btn--sm" type="button" id="wxRetry">再试一次</button>
        ${devHint()}
      </div>`;
    const retry = document.getElementById("wxRetry");
    if (retry) retry.addEventListener("click", load);
  }

  function panel(city) {
    if (!city.ok || !city.now) {
      return `<div class="wx-panel wx-panel--empty">
          <span>🌫️</span>
          <p>${esc(city.nick)}那边暂时看不到天气</p>
        </div>`;
    }
    const n = city.now;
    const meta = CITIES[city.key] || { short: city.short, nick: city.nick };

    return `
      <div class="wx-panel">
        <div class="wx-panel__top">
          <div>
            <div class="wx-who"><b>${esc(meta.nick)}</b><span>${esc(meta.short)}</span></div>
            <div class="wx-city">${esc(city.name)}</div>
          </div>
          <span class="wx-emoji">${n.emoji}</span>
        </div>
        <div class="wx-temp">
          <b>${n.temp}</b><i>°C</i><em>${esc(n.text)}</em>
        </div>
        <p class="wx-meta">体感 ${n.feelsLike}° · 湿度 ${n.humidity}% · ${esc(n.windDir)} ${esc(n.windScale)} 级</p>
        <div class="wx-tags">
          ${city.air ? `<span class="wx-tag">空气 ${esc(city.air.category || "—")}${city.air.aqi ? " · " + city.air.aqi : ""}</span>` : ""}
          ${city.dress ? `<span class="wx-tag">穿衣 ${esc(city.dress.category || "—")}</span>` : ""}
          ${city.alert ? `<span class="wx-tag wx-tag--warn" title="${esc(city.alert.headline)}">⚠️ 有预警</span>` : ""}
        </div>
        ${city.dress && city.dress.text ? `<p class="wx-dress">${esc(city.dress.text)}</p>` : ""}
        ${city.rainSoon ? `<p class="wx-rain">☔ 未来 2 小时可能有雨</p>` : ""}
      </div>`;
  }

  function render(data) {
    const cities = data.cities || [];
    const alertCity = cities.find((c) => c.alert);
    const allFailed = cities.every((c) => !c.ok);

    if (!cities.length || allFailed) {
      failure();
      return;
    }

    const t = data.fetchedAt ? new Date(data.fetchedAt) : new Date();
    timeEl.textContent = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} 更新`;

    const banner = alertCity
      ? `<div class="wx-alert"><span>⚠️</span><span>${esc(alertCity.nick)}那边：${esc(alertCity.alert.headline)}</span></div>`
      : "";

    if (data.sameCity) {
      const c = cities[0];
      body.innerHTML = `
        ${banner}
        <div class="wx-panel wx-panel--merged">
          <p class="wx-same">我们在同一片天空下</p>
          <div class="wx-temp">
            <span class="wx-emoji">${c.now ? c.now.emoji : "🌈"}</span>
            <b>${c.now ? c.now.temp : "--"}</b><i>°C</i><em>${c.now ? esc(c.now.text) : ""}</em>
          </div>
          <p class="wx-meta">${esc(c.name)} · 体感 ${c.now ? c.now.feelsLike : "--"}° · 湿度 ${c.now ? c.now.humidity : "--"}%</p>
        </div>`;
      return;
    }

    const km = data.distanceKm || 0;
    body.innerHTML = `
      ${banner}
      <div class="wx-grid">${cities.map(panel).join("")}</div>
      <p class="wx-distance">寿光 ⇢ 临海 · 相距约 ${km} 公里</p>`;
  }

  // 同源接口；如果是静态预览（没有后端），退回本机跑着的 node server
  const ENDPOINTS = ["/api/weather", "http://localhost:4321/api/weather"];

  async function tryFetch(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("bad status " + res.status);
    return res.json();
  }

  async function load() {
    skeleton();
    if (timeEl) timeEl.textContent = "正在看看...";

    for (const url of ENDPOINTS) {
      try {
        const data = await tryFetch(url);
        render(data);
        return;
      } catch (err) {
        // 换下一个地址再试
      }
    }

    failure();
  }

  load();
})();
