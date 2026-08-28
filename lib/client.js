/**
 * dsh-whale-musume 客户端插件:把鲸鱼娘桌宠注入 DSH Web UI(纯 DOM 注入)。
 *
 * 零侵入:不改任何内置包文件、不读业务 DOM、无外部请求。
 * 资源经宿主路由 /api/dsh-whale-musume/assets?f=<path> 加载,
 * 注入顺序:样式 → 状态机(whale-moe-core)→ 表现层(dsh-whale-moe),
 * 表现层的资源根与校准表路径会被改写为宿主路由。
 *
 * v1.4.2 起,额外把「看板娘」设置栏目注册进 DSH 设置面板
 * (settings.section, id=mascot)——与 scripts/apply-theme.mjs
 * --mascot-settings v27 注入的面板同源(读 whale-moe:* localStorage,
 * 监听 whale-moe-prefs-change),使 bundle 安装方式同样自带设置面板。
 */
window.__ModuleLoader__.load({
  id: "dsh-whale-musume",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var jsxRuntime = require("react/jsx-runtime");
    var jsx = jsxRuntime.jsx;
    var jsxs = jsxRuntime.jsxs;

    const BASE = "/api/dsh-whale-musume/assets?f=";
    const BOOT_FLAG = "__dshWhaleMusumeBooted";

    function injectStyle(text) {
      const el = document.createElement("style");
      el.setAttribute("data-dsh-whale-musume", "css");
      el.textContent = text;
      document.head.appendChild(el);
    }

    function injectScript(text) {
      const el = document.createElement("script");
      el.setAttribute("data-dsh-whale-musume", "js");
      el.textContent = text;
      document.body.appendChild(el);
    }

    async function boot() {
      if (window[BOOT_FLAG]) return;
      window[BOOT_FLAG] = true;
      try {
        const css = await (await fetch(BASE + "dsh-whale-moe.css")).text();
        injectStyle(css);
        const core = await (await fetch(BASE + "whale-moe-core.js")).text();
        injectScript(core);
        const raw = await (await fetch(BASE + "dsh-whale-moe.js")).text();
        const presenter = raw
          .replace('var ASSET_ROOT = "/assets/generated/";', 'var ASSET_ROOT = "' + BASE + 'generated/";')
          .replace('fetch("/assets/peek-calibration.json")', 'fetch("' + BASE + 'peek-calibration.json")');
        injectScript(presenter);
      } catch (error) {
        console.warn("[dsh-whale-musume] 资源加载失败:", error);
      }
    }

    /* ---- 设置面板「看板娘」栏目(与 apply-theme.mjs --mascot-settings v27 同源) ---- */

    const MASCOT_NS = "settings.mascot";
    const MASCOT_ROW_STYLE = { alignItems: "center", borderBottom: "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "12px", justifyContent: "space-between", padding: "10px 0" };
    const MASCOT_CARD_STYLE = { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "10px", padding: "6px 14px", width: "100%" };
    function MascotCard({ title, children }) {
      return jsxs("div", { style: MASCOT_CARD_STYLE, children: [jsx("div", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", fontWeight: "600", padding: "6px 0 2px" }, children: title }), children] });
    }
    function MascotValue(key, fallback) {
      try { const v = window.localStorage.getItem("whale-moe:" + key); return v === null ? fallback : v; } catch (e) { return fallback; }
    }
    function MascotPrefRow({ label, prefKey, compact }) {
      const [isOn, setIsOn] = React.useState(MascotValue(prefKey, prefKey === "keywords" ? "0" : "1") !== "0");
      return jsxs("div", { style: compact ? { alignItems: "center", display: "flex", gap: "8px", justifyContent: "space-between", minWidth: 0, padding: "6px 0" } : MASCOT_ROW_STYLE, children: [jsx("span", { style: compact ? { fontSize: "12px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined, children: label }), jsx("button", {
        type: "button", role: "switch",
        "aria-checked": isOn,
        style: { alignItems: "center", background: isOn ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", border: "none", borderRadius: "999px", cursor: "pointer", display: "flex", height: "24px", justifyContent: isOn ? "flex-end" : "flex-start", padding: "3px", transition: "background 160ms ease", width: "44px" },
        onClick: (event) => {
          event.stopPropagation();
          event.preventDefault();
          const next = !isOn;
          try { window.localStorage.setItem("whale-moe:" + prefKey, next ? "1" : "0"); } catch (e) {}
          setIsOn(next);
          window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: prefKey, value: next ? "1" : "0" } }));
        },
        children: jsx("span", { style: { background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px rgb(0 0 0 / 25%)", height: "18px", width: "18px" } })
      }) ] });
    }
    function MascotTitleRow({ compact }) {
      return jsxs("label", { style: compact ? { alignItems: "center", display: "flex", gap: "12px", justifyContent: "space-between", padding: "2px 0" } : MASCOT_ROW_STYLE, children: [jsx("span", { children: "如何称呼我" }), jsx("input", {
        type: "text",
        defaultValue: MascotValue("title", "主人"),
        maxLength: 8,
        placeholder: "主人",
        style: { flex: 1, maxWidth: "150px", minWidth: 0 },
        onChange: (event) => {
          try { window.localStorage.setItem("whale-moe:title", event.target.value); } catch (e) {}
          window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "title", value: event.target.value } }));
        }
      }) ] });
    }
    function MascotWeatherRow() {
      const [status, setStatus] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const save = (key, value) => {
        try { window.localStorage.setItem("whale-moe:" + key, value); } catch (e) {}
        window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key, value } }));
      };
      const testNow = () => {
        setBusy(true);
        setStatus("⏳ 正在连接 Open-Meteo…");
        const city = window.localStorage.getItem("whale-moe:weatherCity") || "";
        const key = window.localStorage.getItem("whale-moe:weatherKey") || "";
        const p = window.DshWhaleMoeWeatherTest ? window.DshWhaleMoeWeatherTest(city, key) : Promise.reject(new Error("天气服务未就绪"));
        p.then((text) => { setStatus(text); setBusy(false); }, (error) => {
          setStatus("❌ 连接失败：" + (error && error.message ? error.message : "未知错误") + "（无 Key 也可用）");
          setBusy(false);
        });
      };
      return jsxs("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
        jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "天气城市" }), jsx("input", {
          type: "text",
          defaultValue: MascotValue("weatherCity", ""),
          placeholder: "如：上海（留空不联网）",
          maxLength: 24,
          onChange: (event) => save("weatherCity", event.target.value)
        })] }),
        jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "API Key（选填）" }), jsx("input", {
          type: "password",
          defaultValue: MascotValue("weatherKey", ""),
          placeholder: "Open-Meteo 免费无需 Key",
          maxLength: 128,
          onChange: (event) => save("weatherKey", event.target.value)
        })] }),
        jsxs("div", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none", flexWrap: "wrap" }, children: [
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px", wordBreak: "break-all" }, children: status }),
          jsx("button", { type: "button", disabled: busy, onClick: testNow, children: busy ? "测试中…" : "测试连接" })
        ] })
      ]});
    }
    function MascotStatRow({ label, value, suffix }) {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: label }), jsx("span", { children: String(value) + (suffix || "") })] });
    }
    const MASCOT_ACHIEVEMENTS = [
      ["first-pat", "🫳", "初次摸头", "第一次摸 鲸鱼娘的头"], ["ten-pats", "🖐️", "摸头十连", "累计摸头 10 次"], ["hundred-pats", "💯", "摸头百连", "累计摸头 100 次"],
      ["first-feed", "🍰", "投喂成功", "第一次投喂小点心"], ["first-triple", "🎉", "三连击", "触发比心彩蛋"], ["thanks", "💬", "嘴甜", "对 鲸鱼娘说谢谢"],
      ["lv5", "⭐", "五级", "好感度达到 Lv5"], ["lv10", "👑", "十级", "好感度达到 Lv10"], ["signin3", "📅", "常客", "连续签到 3 天"],
      ["signin7", "🗓️", "一周之约", "连续签到 7 天"], ["night-owl", "🌙", "深夜陪伴", "深夜互动一次"], ["comeback", "👋", "欢迎回来", "久别重逢"],
      ["day1", "💞", "一日之缘", "陪伴满 1 天"], ["day7", "💎", "一周相伴", "陪伴满 7 天"], ["day30", "🏛️", "三十日契约", "陪伴满 30 天"],
      ["first-tool", "🛠️", "开工啦", "第一次工具运行"], ["tools-10", "🔧", "工具十连", "工具运行 10 次"], ["tools-50", "🏭", "工具五十连", "工具运行 50 次"], ["tools-100", "🛰️", "工具百连", "工具运行 100 次"],
      ["first-code", "💻", "代码初体验", "第一次代码/终端"], ["code-20", "📟", "代码狂人", "代码/终端 20 个"], ["first-success", "✅", "旗开得胜", "第一次任务完成"],
      ["success-10", "🏆", "任务十连", "任务完成 10 次"], ["first-failure", "🩹", "初次翻车", "第一次任务报错"], ["fail-10", "🚑", "翻车十连", "任务报错 10 次"],
      ["messages-100", "💌", "会话百条", "会话消息 100 条"], ["messages-500", "📚", "消息五百条", "会话消息 500 条"], ["keyword-master", "🔍", "关键词大师", "关键词互动 10 次"],
      ["night-work", "🦉", "深夜赶工", "深夜工具仍在运行"], ["balance-low", "🪙", "余额告急", "触发余额不足提醒"],
      ["game-first", "🫧", "初次开玩", "第一次结算一局小游戏"], ["game-win", "👑", "泡泡之王", "单局戳泡泡得分达到 300"], ["game-combo10", "🔥", "连击达人", "单局最高连击达到 10"], ["game-highscore", "🏆", "纪录刷新", "打破一次历史最高分"],
      ["quest-first", "🎯", "任务初体验", "完成第一个每日任务"], ["quest-all", "🎟️", "一日全勤", "单日 3 个每日任务全部领取"], ["week-signin7", "🏆", "周常满勤", "本周签到板集满 7 格"],
      ["bond-action", "🌟", "新动作解锁", "好感度达到 Lv3"], ["bond-badge", "🎖️", "称号首解锁", "好感度达到 Lv5"]
    ];
    function MascotAchievementWall({ ids }) {
      const unlocked = ids.length;
      return jsxs("div", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0 10px", width: "100%" }, children: [
        jsxs("div", { style: { display: "flex", justifyContent: "space-between", width: "100%" }, children: [jsx("span", { children: "成就墙" }), jsx("span", { children: unlocked + " / " + MASCOT_ACHIEVEMENTS.length })] }),
        jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: "6px", width: "100%" }, children: MASCOT_ACHIEVEMENTS.map(([id, icon, name]) => {
          const on = ids.indexOf(id) !== -1;
          return jsxs("div", { title: name, style: { alignItems: "center", background: on ? "var(--dsw-alias-interactive-bg-hover)" : "transparent", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "2px", opacity: on ? 1 : 0.38, padding: "6px 4px", textAlign: "center" }, children: [jsx("span", { style: { fontSize: "16px" }, children: icon }), jsx("span", { style: { fontSize: "11px", lineHeight: "14px" }, children: name })] });
        }) })
      ]});
    }
    function MascotBar({ label, value, text, max }) {
      const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / (Number(max) || 100) * 100)));
      return jsxs("div", { style: { alignItems: "center", display: "flex", gap: "10px", padding: "2px 0" }, children: [
        jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", minWidth: "58px" }, children: label }),
        jsx("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "6px", overflow: "hidden" }, children: jsx("div", { style: { background: "var(--dsw-static-accent, #4da3ff)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: pct + "%" } }) }),
        jsx("span", { style: { fontSize: "12px", fontWeight: "600", minWidth: "44px", textAlign: "right" }, children: text })
      ] });
    }
    function MascotOverviewCard() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        window.addEventListener("storage", refresh);
        return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
      }, []);
      const mood = MascotValue("mood", "70");
      const affinity = MascotValue("affinity", "0");
      const level = MascotValue("level", "1");
      const streak = MascotValue("signinStreak", "0");
      const since = Number(MascotValue("companionSince", ""));
      const days = since > 0 ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
      const chips = [["😊", String(mood), "心情"], ["💗", String(affinity), "好感度"], ["⭐", "Lv." + level, "等级"], ["📅", streak + " 天", "签到"], ["⏳", days + " 天", "陪伴"]];
      return jsxs("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", margin: "10px auto 0", padding: "8px 14px", width: "95%" }, children: [
        jsx("div", { style: { display: "flex", gap: "6px", width: "100%" }, children: chips.map(([icon, value, label]) => jsxs("div", { style: { alignItems: "center", background: "var(--dsw-alias-interactive-bg-hover, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "8px", display: "flex", flex: 1, flexDirection: "column", gap: "1px", minWidth: 0, overflow: "hidden", padding: "4px 2px" }, children: [
          jsxs("span", { style: { fontSize: "11px", fontWeight: "600", lineHeight: "15px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [icon, " ", value] }),
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", lineHeight: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label })
        ] })) }),
        jsx("div", { style: { background: "var(--dsw-alias-border-l2)", height: "1px", margin: "8px 0 2px" } }),
        jsx(MascotTitleRow, { compact: true })
      ] });
    }
    function MascotSwitchGrid() {
      const rows = [
        { label: "鲸鱼娘", prefKey: "pet" },
        { label: "台词气泡", prefKey: "chat" },
        { label: "粒子效果", prefKey: "particles" },
        { label: "小游戏", prefKey: "game" },
        { label: "关键词感知", prefKey: "keywords" },
        { label: "摸鱼提醒", prefKey: "idle-nudge" },
        { label: "深夜模式", prefKey: "night" },
        { label: "天气特效", prefKey: "weatherFx" }
      ];
      return jsx("div", { style: { display: "grid", gap: "2px 14px", gridTemplateColumns: "1fr 1fr", padding: "2px 0 8px", width: "100%" }, children: rows.map((r) => jsx(MascotPrefRow, { key: r.prefKey, label: r.label, prefKey: r.prefKey, compact: true })) });
    }
    function MascotDailyQuests() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        window.addEventListener("storage", refresh);
        return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
      }, []);
      const pool = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.QUEST_POOL) || [];
      const defOf = (id) => pool.find((q) => q.id === id) || { id, desc: id, target: 1, reward: { affinity: 0, mood: 0 } };
      let quests = null;
      try { const raw = window.localStorage.getItem("whale-moe:quests"); quests = raw ? JSON.parse(raw) : null; } catch (e) { quests = null; }
      const today = (() => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })();
      const slots = quests && quests.date === today && Array.isArray(quests.slots) ? quests.slots : [];
      const claim = (id) => {
        try { if (window.__dshWhaleMoeClaimQuest) window.__dshWhaleMoeClaimQuest(id); } catch (e) {}
        setTick((v) => v + 1);
      };
      if (!slots.length) return jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "今日任务加载中，稍后自动刷新" });
      return jsx("div", { style: { display: "flex", flexDirection: "column", padding: "2px 0 4px", width: "100%" }, children: slots.map((slot, index) => {
        const def = defOf(slot.id);
        const done = slot.progress >= def.target;
        const last = index === slots.length - 1;
        return jsxs("div", { style: { alignItems: "center", borderBottom: last ? "none" : "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "10px", minHeight: "44px" }, children: [
          jsx("span", { style: { flex: 1, fontSize: "13px", lineHeight: "18px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: def.desc }),
          jsxs("div", { style: { alignItems: "center", display: "flex", gap: "6px", width: "104px" }, children: [
            jsx("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "7px", overflow: "hidden" }, children: jsx("div", { style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-label-secondary, #888)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: Math.min(100, Math.round(slot.progress / def.target * 100)) + "%" } }) }),
            jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px", whiteSpace: "nowrap" }, children: String(Math.min(slot.progress, def.target)) + "/" + String(def.target) })
          ] }),
          slot.claimed
            ? jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", textAlign: "right", width: "58px" }, children: "✅ 已领" })
            : jsx("button", { type: "button", disabled: !done, onClick: () => claim(slot.id), style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "1px solid var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "8px", color: done ? "#fff" : "var(--dsw-alias-label-secondary)", cursor: done ? "pointer" : "default", fontSize: "12px", height: "26px", padding: "0 10px", width: "58px" }, children: "领取" })
        ] });
      }) });
    }
    function MascotWeekSignin() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        return () => window.removeEventListener("whale-moe-prefs-change", refresh);
      }, []);
      let week = null;
      try { const raw = window.localStorage.getItem("whale-moe:weekSignin"); week = raw ? JSON.parse(raw) : null; } catch (e) { week = null; }
      const days = week && Array.isArray(week.days) ? week.days.length : 0;
      const labels = ["一", "二", "三", "四", "五", "六", "日"];
      return jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0 10px", width: "100%" }, children: [
        jsx("div", { style: { display: "flex", gap: "4px" }, children: Array.from({ length: 7 }, (_, i) => jsxs("div", { style: { alignItems: "center", display: "flex", flex: 1, flexDirection: "column", gap: "4px" }, children: [
          jsx("span", { style: { alignItems: "center", background: i < days ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "50%", color: i < days ? "#fff" : "transparent", display: "flex", fontSize: "12px", height: "26px", justifyContent: "center", width: "26px" }, children: "✓" }),
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px" }, children: labels[i] })
        ] })) }),
        jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px" }, children: "本周已签到 " + days + " / 7 天 · 集满 1/3/7 天有里程碑奖励" })
      ] });
    }
    function MascotBadgeRow() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        return () => window.removeEventListener("whale-moe-prefs-change", refresh);
      }, []);
      const level = Number(MascotValue("level", "1")) || 1;
      const badges = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.BOND && window.DshWhaleMoeCore.BOND.badges) || [];
      const unlocked = badges.filter((b) => level >= b.minLevel);
      const current = MascotValue("badge", "");
      if (!unlocked.length) return jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "未解锁（好感度 Lv5 解锁首个称号）" });
      return jsxs("label", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none" }, children: [jsx("span", { children: "称号" }), jsx("select", {
        value: current,
        onChange: (event) => { const value = event.target.value; try { if (window.__dshWhaleMoeApplyBadge) window.__dshWhaleMoeApplyBadge(value); else window.localStorage.setItem("whale-moe:badge", value); } catch (e) {} setTick((v) => v + 1); },
        children: [jsx("option", { value: "", children: "（不使用称号）" })].concat(unlocked.map((b) => jsx("option", { value: b.id, children: b.name })))
      }) ] });
    }
    function MascotAccordion({ title, icon, summary, defaultOpen, children }) {
      const [open, setOpen] = React.useState(!!defaultOpen);
      const left = jsxs("span", { style: { alignItems: "center", display: "flex", gap: "8px", minWidth: 0 }, children: [
        jsx("span", { style: { fontSize: "14px" }, children: icon || "" }),
        jsxs("span", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", minWidth: 0 }, children: [
          jsx("span", { style: { fontSize: "13px", fontWeight: "600" }, children: title }),
          summary ? jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", fontWeight: "400" }, children: summary }) : null
        ] })
      ] });
      const right = jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px" }, children: open ? "▾" : "▸" });
      return jsxs("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", marginTop: "10px", overflow: "hidden", width: "100%" }, children: [
        jsxs("button", { type: "button", onClick: () => setOpen(!open), style: { alignItems: "center", background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "10px 14px", width: "100%" }, children: [left, right] }),
        open ? jsx("div", { style: { padding: "0 14px 8px" }, children }) : null
      ] });
    }
    function MascotTabs({ active, onChange, tabs }) {
      const list = tabs || [{ id: "quests", label: "今日任务" }, { id: "week", label: "本周签到" }];
      return jsx("div", { style: { background: "var(--dsw-alias-interactive-bg-hover, transparent)", borderRadius: "10px", display: "flex", gap: "4px", marginBottom: "8px", padding: "3px" }, children: list.map((t) => jsx("button", { key: t.id, type: "button", onClick: () => onChange(t.id), style: { background: active === t.id ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "none", borderRadius: "8px", color: active === t.id ? "#fff" : "inherit", cursor: "pointer", flex: 1, fontSize: "13px", padding: "6px 0" }, children: t.label })) });
    }
    function MascotDailyCard() {
      const [tab, setTab] = React.useState("quests");
      return jsxs(MascotAccordion, { title: "日常与养成", icon: "🎯", summary: "任务、签到与称号", defaultOpen: false, children: [
        jsx(MascotTabs, { active: tab, onChange: setTab, tabs: [{ id: "quests", label: "今日任务" }, { id: "week", label: "本周签到" }, { id: "badge", label: "称号" }] }),
        tab === "quests" ? jsx(MascotDailyQuests, {}) : (tab === "week" ? jsx(MascotWeekSignin, {}) : jsx(MascotBadgeRow, {}))
      ] });
    }
    function MascotAchievementRow() {
      const ids = MascotValue("achievements", "").split(",").filter(Boolean);
      return jsx(MascotAchievementWall, { ids });
    }
    function MascotResetRow() {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "悬浮位置" }), jsx("button", { type: "button", onClick: () => { try { window.localStorage.removeItem("whale-moe:floatX"); window.localStorage.removeItem("whale-moe:floatY"); } catch (e) {} window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "float-reset", value: true } })); }, children: "重置到默认位置" })] });
    }
    function MascotGrowthResetRow() {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "养成数据" }), jsx("button", { type: "button", onClick: () => { ["mood", "affinity", "satiety", "lastSignin", "signinStreak", "achievements", "companionSince", "level", "quests", "weekSignin", "badge", "gameStats"].forEach((k) => { try { window.localStorage.removeItem("whale-moe:" + k); } catch (e) {} }); window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth-reset", value: true } })); }, children: "重置养成" })] });
    }
    function MascotPrefRows() {
      return jsxs("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
        jsx(MascotOverviewCard, {}),
        jsxs(MascotAccordion, { title: "陪伴表现", icon: "🎛️", summary: "鲸鱼娘怎么出现、怎么说话", defaultOpen: true, children: [jsx(MascotSwitchGrid, {})] }),
        jsx(MascotAccordion, { title: "天气", icon: "⛅", summary: "城市与天气特效", defaultOpen: false, children: [jsx(MascotWeatherRow, {}), jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "15px", padding: "0 0 6px" }, children: "特效需已填写城市、且天气数据新鲜时才会显示；工作繁忙时自动减弱，雷闪停播。" })] }),
        jsx(MascotDailyCard, {}),
        jsx(MascotAccordion, { title: "成就墙", icon: "🏅", summary: "已解锁 " + MascotValue("achievements", "").split(",").filter(Boolean).length + " / " + MASCOT_ACHIEVEMENTS.length, defaultOpen: false, children: [jsx(MascotAchievementRow, {})] }),
        jsx(MascotAccordion, { title: "数据与重置", icon: "🗂️", summary: "位置与养成数据", defaultOpen: false, children: [jsx(MascotResetRow, {}), jsx(MascotGrowthResetRow, {})] })
      ]});
    }
    /* 设置面板内容优先走子 slot 渲染（settings.mascot.item，可被其他插件扩展）；
       renderSlot 缺失或抛错时直接回落到 MascotPrefRows，保证任何宿主版本下面板都不空白。 */
    function MascotSection(props) {
      const renderSlot = props && typeof props.renderSlot === "function" ? props.renderSlot : null;
      if (renderSlot !== null) {
        try {
          const rendered = renderSlot("settings.mascot.item", {});
          if (rendered !== null && rendered !== undefined) {
            return jsx("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: rendered });
          }
        } catch (e) {
          console.warn("[dsh-whale-musume] settings.mascot.item 渲染失败，回落到内置面板", e);
        }
      }
      return jsx(MascotPrefRows, {});
    }

    function registerSettings(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) {
        console.warn("[dsh-whale-musume] slots 服务不可用，跳过设置面板注册（桌宠本体不受影响）");
        return;
      }
      slots.inject("settings.section", () => slots.register(
        { name: "settings.section", id: "mascot", order: 6, label: "看板娘", children: { "settings.mascot.item": { kind: "list", scope: "root" } } },
        MascotSection
      ));
      slots.inject("settings.mascot.item", () => slots.register(
        { name: "settings.mascot.item", id: "mascot-prefs", order: 0 },
        MascotPrefRows
      ));
    }

    function apply(ctx) {
      boot();
      /* 设置面板是增强项：注册失败也要保证桌宠本体正常出现。 */
      try {
        registerSettings(ctx);
      } catch (e) {
        console.warn("[dsh-whale-musume] 设置面板注册失败，桌宠本体不受影响", e);
      }
    }

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  },
});
