// dsh-balance-chip — browser half: a balance pill in the composer's right slot,
// left of the dictation / voice buttons, reading the bottom info bar's snapshot RPC.
if (!window.__BAL_REGISTERED__) {
  window.__BAL_REGISTERED__ = true;
  window.__ModuleLoader__.load({ id: "dsh-balance-chip", factory: (require) => {
    var module = { exports: {} };
    const React = require("react");
    const h = React.createElement;

    const SLOT = "conversation.input.right";
    const ENTRY_ID = "balance-chip";
    const ORDER = -10;
    const REFRESH_MS = 60000;
    const RPC = "_dsh/dsh-bottom-info-bar/getBalanceSnapshot";
    const USAGE_RPC = "_dsh/dsh-bottom-info-bar/getUsageSummary";
    const nf = new Intl.NumberFormat("zh-CN");

    function installStyles() {
      if (document.querySelector('style[data-plugin="dsh-balance-chip"]')) return;
      const style = document.createElement("style");
      style.dataset.plugin = "dsh-balance-chip";
      style.textContent =
        ".dsh-balance-chip{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;" +
        "border-radius:999px;border:1px solid rgba(128,128,128,.28);font-size:12px;line-height:1;" +
        "opacity:.75;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:default;transition:opacity .15s ease}" +
        ".dsh-balance-chip:hover{opacity:1}" +
        ".dsh-balance-chip[data-state=error]{color:#e5484d;opacity:.9}" +
        ".dsh-balance-chip[data-state=loading]{opacity:.5}" +
        ".dsh-balance-chip[data-state=neutral]{opacity:.55}" +
        ".dsh-balance-amount{color:#4d6bfe;font-weight:600}" +
        ".dsh-balance-tip{position:fixed;top:0;left:0;z-index:9999;visibility:hidden;" +
        "min-width:210px;padding:9px 11px;border-radius:10px;font-size:12px;line-height:1.6;" +
        "background:var(--dsw-alias-bg-elevated,#232630);color:var(--dsw-alias-text-primary,#e8e8ea);" +
        "border:1px solid rgba(128,128,128,.3);box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none;" +
        "font-variant-numeric:tabular-nums}" +
        ".dsh-balance-tip-row{display:flex;justify-content:space-between;gap:18px}" +
        ".dsh-balance-tip-k{opacity:.62}" +
        ".dsh-balance-tip-v{font-weight:600;color:#4d6bfe}" +
        ".dsh-balance-tip-muted{opacity:.5;margin-top:4px}";
      document.head.appendChild(style);
    }

    function isCredits(snapshot) {
      const data = snapshot && snapshot.data;
      const unit = (data && (data.unit || data.currency)) || (snapshot && (snapshot.unit || snapshot.currency));
      return String(unit || "").toLowerCase() === "credits";
    }


    // 宿主侧对不认识的服务商（如中转站 hctopup-*）会返回 unmapped / accountDataUnavailable：
    // 这不是读取失败，而是该线路根本没有余额来源，要分开显示，别报红。
    function isUnmapped(snapshot) {
      if (!snapshot || snapshot.data) return false;
      return snapshot.unmapped === true || snapshot.accountDataUnavailable === true;
    }
    function money(snapshot) {
      const data = snapshot && snapshot.data;
      if (!data || typeof data.total !== "number") return null;
      if (isCredits(snapshot)) {
        return Number.isInteger(data.total) ? data.total.toFixed(0) : data.total.toFixed(2);
      }
      const symbol = String(snapshot.currency || "CNY").toUpperCase() === "USD" ? "$" : "¥";
      return symbol + (data.total >= 1000 ? data.total.toFixed(0) : data.total.toFixed(2));
    }

    function fmt(n) {
      return typeof n === "number" && isFinite(n) ? nf.format(Math.round(n)) : "—";
    }

    function tipRow(label, value, colored) {
      return h("div", { className: "dsh-balance-tip-row", key: label },
        h("span", { className: "dsh-balance-tip-k" }, label),
        h("span", { className: colored ? "dsh-balance-tip-v" : "dsh-balance-tip-v" }, value));
    }

    function usageLine(usage) {
      const cur = usage && usage.currentSession;
      if (!cur) return "本会话：暂无记账";
      const hit = typeof cur.hitRate === "number" ? cur.hitRate.toFixed(1) + "%" : "—";
      return "本会话：输入 " + fmt(cur.input + cur.cacheRead + cur.cacheWrite) + " · 输出 " + fmt(cur.output) + " · 缓存命中 " + hit;
    }

    module.exports.inject = ["slots"];
    module.exports.apply = function (ctx) {
      installStyles();
      const tryDirectories = () => {
        try { return ctx.get("modelDirectories") ?? ctx.modelDirectories; } catch (e) { return void 0; }
      };

      function Chip(props) {
        const [sel, setSel] = React.useState(null);
        const [snapshot, setSnapshot] = React.useState(null);
        const [usage, setUsage] = React.useState(null);
        const [failed, setFailed] = React.useState(false);
        const [anchor, setAnchor] = React.useState(null);
        const chipRef = React.useRef(null);
        const tipRef = React.useRef(null);

        React.useEffect(() => {
          if (!props.sessionId) return;
          let cancelled = false;
          let tries = 0;
          let loadedOnce = false;
          const read = () => {
            if (cancelled) return false;
            try {
              const directories = tryDirectories();
              if (!directories) return false;
              const directory = directories.directoryFor(props.sessionId);
              if (!directory || !directory.store) return false;
              const snap = directory.store.getSnapshot();
              const cur = snap && snap.current;
              if (cur && cur.provider && cur.model) {
                setSel({ provider: cur.provider, model: cur.model });
                return true;
              }
              if (!loadedOnce && typeof directory.load === "function") {
                loadedOnce = true;
                try { const p = directory.load(); if (p && typeof p.catch === "function") p.catch(() => {}); } catch (e) {}
              }
            } catch (e) {}
            return false;
          };
          if (read()) return;
          const timer = setInterval(() => {
            tries += 1;
            if (read() || tries > 80) clearInterval(timer);
          }, 700);
          return () => { cancelled = true; clearInterval(timer); };
        }, [props.sessionId]);

        React.useEffect(() => {
          if (!sel) return;
          let alive = true;
          let controller;
          const pull = async () => {
            controller = typeof AbortController === "function" ? new AbortController() : void 0;
            try {
              const selection = { provider: sel.provider, model: sel.model };
              const options = {
                method: "POST", cache: "no-store", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                signal: controller ? controller.signal : void 0,
              };
              const [balRes, useRes] = await Promise.all([
                fetch(RPC, Object.assign({}, options, { body: JSON.stringify({ selection }) })),
                fetch(USAGE_RPC, Object.assign({}, options, {
                  body: JSON.stringify({ sessionId: props.sessionId, selection }),
                })).catch(() => null),
              ]);
              if (!balRes.ok) throw new Error("HTTP " + balRes.status);
              const json = await balRes.json();
              let usageJson = null;
              try { usageJson = useRes && useRes.ok ? await useRes.json() : null; } catch (e) { usageJson = null; }
              if (!alive) return;
              setSnapshot(json);
              setUsage(usageJson);
              setFailed(!(json && json.data));
            } catch (e) {
              if (!alive || (e && e.name === "AbortError")) return;
              setFailed(true);
            }
          };
          pull();
          const timer = setInterval(pull, REFRESH_MS);
          return () => { alive = false; clearInterval(timer); if (controller) controller.abort(); };
        }, [sel]);

        React.useLayoutEffect(() => {
          if (!anchor) return;
          const tip = tipRef.current;
          const chip = chipRef.current;
          if (!tip || !chip) return;
          tip.style.visibility = "hidden";
          tip.style.transform = "none";
          const t = tip.getBoundingClientRect();
          const c = chip.getBoundingClientRect();
          const dx = c.left - t.left;
          const dy = (c.top - 8) - t.bottom;
          tip.style.transform = "translate(" + dx + "px," + dy + "px)";
          tip.style.visibility = "visible";
        }, [anchor, snapshot, usage]);

        const amount = money(snapshot);
        const unmapped = isUnmapped(snapshot);
        const state = unmapped ? "neutral" : failed && !amount ? "error" : amount ? "ok" : "loading";
        const cur = usage && usage.currentSession;

        const show = (e) => {
          const node = (e && e.currentTarget) || chipRef.current ||
            (typeof document !== "undefined" ? document.querySelector(".dsh-balance-chip") : null);
          if (!node) return;
          const r = node.getBoundingClientRect();
          const width = 240;
          const left = Math.max(8, Math.min(r.left, (window.innerWidth || 1024) - width - 8));
          setAnchor({ top: r.top - 8, left });
        };
        const hide = () => setAnchor(null);

        const rows = [];
        rows.push(tipRow("模型", sel ? sel.model + "（" + sel.provider + "）" : "识别中…", false));
        rows.push(tipRow(isCredits(snapshot) ? "积分" : "余额",
          amount || (unmapped ? "未适配" : failed ? "读取失败" : "…"), !unmapped));
        if (cur) {
          rows.push(tipRow("输入", fmt(cur.input + cur.cacheRead + cur.cacheWrite), true));
          rows.push(tipRow("输出", fmt(cur.output), true));
          rows.push(tipRow("缓存命中", typeof cur.hitRate === "number" ? cur.hitRate.toFixed(1) + "%" : "—", true));
        } else if (sel) {
          rows.push(tipRow("本会话", "暂无记账", false));
        }
        if (unmapped) {
          rows.push(h("div", { className: "dsh-balance-tip-row dsh-balance-tip-muted", key: "unmapped" },
            h("span", { className: "dsh-balance-tip-k" }, "说明"),
            h("span", { className: "dsh-balance-tip-k" }, "该线路不提供余额查询")));
        }
        if (snapshot && snapshot.fetchedAt) {
          rows.push(h("div", { className: "dsh-balance-tip-row dsh-balance-tip-muted", key: "ts" },
            h("span", { className: "dsh-balance-tip-k" }, "更新于"),
            h("span", { className: "dsh-balance-tip-k" }, new Date(snapshot.fetchedAt).toLocaleTimeString())));
        }

        const tip = anchor ? h("div", { ref: tipRef, className: "dsh-balance-tip" }, rows) : null;

        return h(React.Fragment, null,
          h("span", {
            ref: chipRef,
            className: "dsh-balance-chip",
            role: "status",
            "data-state": state,
            "aria-label": "本会话余额与用量",
            onMouseEnter: show,
            onMouseLeave: hide,
            onFocus: show,
            onBlur: hide,
          }, amount ? [isCredits(snapshot) ? "积分 " : "余额 ", h("span", { className: "dsh-balance-amount", key: "a" }, amount)]
            : unmapped ? "余额 未适配"
            : failed ? (isCredits(snapshot) ? "积分 读取失败" : "余额 读取失败") : "余额 …"),
          tip);
      }

      ctx.effect(() => ctx.slots.inject(SLOT, () =>
        ctx.slots.register({ name: SLOT, id: ENTRY_ID, order: ORDER }, Chip)),
        "dsh-balance-chip: composer chip");
    };

    return module.exports;
  } });
}
