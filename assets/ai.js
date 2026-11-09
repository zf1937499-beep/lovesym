/* AI 客户端封装：只调自家 /api/ai/*，永远不接触供应商 Key */
(function () {
  if (typeof HM === "undefined") return;

  async function post(kind, payload) {
    try {
      const res = await fetch(`/api/ai/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });

      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        /* 非 JSON 响应 */
      }

      if (!res.ok || !body || body.ok !== true) {
        return {
          ok: false,
          error: (body && body.error) || `HTTP_${res.status}`,
          message: (body && body.message) || "AI 暂时没空，先按原来的方式写吧",
        };
      }

      return { ok: true, data: body.data };
    } catch (e) {
      return { ok: false, error: "OFFLINE", message: "连不上服务，AI 功能先歇一会儿" };
    }
  }

  async function usage() {
    try {
      const res = await fetch("/api/ai/usage", { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /** 按钮忙碌态：调用期间禁用并临时改文案 */
  async function busy(btn, label, task) {
    if (!btn) return task();
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = label;
    try {
      return await task();
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  /** 统一的失败提示 */
  function failMessage(res) {
    if (res && res.message) return res.message;
    if (res && res.error === "LIMIT_DAY") return "今天的 AI 额度用完了，明天再来吧";
    return "AI 暂时没空，先按原来的方式写吧";
  }

  HM.ai = { post, usage, busy, failMessage };
})();
