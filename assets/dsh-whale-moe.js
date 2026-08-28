/* dsh-whale-moe v3 — mascot-only presenter (no theme pack dependency).
   Rules: own nodes only, no business-DOM mutation, no text reading,
   one MutationObserver (120ms debounce), no ambient rAF.
   Activation: always on; toggled off via its own gear menu
   (localStorage "whale-moe:pet" = "0"). */
(function (root) {
  "use strict";
  if (!root || !root.document) return;

  var core = root.DshWhaleMoeCore;
  var doc = root.document;
  var VIEW_ATTR = "data-dsh-whale-view";
  var ASSET_ROOT = "/assets/generated/";
  var POSE_VERSION = "?v=5";
  var DEBOUNCE_MS = 120;
  var PARTICLE_MAX = 30;
  var HEART_CHARS = ["♥", "✿", "☆", "♪"];

  var PREFS = [
    { key: "pet", label: "看板娘" },
    { key: "chat", label: "台词气泡" },
    { key: "particles", label: "粒子效果" }
  ];

  var VIEW_SELECTORS = Object.freeze({
    settings: '[role="dialog"], [data-slot="settings.header"]',
    workbench: '[data-slot="conversation.chat.node"], [data-phase="session"]'
  });

  /* Structural signal banks: presence-only detection, never reads text.
     data-running / data-state="ongoing" are the real DSH terminal/turn
     indicators (from the web-frontend bundle). data-state="running" is NOT
     a live DSH state — historical step cards keep it forever and would pin
     the mascot as permanently busy. The data-status variants stay only for
     test fixtures and older builds. */
  var SIGNAL_BANKS = Object.freeze({
    thinking: ['[aria-busy="true"]', '[data-status="pending"]', '[data-state="loading"]', '[data-slot="conversation.chat.node"] [class*="stream" i]'],
    tool: ['[data-role="tool"]', '[data-tool="true"]', '[data-tool-card="true"]', '[data-status="running"]', '[data-running]', '[data-state="ongoing"]', '[data-state="running"]'],
    error: ['[data-state="error"]:not([class*="turnErrorDot"])', '[data-status="error"]', '[aria-invalid="true"]'],
    success: ['[data-state="success"]', '[data-status="success"]'],
    code: ['pre', '[data-slot="terminal"]', '[data-role="log"]', '[data-terminal]'],
    chat: ['[data-slot="conversation.chat.node"]']
  });

  function readPref(key) {
    try { return root.localStorage.getItem("whale-moe:" + key) !== "0"; } catch (e) { return true; }
  }
  function writePref(key, value) {
    try { root.localStorage.setItem("whale-moe:" + key, value ? "1" : "0"); } catch (e) { /* storage unavailable */ }
  }

  var MODES = Object.freeze({ auto: 1, bar: 1, side: 1, float: 1, mini: 1 });
  function readMode() {
    try {
      var value = root.localStorage.getItem("whale-moe:mode");
      if (value === null) return "float";
      return MODES[value] ? value : "float";
    } catch (e) { return "float"; }
  }
  function readFloatPos() {
    try {
      var rawX = root.localStorage.getItem("whale-moe:floatX");
      var rawY = root.localStorage.getItem("whale-moe:floatY");
      if (rawX === null || rawY === null) return null;
      var x = Number(rawX);
      var y = Number(rawY);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x: x, y: y };
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeFloatPos(x, y) {
    try {
      root.localStorage.setItem("whale-moe:floatX", String(Math.round(x)));
      root.localStorage.setItem("whale-moe:floatY", String(Math.round(y)));
    } catch (e) { /* storage unavailable */ }
  }

  function isVisible(node) {
    if (!node) return false;
    if (typeof node.getBoundingClientRect !== "function") return true;
    var rect = node.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) return false;
    if (node.ownerDocument && node.ownerDocument.defaultView && typeof node.ownerDocument.defaultView.getComputedStyle === "function") {
      var style = node.ownerDocument.defaultView.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    }
    return true;
  }

  function firstVisible(selector) {
    var nodes = doc.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) if (isVisible(nodes[i])) return nodes[i];
    return null;
  }
  function anyVisible(selectors) {
    for (var i = 0; i < selectors.length; i += 1) if (firstVisible(selectors[i])) return true;
    return false;
  }
  function countVisible(selectors) {
    var seen = new Set();
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = doc.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) if (isVisible(nodes[j])) seen.add(nodes[j]);
    }
    return seen.size;
  }

  function detectView() {
    if (firstVisible(VIEW_SELECTORS.settings)) return "settings";
    if (firstVisible(VIEW_SELECTORS.workbench)) return "workbench";
    return "home";
  }

  function findComposerSurface() {
    var card = firstVisible('[data-composer-card="true"]');
    if (card) return card;
    var textarea = firstVisible('[data-slot="conversation.composer.bar"] textarea');
    return textarea && textarea.closest ? textarea.closest("form, [class]") : null;
  }

  /* ---------- own layers ---------- */

  function removeRoot() {
    var nodes = doc.querySelectorAll("[data-dsh-whale-root]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
    var particles = doc.querySelectorAll("[data-dsh-whale-particle]");
    for (var p = 0; p < particles.length; p += 1) particles[p].remove();
    var games = doc.querySelectorAll("[data-dsh-whale-game], [data-dsh-whale-catch]");
    for (var g = 0; g < games.length; g += 1) games[g].remove();
    gameOpen = false;
    catchOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    weatherFxStop();
  }

  function createToggleButton(label, key) {
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-dsh-whale-toggle", key);
    btn.setAttribute("aria-pressed", String(readPref(key)));
    btn.textContent = label + (readPref(key) ? "：开" : "：关");
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var next = !readPref(key);
      writePref(key, next);
      btn.setAttribute("aria-pressed", String(next));
      btn.textContent = label + (next ? "：开" : "：关");
      reconcile();
    });
    return btn;
  }

  var layerState = { active: "a", loaded: { a: "", b: "" }, gen: 0, pendingSwap: "", pendingSince: 0 };

  function setPose(src, animate, soft) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode) return;
    if (src && src.indexOf("?") === -1) src += POSE_VERSION;
    var nextName = layerState.active === "a" ? "b" : "a";
    var current = rootNode.querySelector('[data-dsh-whale-layer="' + layerState.active + '"]');
    var next = rootNode.querySelector('[data-dsh-whale-layer="' + nextName + '"]');
    if (!current || !next) return;

    /* A previous blink/transition can leave an inline opacity that would pin
       an inactive layer visible under the new pose — always clear it. */
    current.style.opacity = "";
    next.style.opacity = "";

    /* Stuck-animation recovery: background/throttled tabs can pause WAAPI so
       neither onfinish nor oncancel fires. If a swap has been pending too long,
       land it immediately on the layer that was already loaded for the swap. */
    if (layerState.pendingSwap && Date.now() - layerState.pendingSince > 1600) {
      layerState.gen += 1;
      layerState.pendingSwap = "";
      layerState.pendingSince = 0;
      next.classList.add("dsh-whale-active");
      current.classList.remove("dsh-whale-active");
      layerState.active = nextName;
    }

    if (layerState.loaded[layerState.active] === src) return;

    /* Motion-hide swap (industry sprite/VTuber style): old pose squashes down
       quickly, the image is swapped at the heaviest motion point, then the new
       pose pops back with overshoot. No opacity crossfade, and the two layers
       are never active at the same time.
       soft=false → click/reaction poses switch instantly (no transition). */
    function swap() {
      var motionNode = rootNode.querySelector("[data-dsh-whale-motion]");
      function applyLayers() {
        next.classList.add("dsh-whale-active");
        current.classList.remove("dsh-whale-active");
        layerState.active = nextName;
        layerState.pendingSwap = "";
        layerState.pendingSince = 0;
      }
      if (!soft || motionReduced() || !motionNode || typeof motionNode.animate !== "function") {
        applyLayers();
        return;
      }
      /* 待机微动作和换图动画不能叠在同一节点上，先取消 */
      motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint");
      var swapGen = layerState.gen;
      layerState.pendingSwap = src;
      layerState.pendingSince = Date.now();
      var hide = motionNode.animate(
        [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(12px) scale(0.86, 0.92)" }
        ],
        { duration: 140, easing: "cubic-bezier(0.55, 0, 1, 0.45)" }
      );
      hide.oncancel = function () {
        hide.onfinish = null;
        if (swapGen !== layerState.gen) {
          /* 本次换图已被更新的换图取代：只清理属于自己的标记，
             绝不能把新一代动画的 pendingSwap 一起抹掉，否则渲染循环
             会反复重启同一组动画，表现为“抽搐”。 */
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = "";
            layerState.pendingSince = 0;
          }
          return;
        }
        applyLayers();
      };
      hide.onfinish = function () {
        hide.onfinish = null;
        if (swapGen !== layerState.gen) {
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = "";
            layerState.pendingSince = 0;
          }
          return;
        }
        applyLayers();
        motionNode.animate(
          [
            { transform: "translateY(18px) scale(0.88, 0.94)" },
            { transform: "translateY(0) scale(1)" }
          ],
          { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      };
    }

    if (!animate || layerState.loaded[layerState.active] === "") {
      layerState.gen += 1;
      layerState.pendingSwap = "";
      layerState.pendingSince = 0;
      current.setAttribute("src", src);
      current.classList.add("dsh-whale-active");
      next.classList.remove("dsh-whale-active");
      layerState.loaded[layerState.active] = src;
      return;
    }
    if (layerState.loaded[nextName] === src) {
      if (layerState.pendingSwap === src) return; /* already animating this swap */
      layerState.gen += 1;
      swap();
      return;
    }
    next.setAttribute("src", src);
    layerState.loaded[nextName] = src;
    layerState.gen += 1;
    var gen = layerState.gen;
    next.addEventListener("load", function handler() {
      next.removeEventListener("load", handler);
      if (gen !== layerState.gen) return; /* superseded by a newer pose */
      if (layerState.pendingSwap === src) return;
      swap();
    }, { once: true });
  }

  function burst(symbol) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced()) return;
    var node = doc.createElement("span");
    node.setAttribute("data-dsh-whale-burst", "true");
    node.textContent = symbol;
    rootNode.appendChild(node);
    node.addEventListener("animationend", function () { node.remove(); }, { once: true });
    root.setTimeout(function () { node.remove(); }, 1000);
  }

  function emojiBurst(symbols) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced() || !symbols || !symbols.length) return;
    for (var i = 0; i < symbols.length; i += 1) {
      var node = doc.createElement("span");
      node.setAttribute("data-dsh-whale-burst", "true");
      node.className = "dsh-emoji-fly";
      node.textContent = symbols[i];
      var side = i % 2 === 0 ? -1 : 1;
      node.style.setProperty("--wm-dx", String(side * (14 + (i % 3) * 12)) + "px");
      node.style.setProperty("--wm-dy", String(-34 - (i % 3) * 16) + "px");
      node.style.setProperty("--wm-rot", String(side * (8 + i * 7)) + "deg");
      node.style.animationDelay = (i * 55) + "ms";
      rootNode.appendChild(node);
      node.addEventListener("animationend", function () { node.remove(); }, { once: true });
      root.setTimeout(function () { node.remove(); }, 1200 + i * 60);
    }
  }

  var typingTimer = null;
  var nextTimer = null;
  function typeBubble(textNode, line) {
    if (typingTimer) root.clearTimeout(typingTimer);
    memory.currentTypingLine = line;
    if (motionReduced()) {
      textNode.textContent = line;
      memory.currentTypingLine = "";
      typingTimer = null;
      return;
    }
    textNode.textContent = "";
    var caret = doc.createElement("span");
    caret.setAttribute("data-dsh-whale-caret", "true");
    caret.textContent = "▍";
    textNode.appendChild(caret);
    var index = 0;
    (function tick() {
      if (index >= line.length) {
        caret.remove();
        typingTimer = null;
        memory.currentTypingLine = "";
        return;
      }
      var ch = line.charAt(index);
      textNode.insertBefore(doc.createTextNode(ch), caret);
      index += 1;
      var delay = 64;
      if ("，。！？～…".indexOf(ch) !== -1) delay = 260;
      else if (ch === " ") delay = 90;
      else if (index % 5 === 0) delay = 130;
      typingTimer = root.setTimeout(tick, delay);
    })();
  }

  function ensureRoot() {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (rootNode) return rootNode;
    rootNode = doc.createElement("div");
    rootNode.setAttribute("data-dsh-whale-root", "true");

    var frame = doc.createElement("div");
    frame.setAttribute("data-dsh-whale-frame", "true");
    frame.setAttribute("data-dsh-whale-mascot", "true");
    frame.setAttribute("aria-hidden", "true");

    var motion = doc.createElement("div");
    motion.setAttribute("data-dsh-whale-motion", "true");

    var layerA = doc.createElement("img");
    layerA.alt = "";
    layerA.draggable = false;
    layerA.setAttribute("data-dsh-whale-layer", "a");
    layerA.addEventListener("error", function () { layerA.style.display = "none"; });
    layerA.addEventListener("load", function () { layerA.style.display = ""; });
    var layerB = doc.createElement("img");
    layerB.alt = "";
    layerB.draggable = false;
    layerB.setAttribute("data-dsh-whale-layer", "b");
    layerB.addEventListener("error", function () { layerB.style.display = "none"; });
    layerB.addEventListener("load", function () { layerB.style.display = ""; });
    motion.appendChild(layerA);
    motion.appendChild(layerB);
    frame.appendChild(motion);

    var bubble = doc.createElement("div");
    bubble.setAttribute("data-dsh-whale-bubble", "true");
    bubble.hidden = true;
    var text = doc.createElement("span");
    text.setAttribute("data-dsh-whale-bubble-text", "true");
    var gear = doc.createElement("button");
    gear.type = "button";
    gear.setAttribute("data-dsh-whale-gear", "true");
    gear.setAttribute("aria-label", "鲸鱼娘偏好");
    gear.textContent = "⚙";
    gear.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu();
    });
    bubble.appendChild(text);
    bubble.appendChild(gear);

    var gearMini = doc.createElement("button");
    gearMini.type = "button";
    gearMini.setAttribute("data-dsh-whale-gear-mini", "true");
    gearMini.setAttribute("aria-label", "鲸鱼娘偏好");
    gearMini.textContent = "⚙";
    gearMini.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu();
    });

    var menu = doc.createElement("div");
    menu.setAttribute("data-dsh-whale-prefs", "true");
    menu.hidden = true;
    for (var i = 0; i < PREFS.length; i += 1) menu.appendChild(createToggleButton(PREFS[i].label, PREFS[i].key));

    rootNode.appendChild(frame);
    rootNode.appendChild(bubble);
    rootNode.appendChild(gearMini);
    rootNode.appendChild(menu);
    doc.body.appendChild(rootNode);

    rootNode.addEventListener("click", function (event) { event.stopPropagation(); });
    var suppressClick = false;
    frame.addEventListener("click", function (event) {
      event.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      var m = rootNode.querySelector("[data-dsh-whale-motion]");
      if (m && !motionReduced()) {
        m.classList.remove("dsh-whale-react");
        void m.offsetWidth;
        m.classList.add("dsh-whale-react");
        root.setTimeout(function () { m.classList.remove("dsh-whale-react"); }, 650);
      }
      patMascot(resolveHitZone(event.clientX, event.clientY, rootNode));
    });
    frame.addEventListener("pointerdown", function (event) {
      pressStartedAt = Date.now();
      if (readMode() === "float" && event.button === 0) startDrag(event, rootNode);
    });
    frame.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event.clientX, event.clientY);
    });
    rootNode.__dshWhaleMoeSuppressClick = function () { suppressClick = true; };
    return rootNode;
  }

  var dragState = null;
  function startDrag(event, rootNode) {
    event.preventDefault();
    dragState = {
      node: rootNode,
      dx: event.clientX - rootNode.getBoundingClientRect().left,
      dy: event.clientY - rootNode.getBoundingClientRect().top,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY
    };
    root.addEventListener("pointermove", onDrag, true);
    root.addEventListener("pointerup", endDrag, true);
    root.addEventListener("pointercancel", endDrag, true);
  }
  function onDrag(event) {
    if (!dragState) return;
    var node = dragState.node;
    var width = node.getBoundingClientRect().width;
    var height = node.getBoundingClientRect().height;
    var left = event.clientX - dragState.dx;
    var top = event.clientY - dragState.dy;
    if (!dragState.moved && (Math.abs(event.clientX - dragState.startX) > 4 || Math.abs(event.clientY - dragState.startY) > 4)) {
      dragState.moved = true;
      node.classList.add("dsh-whale-dragging");
      schedule();
    }
    node.style.left = Math.round(clamp(left, 8, root.innerWidth - width - 8)) + "px";
    node.style.top = Math.round(clamp(top, 8, root.innerHeight - height - 8)) + "px";
    if (dragState.moved) {
      /* 摇摆跟随光标水平速度，而不是自动动画 */
      var motionNode = node.querySelector("[data-dsh-whale-motion]");
      if (motionNode) {
        var vx = event.clientX - dragState.lastX;
        var angle = clamp(vx * 1.1, -16, 16);
        motionNode.style.setProperty("--wm-drag-angle", angle.toFixed(1) + "deg");
      }
    }
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
  }
  function endDrag() {
    root.removeEventListener("pointermove", onDrag, true);
    root.removeEventListener("pointerup", endDrag, true);
    root.removeEventListener("pointercancel", endDrag, true);
    if (dragState && dragState.node) {
      dragState.node.classList.remove("dsh-whale-dragging");
    }
    if (dragState && dragState.moved && dragState.node) {
      writeFloatPos(parseFloat(dragState.node.style.left), parseFloat(dragState.node.style.top));
      var node = dragState.node;
      if (node.__dshWhaleMoeSuppressClick) node.__dshWhaleMoeSuppressClick();
    }
    dragState = null;
    schedule();
  }

  function toggleMenu() {
    var menu = doc.querySelector("[data-dsh-whale-prefs]");
    if (menu) menu.hidden = !menu.hidden;
  }

  function showContextMenu(x, y) {
    var old = doc.querySelector("[data-dsh-whale-context]");
    if (old) old.remove();
    var menu = doc.createElement("div");
    menu.setAttribute("data-dsh-whale-context", "true");
    var items = [
      { label: "投喂小点心", action: function () { var out = applyGrowth({ type: "feed" }, Date.now(), 0); applyQuestSignal("feed", 1); burst("🍰"); showMood("eat", 3000); var line = say("interact", "feed"); if (line) showLine(line); if (out.unlocks.length) announceUnlocks(out.unlocks); } },
      { label: "戳一下", action: function () { applyGrowth({ type: "poke" }, Date.now(), 0); burst("💢"); showMood("angry", 3000); var line = say("interact", "poke"); if (line) showLine(line); } },
      { label: "夸夸 鲸鱼娘", action: function () { applyGrowth({ type: "praise" }, Date.now(), 0); burst("✨"); showMood("tail-swing", 3000, true); var line = say("interact", "praise"); if (line) showLine(line); } }
    ];
    if (readPref("game")) {
      items.push({ label: "小游戏：戳泡泡", action: function () { openGame(); } });
      items.push({ label: "小游戏：接点心", action: function () { openCatchGame(); } });
    }
    items.push(
      { label: "回到原位", action: function () { try { root.localStorage.removeItem("whale-moe:floatX"); root.localStorage.removeItem("whale-moe:floatY"); } catch (e) { /* ignore */ } reconcile(); } },
      { label: "打开看板娘设置", action: function () {
        /* DSH 新版设置入口是纯图标按钮(无文本),旧版是文本“设置”按钮:
           按 结构 slot → settings.trigger 宿主按钮 → 文本兜底 的顺序查找。 */
        var btn = doc.querySelector('[data-slot="sidebar.settings"] button');
        if (!btn) {
          var trigger = doc.querySelector('[data-slot="settings.trigger"]');
          btn = trigger && trigger.closest ? trigger.closest("button") : null;
        }
        if (!btn) btn = [...doc.querySelectorAll("button")].find(function (n) { return (n.textContent || "").trim() === "设置"; });
        if (btn) btn.click();
      } },
      { label: "关闭菜单", action: function () { menu.remove(); } }
    );
    for (var i = 0; i < items.length; i += 1) {
      (function (item) {
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = item.label;
        btn.addEventListener("click", function (event) { event.stopPropagation(); item.action(); menu.remove(); });
        menu.appendChild(btn);
      })(items[i]);
    }
    doc.body.appendChild(menu);
    menu.style.left = Math.min(x, root.innerWidth - 180) + "px";
    menu.style.top = Math.min(y, root.innerHeight - 160) + "px";
    doc.addEventListener("pointerdown", function closer(event) {
      if (!menu.contains(event.target)) { menu.remove(); doc.removeEventListener("pointerdown", closer, true); }
    }, true);
  }

  /* ---------- interactions ---------- */

  var patHistory = [];
  var celebrateUntil = 0;
  var pressStartedAt = 0;
  var moodTimer = null;
  var lastTripleAt = 0;
  var lastPatProcessedAt = 0;
  var lastPatSpeechAt = 0;
  var lastBalanceLowAt = 0;
  var IDLE_ACTION_POOL = ["daily-eat", "daily-coffee", "daily-stretch", "daily-pajama", "daily-shower", "cool-shades", "meme-smug", "daily-picnic", "daily-cooking", "daily-fishing", "daily-painting", "daily-gaming", "tail-swing", "meme-music"];
  function showMood(kind, duration, animate) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode) return;
    memory.moodPose = kind;
    memory.moodUntil = Date.now() + (duration || 3000);
    memory.moodAnimate = animate === true;
    schedule();
    if (moodTimer) { root.clearTimeout(moodTimer); moodTimer = null; }
    moodTimer = root.setTimeout(function () {
      moodTimer = null;
      memory.moodPose = "";
      memory.moodUntil = 0;
      memory.moodAnimate = false;
      schedule();
    }, duration || 3000);
  }

  function fxAt(x, y, kind) {
    if (motionReduced() || !readPref("particles")) return;
    var span = doc.createElement("span");
    span.setAttribute("data-dsh-whale-fx", "true");
    span.className = kind;
    span.style.left = Math.round(x) + "px";
    span.style.top = Math.round(y) + "px";
    doc.body.appendChild(span);
    span.addEventListener("animationend", function () { span.remove(); }, { once: true });
    root.setTimeout(function () { span.remove(); }, 1300);
  }

  function resolveHitZone(clientX, clientY, rootNode) {
    var rect = rootNode.getBoundingClientRect();
    if (rect.width <= 1) return "head";
    var activeSrc = layerState.loaded[layerState.active] || "";
    var poseSet = /-peek\.webp/.test(activeSrc) ? "peek" : "full";
    var nx = (clientX - rect.left) / rect.width;
    var ny = (clientY - rect.top) / rect.height;
    var zone = core.hitZone(nx, ny, poseSet);
    rootNode.setAttribute("data-dsh-whale-zone", zone);
    return zone;
  }

  function bellyReact(now) {
    applyGrowth({ type: "belly" }, now, 0);
    showMood("react-belly", 2600, true);
    emojiBurst(["💫", "✨"]);
    var line = say("interact", "belly");
    if (line) showLine(line);
    reconcile();
  }

  function tailReact(now) {
    applyGrowth({ type: "tail" }, now, 0);
    showMood("react-tail", 2600, true);
    emojiBurst(["🌀", "💨"]);
    var line = say("interact", "tail");
    if (line) showLine(line);
    reconcile();
  }

  function patMascot(zone) {
    var now = Date.now();
    if (now < celebrateUntil) return;
    var busyNow = BUSY_STATES[memory.state.state] === 1;
    /* 分区反应:非忙态下肚皮/尾巴/头各有专属反应;忙态一律 work-pat/work-ram */
    if (!busyNow && readPref("zones") && zone === "tail") { tailReact(now); return; }
    if (!busyNow && readPref("zones") && zone === "belly") { bellyReact(now); return; }
    patHistory = patHistory.filter(function (t) { return now - t < 2000; });
    patHistory.push(now);
    if (patHistory.length >= 3 && now - lastTripleAt >= 2600) {
      patHistory = [];
      lastTripleAt = now;
      lastPatProcessedAt = now;
      celebrateUntil = now + 2200;
      memory.celebrationVisible = false;
      spawnParticles(12, now);
      showMood("star", 2200);
      var trip = applyGrowth({ type: "triple" }, now, 0);
      if (trip.unlocks.length) announceUnlocks(trip.unlocks);
      var node = doc.querySelector("[data-dsh-whale-root]");
      if (node && !motionReduced()) {
        var motionNode = node.querySelector("[data-dsh-whale-motion]");
        if (motionNode) {
          motionNode.classList.add("dsh-whale-spin");
          root.setTimeout(function () { motionNode.classList.remove("dsh-whale-spin"); }, 850);
        }
      }
    } else {
      /* rapid-fire clicks: keep pose/particle feedback but skip growth and
         speech churn so the bubble never stutters 诶嘿诶嘿 repeatedly */
      var rapid = now - lastPatProcessedAt < 450;
      lastPatProcessedAt = now;
      showMood(busyNow ? (Math.random() < 0.5 ? "work-pat" : "work-ram") : (zone === "head" ? "react-head" : "blush"), busyNow ? 2400 : 2600, true);
      emojiBurst(busyNow ? ["💻", "💦", "✨"] : ["💖", "✨", "⭐"]);
      if (rapid) { reconcile(); return; }
      var pat = applyGrowth({ type: "pat" }, now, patHistory.length);
      applyQuestSignal("pat", 1);
      if (now - lastPatSpeechAt >= 2500) {
        lastPatSpeechAt = now;
        var patLine = say("interact", "pat");
        if (patLine) showLine(patLine);
      }
      if (pat.unlocks.length) announceUnlocks(pat.unlocks);
    }
    reconcile();
  }

  function showLineNow(line) {
    var rootNode = ensureRoot();
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var text = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    if (!bubble || !text) return;
    var wasHidden = bubble.hidden;
    bubble.classList.remove("dsh-whale-out");
    if (memory.bubbleOutTimer) { root.clearTimeout(memory.bubbleOutTimer); memory.bubbleOutTimer = null; }
    typeBubble(text, localizeLine(line));
    bubble.hidden = false;
    memory.bubbleHideAt = Date.now() + 4500;
    if (wasHidden) bubble.classList.add("dsh-whale-pop");
  }

  function scheduleNext() {
    if (nextTimer) root.clearTimeout(nextTimer);
    nextTimer = root.setTimeout(function () {
      nextTimer = null;
      var next = memory.pendingLine;
      memory.pendingLine = "";
      if (next) showLineNow(next);
    }, 160);
  }

  function showLine(line) {
    var rootNode = ensureRoot();
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var text = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    if (!bubble || !text) return;
    /* single-slot queue: never restart the typewriter or stack timers */
    if (!bubble.hidden && (typingTimer || nextTimer)) {
      if (typingTimer) {
        root.clearTimeout(typingTimer);
        typingTimer = null;
        text.textContent = memory.currentTypingLine;
        memory.currentTypingLine = "";
      }
      memory.pendingLine = line;
      scheduleNext();
      return;
    }
    memory.pendingLine = "";
    showLineNow(line);
  }

  function announceUnlocks(ids) {
    var label = core.ACHIEVEMENTS.filter(function (a) { return ids.indexOf(a.id) !== -1; }).map(function (a) { return a.name; }).join("、");
    if (!label) return;
    if (!BUSY_STATES[memory.state.state]) showMood("achievement", 3500, true);
    burst("🏅");
    showLine("成就达成：" + label + "！");
  }

  function spawnParticles(count, now) {
    if (!readPref("particles") || motionReduced()) return;
    var current = doc.querySelectorAll("[data-dsh-whale-particle]").length;
    count = Math.max(0, Math.min(count, PARTICLE_MAX - current));
    var kinds = ["dot", "spark", "heart"];
    for (var i = 0; i < count; i += 1) {
      var span = doc.createElement("span");
      span.setAttribute("data-dsh-whale-particle", "true");
      span.className = "dsh-particle-" + kinds[(now + i) % kinds.length];
      var rootNode = ensureRoot();
      var rect = rootNode.getBoundingClientRect();
      var drift = Math.round((Math.random() - 0.5) * 30);
      span.style.left = Math.round(rect.left + rect.width / 2 + drift) + "px";
      span.style.top = Math.round(rect.top + rect.height * 0.35) + "px";
      span.style.setProperty("--wm-drift", drift + "px");
      doc.body.appendChild(span);
      span.addEventListener("animationend", function () { span.remove(); }, { once: true });
      root.setTimeout(function () { span.remove(); }, 1100);
    }
  }

  function motionReduced() {
    try { return root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  /* ---------- mini game: bubble pop ---------- */

  var gameStats = null;
  var gameState = null;
  var gameOpen = false;
  var gamePausedFlag = false;
  var gameTimer = null;
  var gameCursor = 0;

  function loadGameStats() {
    try {
      var raw = root.localStorage.getItem("whale-moe:gameStats");
      gameStats = raw ? JSON.parse(raw) : { plays: 0, wins: 0, best: 0, comboMax: 0, today: "", playsToday: 0, highscore: false };
    } catch (e) {
      gameStats = { plays: 0, wins: 0, best: 0, comboMax: 0, today: "", playsToday: 0, highscore: false };
    }
    return gameStats;
  }
  function saveGameStats() {
    try { root.localStorage.setItem("whale-moe:gameStats", JSON.stringify(gameStats)); } catch (e) { /* ignore */ }
  }
  function dayKeyOf(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function gamePaused() {
    if (!gameOpen) return true;
    if (doc.hidden) return true;
    return false;
  }

  function gamePanel() {
    return doc.querySelector("[data-dsh-whale-game]");
  }

  function closeGame() {
    gameOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    var panel = gamePanel();
    if (panel) panel.remove();
    schedule();
  }

  function ensureGamePanel() {
    var existing = gamePanel();
    if (existing) {
      existing.focus();
      return existing;
    }
    var panel = doc.createElement("div");
    panel.setAttribute("data-dsh-whale-game", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "小游戏：戳泡泡");
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML = "";
    var head = doc.createElement("div");
    head.setAttribute("data-dsh-whale-game-head", "true");
    var score = doc.createElement("span");
    score.setAttribute("data-dsh-whale-game-score", "true");
    score.textContent = "得分 0";
    var time = doc.createElement("span");
    time.setAttribute("data-dsh-whale-game-time", "true");
    time.textContent = "30s";
    var combo = doc.createElement("span");
    combo.setAttribute("data-dsh-whale-game-combo", "true");
    combo.textContent = "";
    var best = doc.createElement("span");
    best.setAttribute("data-dsh-whale-game-best", "true");
    best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    head.appendChild(score);
    head.appendChild(time);
    head.appendChild(combo);
    head.appendChild(best);
    panel.appendChild(head);
    var grid = doc.createElement("div");
    grid.setAttribute("data-dsh-whale-game-grid", "true");
    for (var i = 0; i < core.GAME.GRID * core.GAME.GRID; i += 1) {
      (function (cell) {
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-dsh-whale-cell", String(cell));
        btn.setAttribute("aria-label", "第 " + (cell + 1) + " 格");
        btn.addEventListener("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
          onGamePop(cell);
        });
        grid.appendChild(btn);
      })(i);
    }
    panel.appendChild(grid);
    var paused = doc.createElement("div");
    paused.setAttribute("data-dsh-whale-game-paused", "true");
    paused.textContent = "⏸ 已暂停";
    paused.hidden = true;
    panel.appendChild(paused);
    doc.body.appendChild(panel);
    panel.addEventListener("keydown", onGameKeydown);
    panel.focus();
    return panel;
  }

  function gamePauseBadge(on, reason) {
    var badge = doc.querySelector("[data-dsh-whale-game-paused]");
    if (!badge) return;
    badge.hidden = !on;
    if (on) badge.textContent = reason === "hidden" ? "⏸ 页面已隐藏，回来继续" : "⏸ 已暂停";
  }

  function openGame() {
    if (!readPref("game")) return;
    if (gameOpen) return;
    if (detectView() === "settings") return; /* 看板娘在设置页隐藏，无入口;此处防御 */
    if (catchOpen) closeCatchGame();
    loadGameStats();
    gameState = core.gameNewState(Date.now(), Math.random);
    gameOpen = true;
    gamePausedFlag = false;
    gameCursor = 0;
    var panel = ensureGamePanel();
    var oldOverlay = panel.querySelector("[data-dsh-whale-game-overlay]");
    if (oldOverlay) oldOverlay.remove();
    gamePauseBadge(false);
    showMood("game-think", 5000, true);
    gameTimer = root.setInterval(gameTickLoop, 250);
    schedule();
  }

  function renderGamePanel() {
    var panel = gamePanel();
    if (!panel || !gameState) return;
    var score = panel.querySelector("[data-dsh-whale-game-score]");
    var time = panel.querySelector("[data-dsh-whale-game-time]");
    var combo = panel.querySelector("[data-dsh-whale-game-combo]");
    var best = panel.querySelector("[data-dsh-whale-game-best]");
    if (score) score.textContent = "得分 " + gameState.score;
    if (time) time.textContent = Math.ceil(gameState.remainingMs / 1000) + "s";
    if (combo) combo.textContent = gameState.combo > 1 ? "连击 x" + gameState.combo : "";
    if (best) best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    var cells = panel.querySelectorAll("[data-dsh-whale-cell]");
    for (var i = 0; i < cells.length; i += 1) {
      var bubble = gameState.board[i];
      cells[i].textContent = "";
      cells[i].removeAttribute("data-dsh-whale-bubble-kind");
      cells[i].classList.remove("dsh-whale-cursor");
      if (bubble) {
        cells[i].setAttribute("data-dsh-whale-bubble-kind", bubble.kind);
        cells[i].textContent = bubble.kind === "star" ? "⭐" : (bubble.kind === "bomb" ? "💣" : "");
        cells[i].setAttribute("aria-label", "第 " + (i + 1) + " 格，" + (bubble.kind === "bomb" ? "炸弹" : "泡泡"));
      } else {
        cells[i].setAttribute("aria-label", "第 " + (i + 1) + " 格");
      }
      if (i === gameCursor) cells[i].classList.add("dsh-whale-cursor");
    }
  }

  function gameTickLoop() {
    if (!gameOpen || !gameState) return;
    var now = Date.now();
    if (gamePaused()) {
      if (!gamePausedFlag) { gamePausedFlag = true; gamePauseBadge(true, "hidden"); }
      return;
    }
    if (gamePausedFlag) { gamePausedFlag = false; gamePauseBadge(false); }
    var out = core.gameTick(gameState, now, Math.random);
    gameState = out.state;
    renderGamePanel();
    if (gameState.status === "ended") endGame(core.gameResult(gameState));
  }

  function onGamePop(cell) {
    if (!gameOpen || !gameState || gameState.status !== "playing") return;
    if (gamePaused()) return;
    var now = Date.now();
    var out = core.gamePop(gameState, cell, now, Math.random);
    gameState = out.state;
    if (out.hit) {
      var btn = doc.querySelector('[data-dsh-whale-cell="' + cell + '"]');
      if (btn) {
        var rect = btn.getBoundingClientRect();
        fxAt(rect.left + rect.width / 2, rect.top + rect.height / 2, "fx-ripple");
      }
      if (out.kind === "star") spawnParticles(6, now);
      if (out.kind === "bomb") showMood("game-cheat", 2200, true);
      if (out.combo >= 5) showMood("game-happy", 2000, true);
    }
    renderGamePanel();
  }

  function onGameKeydown(event) {
    if (!gameOpen) return;
    var key = event.key;
    if (key === "Escape") { event.preventDefault(); closeGame(); return; }
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      var g = core.GAME.GRID;
      var row = Math.floor(gameCursor / g);
      var col = gameCursor % g;
      if (key === "ArrowUp") row = (row + g - 1) % g;
      if (key === "ArrowDown") row = (row + 1) % g;
      if (key === "ArrowLeft") col = (col + g - 1) % g;
      if (key === "ArrowRight") col = (col + 1) % g;
      gameCursor = row * g + col;
      renderGamePanel();
      return;
    }
    if (key === "Enter" || key === " ") { event.preventDefault(); onGamePop(gameCursor); }
  }

  function settleGame(panel, result, againFn, closeFn, extraText) {
    loadGameStats();
    gameStats.plays = (gameStats.plays || 0) + 1;
    var today = dayKeyOf(Date.now());
    if (gameStats.today !== today) { gameStats.today = today; gameStats.playsToday = 0; }
    gameStats.playsToday = (gameStats.playsToday || 0) + 1;
    if (result.grade === "win") gameStats.wins = (gameStats.wins || 0) + 1;
    if (result.comboMax > (gameStats.comboMax || 0)) gameStats.comboMax = result.comboMax;
    var rewardAllowed = core.gameRewardAllowed(gameStats, Date.now());
    if (result.score > (gameStats.best || 0)) {
      gameStats.best = result.score;
      gameStats.highscore = true;
      if (rewardAllowed) applyGrowth({ type: "high-score" }, Date.now(), 0);
    }
    saveGameStats();
    var unlocks = core.evaluateGameAchievements(growth ? growth.achievements : [], gameStats);
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      announceUnlocks(unlocks);
    }
    if (rewardAllowed) {
      var out = applyGrowth({ type: core.gameReward(result.grade) }, Date.now(), 0);
      if (out.leveledUp) onBondLevelUp();
    }
    showMood(result.grade === "win" ? "game-win" : (result.grade === "draw" ? "game-happy" : "game-lose"), 3400, true);
    if (panel) {
      var overlay = doc.createElement("div");
      overlay.setAttribute("data-dsh-whale-game-overlay", "true");
      var titleText = result.grade === "win" ? "🎉 大胜利！" : (result.grade === "draw" ? "及格！" : "再接再厉～");
      var line = doc.createElement("div");
      line.textContent = titleText + " 得分 " + result.score + " · 最佳 " + gameStats.best + " · 最高连击 " + result.comboMax + (extraText ? " · " + extraText : "") + (rewardAllowed ? "" : "（今日奖励已达上限）");
      overlay.appendChild(line);
      if (unlocks.length) {
        var ach = doc.createElement("div");
        ach.textContent = "🏅 新成就解锁！";
        overlay.appendChild(ach);
      }
      var again = doc.createElement("button");
      again.type = "button";
      again.textContent = "再玩一局";
      again.addEventListener("click", function (event) { event.stopPropagation(); againFn(); });
      var close = doc.createElement("button");
      close.type = "button";
      close.textContent = "关闭";
      close.addEventListener("click", function (event) { event.stopPropagation(); closeFn(); });
      overlay.appendChild(again);
      overlay.appendChild(close);
      panel.appendChild(overlay);
    }
  }

  function endGame(result) {
    if (!gameOpen) return;
    gameOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    settleGame(gamePanel(), result, function () { openGame(); }, function () { closeGame(); });
  }

  /* ---------- mini game 2: catch the snacks ---------- */

  var catchState = null;
  var catchOpen = false;
  var catchTimer = null;

  function catchPanel() {
    return doc.querySelector("[data-dsh-whale-catch]");
  }
  function closeCatchGame() {
    catchOpen = false;
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    var panel = catchPanel();
    if (panel) panel.remove();
    schedule();
  }
  function ensureCatchPanel() {
    var existing = catchPanel();
    if (existing) { existing.focus(); return existing; }
    var panel = doc.createElement("div");
    panel.setAttribute("data-dsh-whale-catch", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "小游戏：接点心");
    panel.setAttribute("tabindex", "-1");
    var head = doc.createElement("div");
    head.setAttribute("data-dsh-whale-catch-head", "true");
    var score = doc.createElement("span");
    score.setAttribute("data-dsh-whale-catch-score", "true");
    score.textContent = "得分 0";
    var time = doc.createElement("span");
    time.setAttribute("data-dsh-whale-catch-time", "true");
    time.textContent = "30s";
    var combo = doc.createElement("span");
    combo.setAttribute("data-dsh-whale-catch-combo", "true");
    combo.textContent = "";
    var best = doc.createElement("span");
    best.setAttribute("data-dsh-whale-catch-best", "true");
    best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    head.appendChild(score);
    head.appendChild(time);
    head.appendChild(combo);
    head.appendChild(best);
    panel.appendChild(head);
    var arena = doc.createElement("div");
    arena.setAttribute("data-dsh-whale-catch-arena", "true");
    var basket = doc.createElement("div");
    basket.setAttribute("data-dsh-whale-catch-basket", "true");
    basket.textContent = "🧺";
    arena.appendChild(basket);
    panel.appendChild(arena);
    var paused = doc.createElement("div");
    paused.setAttribute("data-dsh-whale-catch-paused", "true");
    paused.textContent = "⏸ 页面已隐藏，回来继续";
    paused.hidden = true;
    panel.appendChild(paused);
    doc.body.appendChild(panel);
    panel.addEventListener("keydown", onCatchKeydown);
    arena.addEventListener("pointermove", function (event) {
      if (!catchOpen || !catchState) return;
      var rect = arena.getBoundingClientRect();
      if (rect.width <= 1) return;
      var x = (event.clientX - rect.left) / rect.width;
      catchState = core.catchMove(catchState, x);
      renderCatchPanel();
    });
    panel.focus();
    return panel;
  }
  function renderCatchPanel() {
    var panel = catchPanel();
    if (!panel || !catchState) return;
    var score = panel.querySelector("[data-dsh-whale-catch-score]");
    var time = panel.querySelector("[data-dsh-whale-catch-time]");
    var combo = panel.querySelector("[data-dsh-whale-catch-combo]");
    var best = panel.querySelector("[data-dsh-whale-catch-best]");
    var arena = panel.querySelector("[data-dsh-whale-catch-arena]");
    var basket = panel.querySelector("[data-dsh-whale-catch-basket]");
    if (score) score.textContent = "得分 " + catchState.score;
    if (time) time.textContent = Math.ceil(catchState.remainingMs / 1000) + "s";
    if (combo) combo.textContent = catchState.combo > 1 ? "连击 x" + catchState.combo : "";
    if (best) best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    if (basket) basket.style.left = (catchState.basketX * 100) + "%";
    var existing = arena.querySelectorAll("[data-dsh-whale-catch-item]");
    for (var i = 0; i < existing.length; i += 1) existing[i].remove();
    for (var j = 0; j < catchState.items.length; j += 1) {
      var item = catchState.items[j];
      var span = doc.createElement("span");
      span.setAttribute("data-dsh-whale-catch-item", "true");
      span.className = "dsh-whale-catch-" + item.kind;
      span.textContent = item.kind === "star" ? "⭐" : (item.kind === "bomb" ? "💣" : "🍰");
      span.style.left = (item.x * 100) + "%";
      span.style.top = (item.y * 100) + "%";
      arena.appendChild(span);
    }
  }
  function catchPaused() {
    return !catchOpen || doc.hidden;
  }
  function catchTickLoop() {
    if (!catchOpen || !catchState) return;
    var pausedBadge = doc.querySelector("[data-dsh-whale-catch-paused]");
    if (catchPaused()) {
      if (pausedBadge) pausedBadge.hidden = false;
      return;
    }
    if (pausedBadge) pausedBadge.hidden = true;
    var out = core.catchTick(catchState, Date.now(), Math.random);
    catchState = out.state;
    for (var i = 0; i < out.events.length; i += 1) {
      if (out.events[i].kind === "caught" && out.events[i].item === "bomb") showMood("game-cheat", 2200, true);
    }
    renderCatchPanel();
    if (catchState.status === "ended") endCatchGame(core.catchResult(catchState));
  }
  function onCatchKeydown(event) {
    if (!catchOpen) return;
    var key = event.key;
    if (key === "Escape") { event.preventDefault(); closeCatchGame(); return; }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      var step = key === "ArrowLeft" ? -0.07 : 0.07;
      catchState = core.catchMove(catchState, catchState.basketX + step);
      renderCatchPanel();
    }
  }
  function openCatchGame() {
    if (!readPref("game")) return;
    if (catchOpen) return;
    if (detectView() === "settings") return;
    if (gameOpen) closeGame();
    loadGameStats();
    catchState = core.catchNewState(Date.now(), Math.random);
    catchOpen = true;
    ensureCatchPanel();
    showMood("game-think", 5000, true);
    catchTimer = root.setInterval(catchTickLoop, 100);
    schedule();
  }
  function endCatchGame(result) {
    if (!catchOpen) return;
    catchOpen = false;
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    settleGame(catchPanel(), result, function () { openCatchGame(); }, function () { closeCatchGame(); }, "接到 " + result.caught + " 个");
  }

  /* ---------- state plumbing ---------- */

  var growth = null;
  var dialogueCounters = { daily: {}, work: {}, interact: {}, keyword: {}, bond: {}, context: {}, meme: {} };
  var keywordScanTimer = null;
  var lastChatCount = 0;
  var lastCodeCount = 0;

  function loadGrowth() {
    try {
      var since = root.localStorage.getItem("whale-moe:companionSince");
      if (since === null) {
        since = String(Date.now());
        try { root.localStorage.setItem("whale-moe:companionSince", since); } catch (e) { /* ignore */ }
      }
      growth = {
        mood: Number(root.localStorage.getItem("whale-moe:mood")) || core.DEFAULT_GROWTH.mood,
        affinity: Number(root.localStorage.getItem("whale-moe:affinity")) || 0,
        satiety: Number(root.localStorage.getItem("whale-moe:satiety")) || core.DEFAULT_GROWTH.satiety,
        lastSignin: root.localStorage.getItem("whale-moe:lastSignin") || "",
        signinStreak: Number(root.localStorage.getItem("whale-moe:signinStreak")) || 0,
        achievements: (root.localStorage.getItem("whale-moe:achievements") || "").split(",").filter(Boolean),
        level: Number(root.localStorage.getItem("whale-moe:level")) || 1,
        companionSince: Number(since) || Date.now()
      };
    } catch (e) { growth = Object.assign({}, core.DEFAULT_GROWTH, { companionSince: Date.now() }); }
  }
  function saveGrowth() {
    try {
      root.localStorage.setItem("whale-moe:mood", String(Math.round(growth.mood)));
      root.localStorage.setItem("whale-moe:affinity", String(Math.round(growth.affinity)));
      root.localStorage.setItem("whale-moe:satiety", String(Math.round(growth.satiety)));
      root.localStorage.setItem("whale-moe:lastSignin", growth.lastSignin);
      root.localStorage.setItem("whale-moe:signinStreak", String(growth.signinStreak));
      root.localStorage.setItem("whale-moe:achievements", growth.achievements.join(","));
      root.localStorage.setItem("whale-moe:level", String(growth.level));
      if (growth.companionSince) root.localStorage.setItem("whale-moe:companionSince", String(growth.companionSince));
    } catch (e) { /* storage unavailable */ }
  }
  function syncCompanionAchievements(now) {
    if (!growth || !growth.companionSince) return;
    var days = Math.max(0, Math.floor((now - growth.companionSince) / 86400000));
    var tiers = [{ id: "day1", days: 1 }, { id: "day7", days: 7 }, { id: "day30", days: 30 }];
    var unlocks = tiers.filter(function (tier) { return days >= tier.days && growth.achievements.indexOf(tier.id) === -1; }).map(function (tier) { return tier.id; });
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      announceUnlocks(unlocks);
    }
  }

  var usageStats = null;
  var USAGE_TIERS = Object.freeze({
    "first-tool": { key: "tools", min: 1 },
    "tools-10": { key: "tools", min: 10 },
    "tools-50": { key: "tools", min: 50 },
    "tools-100": { key: "tools", min: 100 },
    "first-code": { key: "code", min: 1 },
    "code-20": { key: "code", min: 20 },
    "first-success": { key: "successes", min: 1 },
    "success-10": { key: "successes", min: 10 },
    "first-failure": { key: "failures", min: 1 },
    "fail-10": { key: "failures", min: 10 },
    "messages-100": { key: "messages", min: 100 },
    "messages-500": { key: "messages", min: 500 },
    "keyword-master": { key: "keywords", min: 10 }
  });
  function loadUsageStats() {
    try {
      usageStats = JSON.parse(root.localStorage.getItem("whale-moe:usageStats") || "null") || { tools: 0, code: 0, successes: 0, failures: 0, messages: 0, keywords: 0 };
    } catch (e) { usageStats = { tools: 0, code: 0, successes: 0, failures: 0, messages: 0, keywords: 0 }; }
  }
  function saveUsageStats() {
    try { root.localStorage.setItem("whale-moe:usageStats", JSON.stringify(usageStats)); } catch (e) { /* ignore */ }
  }
  function addUsageStat(key, amount) {
    if (!usageStats) loadUsageStats();
    usageStats[key] = (usageStats[key] || 0) + amount;
    saveUsageStats();
    var unlocks = [];
    for (var id in USAGE_TIERS) {
      var tier = USAGE_TIERS[id];
      if (usageStats[tier.key] >= tier.min && (!growth || growth.achievements.indexOf(id) === -1)) unlocks.push(id);
    }
    if (unlocks.length) {
      if (growth) growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      announceUnlocks(unlocks);
    }
  }
  function applyGrowth(event, now, pats) {
    var out = core.computeGrowth(growth, event, now, pats);
    growth = out.growth;
    saveGrowth();
    if (out.leveledUp) onBondLevelUp();
    return out;
  }
  function say(bank, event) {
    if (!readPref("chat")) return "";
    dialogueCounters[bank] = dialogueCounters[bank] || {};
    dialogueCounters[bank][event] = (dialogueCounters[bank][event] || 0) + 1;
    var line = core.pickDialogue(bank, event, dialogueCounters[bank][event], Math.random);
    if (growth && (bank === "interact" || bank === "work")) {
      var tier = core.moodTier(growth.mood);
      if (tier === "low" && Math.random() < 0.15) {
        line = core.pickDialogue("bond", "low-mood", dialogueCounters[bank][event], Math.random);
      } else if (tier === "high" && Math.random() < 0.15) {
        line = core.pickDialogue("bond", "high-mood", dialogueCounters[bank][event], Math.random);
      }
    }
    return line;
  }

  /* ---------- daily quests / weekly signin / bond ---------- */

  var quests = null;
  var weekSignin = null;

  function loadQuests() {
    try {
      var raw = root.localStorage.getItem("whale-moe:quests");
      quests = raw ? JSON.parse(raw) : null;
    } catch (e) { quests = null; }
    return quests;
  }
  function saveQuests() {
    try { root.localStorage.setItem("whale-moe:quests", JSON.stringify(quests)); } catch (e) { /* ignore */ }
  }
  function loadWeekSignin() {
    try {
      var raw = root.localStorage.getItem("whale-moe:weekSignin");
      weekSignin = raw ? JSON.parse(raw) : null;
    } catch (e) { weekSignin = null; }
    return weekSignin;
  }
  function saveWeekSignin() {
    try { root.localStorage.setItem("whale-moe:weekSignin", JSON.stringify(weekSignin)); } catch (e) { /* ignore */ }
  }
  function refreshQuestsIfNeeded(now) {
    if (!quests) loadQuests();
    var refreshed = core.refreshQuests(quests, now, Math.random);
    if (refreshed !== quests) { quests = refreshed; saveQuests(); }
  }
  function applyQuestSignal(metric, amount) {
    if (!quests) loadQuests();
    var out = core.computeQuests(quests, { metric: metric, amount: amount }, Date.now());
    quests = out.quests;
    saveQuests();
    return out;
  }
  function claimQuestById(id) {
    if (!quests) loadQuests();
    var out = core.claimQuest(quests, id, Date.now());
    quests = out.quests;
    saveQuests();
    if (!out.claimed) return false;
    applyGrowth({ type: "quest" }, Date.now(), 0);
    if (out.newlyAll) applyGrowth({ type: "questAll" }, Date.now(), 0);
    var unlocks = core.evaluateQuestAchievements(growth, quests, weekSignin);
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      announceUnlocks(unlocks);
    }
    burst("🎯");
    if (!BUSY_STATES[memory.state.state]) showMood("daily-done", 3200, true);
    if (!BUSY_STATES[memory.state.state] && readPref("chat") && bubbleFree()) {
      showChatLine(core.pickDialogue("daily", "signin", 0, Math.random));
    }
    root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "quests", value: 1 } }));
    return true;
  }
  function syncWeekSignin(now) {
    if (!weekSignin) loadWeekSignin();
    var out = core.computeWeekSignin(weekSignin, dayKeyOf(now), now);
    weekSignin = out.weekSignin;
    saveWeekSignin();
    if (out.milestoneHit === "7") {
      applyGrowth({ type: "weekly" }, now, 0);
      var unlocks = core.evaluateQuestAchievements(growth, quests, weekSignin);
      if (unlocks.length) {
        growth.achievements = growth.achievements.concat(unlocks);
        saveGrowth();
        announceUnlocks(unlocks);
      }
    }
    return out.milestoneHit;
  }
  function applyBadge(id) {
    try { root.localStorage.setItem("whale-moe:badge", String(id || "")); } catch (e) { /* ignore */ }
    root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "badge", value: id || "" } }));
  }
  function maybeFestival(now) {
    var pose = core.festivalKey(now);
    if (!pose) return;
    var today = dayKeyOf(now);
    try {
      if (root.localStorage.getItem("whale-moe:festivalShown") === today) return;
      root.localStorage.setItem("whale-moe:festivalShown", today);
    } catch (e) { /* ignore */ }
    if (!BUSY_STATES[memory.state.state]) showMood(pose, 7000, true);
    if (readPref("chat")) {
      var line = core.pickDialogue("daily", "holiday", 0, Math.random);
      if (line) showChatLine(line);
    }
  }
  function onBondLevelUp() {
    if (!growth) return;
    var unlocks = core.bondUnlocks(growth.level);
    if (unlocks.action && IDLE_ACTION_POOL.indexOf("wink") === -1) IDLE_ACTION_POOL.push("wink");
    var line = "";
    if (growth.level >= 7 && unlocks.egg) line = say("bond", "l7");
    else if (growth.level >= 5 && unlocks.badge) line = say("bond", "l5");
    else if (unlocks.action) line = say("bond", "l3");
    if (line && !BUSY_STATES[memory.state.state] && readPref("chat")) showLine(localizeLine(line));
    if (!BUSY_STATES[memory.state.state]) showMood("levelup", 4200, true);
  }
  function keywordsEnabled() {
    try { return root.localStorage.getItem("whale-moe:keywords") === "1"; } catch (e) { return false; }
  }
  function title() {
    try { var t = root.localStorage.getItem("whale-moe:title"); return t && t.trim() ? t.trim() : "主人"; } catch (e) { return "主人"; }
  }
  function localizeLine(line) {
    return String(line).split("主人").join(title());
  }
  function isNight(now) {
    var h = new Date(now || Date.now()).getHours();
    var nightOn = true;
    try { nightOn = root.localStorage.getItem("whale-moe:night") !== "0"; } catch (e) { /* default on */ }
    return nightOn && (h >= 22 || h < 6);
  }

  var STATE_HOLD_MS = Object.freeze({ success: 3000, failure: 3500, curious: 2500, tool: 1200, thinking: 1200 });
  /* Minimum "flinch" duration for a fresh error so the mascot reacts visibly
     even if the conversation resumes immediately; after that it keeps or drops
     the error pose based on whether the conversation moved on. */
  var ERROR_MIN_MS = 3000;
  /* After a fresh page load, DSH mounts conversation history asynchronously,
     so error nodes can surface AFTER the whale's first baseline pass. Treat
     every error node seen within this window as historical, so a reload never
     starts in the error pose. */
  var SETTLE_MS = 10000;
  var STATE_CHIP = Object.freeze({ thinking: "思考中", tool: "工作中", success: "完成", failure: "出错", curious: "好奇" });
  var BUSY_STATES = Object.freeze({ thinking: 1, tool: 1, success: 1, failure: 1 });

  function holdSignals(signals, now) {
    if (!signals.error && !signals.tool && !signals.thinking && now < memory.stateHoldUntil) {
      if (memory.lastEventState === "failure") signals.error = true;
      else if (memory.lastEventState === "success") signals.successAt = now;
      else if (memory.lastEventState === "curious") signals.curiousAt = now;
    }
    return signals;
  }

  function blinkOnce() {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced() || memory.state.state !== "idle") return;
    var layer = rootNode.querySelector("[data-dsh-whale-layer].dsh-whale-active");
    if (!layer) return;
    layer.style.transition = "opacity 120ms ease";
    layer.style.opacity = "0.94";
    root.setTimeout(function () { layer.style.opacity = ""; }, 140);
    root.setTimeout(function () { layer.style.transition = ""; }, 400);
  }
  root.DshWhaleMoeBlink = blinkOnce;
  root.DshWhaleMoeMood = showMood;

  function showChip(label, persist) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced()) return;
    var old = rootNode.querySelector("[data-dsh-whale-chip]");
    if (old) old.remove();
    var chip = doc.createElement("span");
    chip.setAttribute("data-dsh-whale-chip", "true");
    chip.textContent = label;
    rootNode.appendChild(chip);
    if (!persist) root.setTimeout(function () { chip.remove(); }, 2200);
  }

  var memory = {
    view: "home",
    viewChangedAt: -Infinity,
    lastInteractionAt: Date.now(),
    toolWasActive: false,
    toolSeenAt: 0,
    toolGoneAt: 0,
    toolRawSeen: false,
    thinkingSeenAt: 0,
    thinkingGoneAt: 0,
    thinkingRawSeen: false,
    lastSuccessAt: -Infinity,
    state: { state: "idle", lastSpeechAt: -Infinity },
    idleTick: 0,
    idlePoseIndex: 0,
    idlePoseFor: 9000,
    lastIdlePoseAt: 0,
    nextIdleMicroAt: 0,
    nextIdleActionAt: 0,
    failureStreak: 0,
    lastGrowthTick: 0,
    stateHoldUntil: 0,
    lastEventState: "",
    moodPose: "",
    moodUntil: 0,
    moodAnimate: false,
    celebrationVisible: false,
    currentTypingLine: "",
    pendingLine: "",
    bubbleOutTimer: null,
    lastPoseSrc: "",
    lastLine: "",
    bubbleHideAt: 0,
    errorBaseline: null,
    errorSeenAt: 0,
    bootedAt: 0,
    failed: false
  };

  function errorVisible() {
    memory.lastErrorMatches = [];
    var baseline = memory.errorBaseline;
    var firstPass = baseline === null;
    if (firstPass) baseline = memory.errorBaseline = [];
    var now = Date.now();
    if (!memory.bootedAt) memory.bootedAt = now;
    var settling = (now - memory.bootedAt) < SETTLE_MS;
    var live = [];
    for (var i = 0; i < SIGNAL_BANKS.error.length; i += 1) {
      var nodes = doc.querySelectorAll(SIGNAL_BANKS.error[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var n = nodes[j];
        /* Historical DSH log clusters carry data-state="error" for a failed
           step that already finished; they are records, not live failures. */
        if (typeof n.closest === "function" && n.closest('[class*="dshLogCluster"]')) continue;
        /* First pass + loading settle window: seed every error node seen during
           the initial load as history, so a reload never opens in the error
           pose (DSH mounts conversation history after the first reconcile). */
        if (firstPass || settling) { if (baseline.indexOf(n) === -1) baseline.push(n); continue; }
        if (baseline.indexOf(n) !== -1) continue;
        if (!isVisible(n)) continue;
        var meaningful = n.getAttribute("role") === "alert"
          || n.getAttribute("aria-invalid") === "true"
          || (n.textContent || "").trim().length > 0;
        if (!meaningful) continue;
        memory.lastErrorMatches.push({
          sel: SIGNAL_BANKS.error[i],
          tag: n.tagName,
          cls: String(n.className).slice(0, 120),
          txt: (n.textContent || "").trim().slice(0, 80),
          role: n.getAttribute("role"),
          ariaInvalid: n.getAttribute("aria-invalid")
        });
        live.push(n);
      }
    }

    if (live.length === 0) { memory.errorSeenAt = 0; return false; }
    if (!memory.errorSeenAt) memory.errorSeenAt = now;

    /* Moved on = the conversation advanced past the error: a new thinking or
       tool burst started after the error, or a success completed after it.
       Only genuine NEW starts count, never the lingering busy debounce of the
       erroring tool itself, so a stall after the error keeps the error pose. */
    var movedOn = (memory.thinkingSeenAt > memory.errorSeenAt)
      || (memory.toolSeenAt > memory.errorSeenAt)
      || (memory.lastSuccessAt > memory.errorSeenAt);

    /* Inside the minimum window, flinch even if work resumed instantly. */
    if (now - memory.errorSeenAt < ERROR_MIN_MS) return true;

    /* Past the minimum window: on moved-on, re-baseline the error as history. */
    if (movedOn) {
      for (var m = 0; m < live.length; m += 1) baseline.push(live[m]);
      memory.errorSeenAt = 0;
      return false;
    }
    return true;
  }

  function toolVisible() {
    for (var i = 0; i < SIGNAL_BANKS.tool.length; i += 1) {
      var nodes = doc.querySelectorAll(SIGNAL_BANKS.tool[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var n = nodes[j];
        /* 历史步骤卡片会永久带着 data-state="running"；会话消息流内的
           视为历史，消息流之外的运行标记才代表当前正在工作。 */
        if (SIGNAL_BANKS.tool[i] === '[data-state="running"]') {
          if (typeof n.closest === "function" && n.closest('[data-slot="conversation.chat.node"]')) continue;
        }
        if (isVisible(n)) return true;
      }
    }
    return false;
  }

  function collectSignals() {
    var now = Date.now();
    var view = detectView();
    var rawTool = toolVisible();
    var rawThinking = anyVisible(SIGNAL_BANKS.thinking);
    /* 消抖：信号必须连续存在 300ms 才算数；消失后按场景保持——
       主页 4s、工作台 8s。工作台的工具面板在任务间会短暂空白，
       拉长保持时间让工作姿势在整段工作期间钉住，不再反复切换。 */
    var goneHold = view === "workbench" ? 8000 : 4000;
    var wasRawTool = memory.toolRawSeen;
    if (rawTool) {
      if (!memory.toolSeenAt) memory.toolSeenAt = now;
      memory.toolRawSeen = true;
    } else {
      memory.toolSeenAt = 0;
      /* 只在下沿记录“开始消失的时刻”，中间回来又消失则重新起算 */
      if (wasRawTool || !memory.toolGoneAt) memory.toolGoneAt = now;
      memory.toolRawSeen = false;
    }
    var wasRawThinking = memory.thinkingRawSeen;
    if (rawThinking) {
      if (!memory.thinkingSeenAt) memory.thinkingSeenAt = now;
      memory.thinkingRawSeen = true;
    } else {
      memory.thinkingSeenAt = 0;
      if (wasRawThinking || !memory.thinkingGoneAt) memory.thinkingGoneAt = now;
      memory.thinkingRawSeen = false;
    }
    /* 关键：信号短暂消失又回来时，seenAt 会归零重算。不能因此把
       active 直接打回 false —— 只要没离开满 goneHold，就一直钉在工作态。 */
    var toolActive = rawTool
      ? (now - memory.toolSeenAt >= 300 || (memory.toolGoneAt !== 0 && now - memory.toolGoneAt < goneHold))
      : memory.toolGoneAt !== 0 && now - memory.toolGoneAt < goneHold;
    var thinkingActive = rawThinking
      ? (now - memory.thinkingSeenAt >= 300 || (memory.thinkingGoneAt !== 0 && now - memory.thinkingGoneAt < goneHold))
      : memory.thinkingGoneAt !== 0 && now - memory.thinkingGoneAt < goneHold;
    var errorActive = errorVisible();
    memory.lastErrorActive = errorActive;
    if (view === "workbench" && memory.toolWasActive && !toolActive && !errorActive) memory.lastSuccessAt = now;
    memory.toolWasActive = toolActive;
    var dense = countVisible(SIGNAL_BANKS.code) >= 3;
    /* Workbench uses exactly two moods: busy (tool/thinking/success/failure)
       vs calm (idle rotation). The old "waiting" sweat pose no longer fires. */
    return {
      view: view,
      waiting: false,
      thinking: thinkingActive,
      tool: toolActive,
      successAt: anyVisible(SIGNAL_BANKS.success) ? now : memory.lastSuccessAt,
      error: errorActive,
      curiousAt: memory.viewChangedAt,
      lastInteraction: memory.lastInteractionAt,
      denseCode: dense
    };
  }

  function render(computed) {
    if (!readPref("pet") || !computed || computed.state === "hidden") {
      removeRoot();
      if (doc.body) doc.body.removeAttribute(VIEW_ATTR);
      root.__dshWhaleMoeDebug = { state: "hidden", pose: null, line: "", view: memory.view };
      return;
    }
    var rootNode = ensureRoot();
    var frame = rootNode.querySelector("[data-dsh-whale-frame]");
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var bubbleText = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    var view = memory.view;

    /* layout routing */
    var layout = resolveLayout(view, computed);
    var moodActive = memory.moodUntil > Date.now() && !!memory.moodPose;
    /* 工作态优先级最高：只要在忙，情绪姿势一律让位给 running，
       只有点击互动专用的 work-pat/work-ram 可以短暂覆盖。 */
    var moodAllowed = BUSY_STATES[computed.state] !== 1 || memory.moodPose === "work-pat" || memory.moodPose === "work-ram";
    if (!layout || layout.hidden) {
      rootNode.style.display = "none";
    } else {
      if (moodActive && moodAllowed) {
        layout.src = ASSET_ROOT + "dsh-whale-state-" + memory.moodPose + ".webp";
      }
      if (layout.anchor) placeAnchored(rootNode, layout);
      else placeAt(rootNode, layout.x, layout.y, layout.w, layout.h);
      rootNode.style.width = layout.w + "px";
      rootNode.style.height = layout.h + "px";
      frame.style.width = layout.w + "px";
      frame.style.height = layout.h + "px";
      frame.style.cursor = layout.kind === "float" ? "grab" : "pointer";
      rootNode.setAttribute("data-dsh-whale-mode", layout.kind);
      if (layout.kind === "mini") rootNode.setAttribute("data-dsh-whale-dense", "true");
      else rootNode.removeAttribute("data-dsh-whale-dense");
      /* 忙闲视觉：工作中持续亮状态签 + 光晕，空闲立即撤掉 */
      if (BUSY_STATES[computed.state] === 1) {
        rootNode.setAttribute("data-dsh-whale-busy", "true");
        var chipNow = rootNode.querySelector("[data-dsh-whale-chip]");
        if (!chipNow || chipNow.textContent !== STATE_CHIP[computed.state]) showChip(STATE_CHIP[computed.state], true);
      } else {
        rootNode.removeAttribute("data-dsh-whale-busy");
        var idleChip = rootNode.querySelector("[data-dsh-whale-chip]");
        if (idleChip) idleChip.remove();
      }
    }
    if (!layout.hidden) setPose(layout.src, true, moodActive ? memory.moodAnimate : true);

    /* celebration override: 3 quick pats — type once, then keep the finished
       bubble stable so repeated renders/reconciles can never re-jump it */
    if (Date.now() < celebrateUntil && view !== "settings" && readPref("chat")) {
      var celebLine = localizeLine("诶嘿～最喜欢主人啦！");
      if (!memory.celebrationVisible) {
        memory.celebrationVisible = true;
        memory.lastLine = celebLine;
        typeBubble(bubbleText, celebLine);
        bubble.hidden = false;
        memory.bubbleHideAt = Date.now() + 4500;
        bubble.classList.remove("dsh-whale-pop");
        void bubble.offsetWidth;
        bubble.classList.add("dsh-whale-pop");
      }
      return;
    }
    if (memory.celebrationVisible) memory.celebrationVisible = false;

    /* speech: only meaningful workbench events speak */
    var eventStates = { failure: 1, success: 1, tool: 1, thinking: 1, curious: 1 };
    if (computed.speak && readPref("chat") && view === "workbench" && eventStates[computed.state] && !typingTimer) {
      typeBubble(bubbleText, computed.line);
      bubble.hidden = false;
      memory.bubbleHideAt = Date.now() + 4500;
      if (!motionReduced() && computed.line !== memory.lastLine) {
        bubble.classList.remove("dsh-whale-pop");
        void bubble.offsetWidth;
        bubble.classList.add("dsh-whale-pop");
      }
    } else {
      /* keep the current manual line until its expiry; never force-hide here,
         otherwise showLine() lines flicker for a single frame */
    }
    if (!bubble.hidden && Date.now() > memory.bubbleHideAt && !typingTimer && !nextTimer) {
      if (!memory.bubbleOutTimer) {
        bubble.classList.add("dsh-whale-out");
        memory.bubbleOutTimer = root.setTimeout(function () {
          memory.bubbleOutTimer = null;
          bubble.hidden = true;
          bubble.classList.remove("dsh-whale-out");
        }, 200);
      }
    }

    /* error shake + success sparkle + ADV attention burst + growth/dialogue, only on state change */
    if (computed.state !== memory.state.state) {
      if (STATE_HOLD_MS[computed.state]) {
        memory.lastEventState = computed.state;
        memory.stateHoldUntil = Date.now() + STATE_HOLD_MS[computed.state];
      }
      if (STATE_CHIP[computed.state]) showChip(STATE_CHIP[computed.state], BUSY_STATES[computed.state] === 1);
      if (computed.state === "failure") {
        memory.failureStreak += 1;
        addUsageStat("failures", 1);
        applyQuestSignal("failure", 1);
        applyGrowth({ type: "failure" }, Date.now(), 0);
        burst("！");
        if (view === "workbench") {
          var fLine = say("work", memory.failureStreak >= 3 ? "gentle" : "failure");
          if (fLine) showLine(fLine);
        }
        if (!motionReduced()) {
          rootNode.classList.remove("dsh-whale-shake");
          void rootNode.offsetWidth;
          rootNode.classList.add("dsh-whale-shake");
          rootNode.addEventListener("animationend", function handler() { rootNode.classList.remove("dsh-whale-shake"); rootNode.removeEventListener("animationend", handler); });
        }
      }
      if (computed.state === "success") {
        memory.failureStreak = 0;
        addUsageStat("successes", 1);
        applyQuestSignal("success", 1);
        applyGrowth({ type: "success" }, Date.now(), 0);
        burst("★");
        spawnParticles(12, Date.now());
        if (view === "workbench") {
          var sLine = say("work", "success");
          if (sLine) showLine(sLine);
        }
      }
      if (computed.state === "tool" || computed.state === "thinking") {
        addUsageStat("tools", 1);
        applyQuestSignal("tool", 1);
        if (isNight(Date.now()) && growth && growth.achievements.indexOf("night-work") === -1) {
          growth.achievements.push("night-work");
          saveGrowth();
          announceUnlocks(["night-work"]);
        }
        burst("…");
        if (view === "workbench") {
          var tLine = say("work", computed.state === "tool" ? "tool" : "thinking");
          if (tLine) showLine(tLine);
        }
      }
    }

    memory.state = computed;
    memory.lastLine = computed.line;
    root.__dshWhaleMoeDebug = { state: computed.state, pose: computed.pose, line: computed.line, view: view, mode: readMode(), layout: layout.kind, failed: memory.failed, errorMatches: memory.lastErrorMatches, errorActive: memory.lastErrorActive, lastEventState: memory.lastEventState, stateHoldUntil: memory.stateHoldUntil, holdLeft: Math.max(0, memory.stateHoldUntil - Date.now()), moodPose: memory.moodPose, moodUntil: memory.moodUntil, moodAnimate: memory.moodAnimate, layers: { active: layerState.active, loaded: layerState.loaded, gen: layerState.gen, pendingSwap: layerState.pendingSwap, pendingSince: layerState.pendingSince }, toolWasActive: memory.toolWasActive, lastSuccessAt: memory.lastSuccessAt, toolGoneAt: memory.toolGoneAt, toolSeenAt: memory.toolSeenAt, at: Date.now(), idleChat: { nextAt: idleChat.nextAt, lastGreetAt: idleChat.lastGreetAt, lastGreetBucket: idleChat.lastGreetBucket }, weather: weatherSummary() };
  }

  /* 待机 base 稳定为 idle-cute；情绪动作只由随机低频的 showMood 覆盖。
     拖拽中显示“被拎起来”并交给 CSS 左右摇摆。 */
  function statePose(computed, view) {
    if (dragState && dragState.moved) return "pick-up";
    /* 忙时情绪让位：running 优先，仅点击互动专用的两个姿势可覆盖 */
    var busy = BUSY_STATES[computed.state] === 1;
    var moodOk = !busy || memory.moodPose === "work-pat" || memory.moodPose === "work-ram";
    if (memory.moodUntil > Date.now() && memory.moodPose && moodOk) return memory.moodPose;
    if (computed.state === "idle") return "idle-cute";
    return computed.pose;
  }

  function peekSize(id, fallbackW, fallbackH) {
    var cal = root.__dshWhalePeekCalibration || {};
    var c = cal[id];
    if (!c || !c.bboxW || !c.bboxH || !c.w) return { w: fallbackW, h: fallbackH };
    var w = Math.round(fallbackH * (c.bboxW / c.bboxH));
    if (w < 24) w = 24;
    return { w: w, h: fallbackH, padLeftRatio: c.padLeft / c.w };
  }

  function resolveLayout(view, computed) {
    var vw = root.innerWidth;
    var vh = root.innerHeight;
    if (view === "settings") return { hidden: true, src: "", kind: "peek", w: 0, h: 0 };
    var mode = readMode();
    var effective = mode === "auto" ? (view === "home" ? "bar" : "side") : mode;
    var dense = computed.mode === "mini";

    if (effective === "bar") {
      var composer = findComposerSurface();
      if (!composer || !isVisible(composer)) return { hidden: true, src: "", kind: "bar", w: 0, h: 0 };
      var crect = composer.getBoundingClientRect();
      var barSize = peekSize("home-peek", 128, 104);
      return {
        hidden: false, kind: "bar", anchor: composer,
        w: barSize.w, h: barSize.h,
        src: ASSET_ROOT + "dsh-whale-home-peek.webp",
        left: crect.right - barSize.w - 6,
        top: crect.top - barSize.h + 16
      };
    }

    if (effective === "side") {
      var sidebar = firstVisible('[data-slot="sidebar"] > *') || firstVisible('[data-slot="sidebar"]') || firstVisible('[data-slot="sidebar.workspaces"]');
      if (!sidebar || !isVisible(sidebar)) return { hidden: true, src: "", kind: "side", w: 0, h: 0 };
      var srect = sidebar.getBoundingClientRect();
      /* 忙闲两态：工作区有任务在跑 → 完整“工作中”立绘；空闲 → 探头 */
      var busy = BUSY_STATES[computed.state] === 1;
      if (view === "workbench" && busy) {
        return {
          hidden: false, kind: "side", anchor: sidebar,
          w: 112, h: 112, padLeftRatio: 0.5,
          src: ASSET_ROOT + "dsh-whale-state-" + statePose(computed, view) + ".webp",
          left: srect.right - 56 - 8,
          top: srect.bottom - 112 - 96
        };
      }
      var sideSize = peekSize("workbench-peek", 148, 112);
      return {
        hidden: false, kind: "side", anchor: sidebar,
        w: sideSize.w, h: sideSize.h,
        src: ASSET_ROOT + "dsh-whale-workbench-peek.webp",
        left: srect.right - Math.round(sideSize.w * (sideSize.padLeftRatio || 0.5)) - 8,
        top: srect.bottom - sideSize.h - 96
      };
    }

    if (effective === "float") {
      var saved = readFloatPos();
      var fw = 200;
      var fh = 200;
      /* during an active drag, keep the live pointer position; never snap back */
      var fx = saved ? saved.x : vw - fw - 20;
      var fy = saved ? saved.y : vh - fh - 20;
      if (dragState && dragState.node) {
        fx = parseFloat(dragState.node.style.left) || fx;
        fy = parseFloat(dragState.node.style.top) || fy;
      }
      return {
        hidden: false, kind: "float", w: fw, h: fh,
        src: ASSET_ROOT + "dsh-whale-state-" + statePose(computed, view) + ".webp",
        x: clamp(fx, 8, vw - fw - 8),
        y: clamp(fy, 8, vh - fh - 8)
      };
    }

    /* mini corner */
    var mw = 64;
    var mh = 64;
    return {
      hidden: false, kind: "mini", w: mw, h: mh,
      src: ASSET_ROOT + "dsh-whale-state-" + statePose(computed, view) + ".webp",
      x: vw - mw - 14,
      y: vh - mh - 14
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function placeAnchored(rootNode, layout) {
    var rect = layout.anchor.getBoundingClientRect();
    var left = layout.left !== undefined ? layout.left : rect.right - layout.w - 10;
    var top = layout.top !== undefined ? layout.top : rect.top;
    left = clamp(left, 8, root.innerWidth - layout.w - 8);
    top = clamp(top, 8, root.innerHeight - layout.h - 8);
    rootNode.style.display = "block";
    rootNode.style.left = Math.round(left) + "px";
    rootNode.style.top = Math.round(top) + "px";
  }

  function placeAt(rootNode, x, y, width, height) {
    rootNode.style.display = "block";
    rootNode.style.left = Math.round(clamp(x, 8, root.innerWidth - width - 8)) + "px";
    rootNode.style.top = Math.round(clamp(y, 8, root.innerHeight - height - 8)) + "px";
  }

  /* ---------- reconcile / lifecycle ---------- */

  function safeReconcile() {
    try {
      reconcile();
    } catch (error) {
      if (!memory.failed) {
        memory.failed = true;
        if (root.console && root.console.warn) root.console.warn("[dsh-whale-moe] presenter disabled after error:", error);
      }
      root.__dshWhaleMoeDebug = { state: "hidden", pose: null, line: "", view: memory.view, failed: true, error: String(error) };
      if (observer) observer.disconnect();
      removeRoot();
      if (doc.body) doc.body.removeAttribute(VIEW_ATTR);
    }
  }

  function reconcile() {
    if (!doc.body) return;
    var view = detectView();
    var now = Date.now();
    if (!growth) loadGrowth();
    syncCompanionAchievements(now);
    refreshQuestsIfNeeded(now);
    if (!memory.lastGrowthTick) { memory.lastGrowthTick = now; applyGrowth({ type: "signin" }, now, 0); applyQuestSignal("signin", 1); syncWeekSignin(now); maybeFestival(now); }
    else if (now - memory.lastGrowthTick >= 60000) {
      var deltaMin = (now - memory.lastGrowthTick) / 60000;
      memory.lastGrowthTick = now;
      applyGrowth({ type: "tick", deltaMin: deltaMin }, now, 0);
    }
    if (isNight(now)) doc.body.setAttribute("data-dsh-whale-night", "true");
    else doc.body.removeAttribute("data-dsh-whale-night");
    var codeNow = countVisible(SIGNAL_BANKS.code);
    if (codeNow > lastCodeCount) { addUsageStat("code", codeNow - lastCodeCount); applyQuestSignal("code", codeNow - lastCodeCount); }
    lastCodeCount = codeNow;
    var chatNow = countVisible(SIGNAL_BANKS.chat);
    if (chatNow > lastChatCount) {
      addUsageStat("messages", chatNow - lastChatCount);
      applyQuestSignal("messages", chatNow - lastChatCount);
      if (keywordsEnabled()) scheduleKeywordScan();
    }
    lastChatCount = chatNow;
    if (view !== memory.view) {
      memory.view = view;
      memory.viewChangedAt = now;
    }
    var signals = holdSignals(collectSignals(), now);
    var computed = core.computeState(memory.state, signals, now, Math.random);
    render(computed);
    weatherFxReconcile(computed);
    if (readPref("pet")) idleChatTick(now);
    if (readPref("pet")) {
      if (doc.body) doc.body.setAttribute(VIEW_ATTR, view);
      doc.documentElement.setAttribute(VIEW_ATTR, view);
    }
  }

  var KEYWORD_POSES = Object.freeze({
    kyun: "meme-kyun", omg: "meme-omg", doge: "meme-doge", sike: "meme-sike",
    worship: "meme-worship", peace: "meme-peace", doubt: "meme-doubt",
    wakuwaku: "meme-wakuwaku", smilepain: "meme-smile-pain", ojisan: "meme-ojisan",
    deploy: "work-deploy", meeting: "work-meeting", review: "work-review",
    bugtalk: "work-debug", ddl: "work-deadline", cake: "work-boss",
    slack: "work-slack-phone", crazy: "abstract", cheer: "bold", flag: "bold",
    tired: "work-sleep"
  });

  function scheduleKeywordScan() {
    root.__dshWhaleMoeKeywordScans = (root.__dshWhaleMoeKeywordScans || 0) + 1;
    if (keywordScanTimer) root.clearTimeout(keywordScanTimer);
    keywordScanTimer = root.setTimeout(function () {
      keywordScanTimer = null;
      root.__dshWhaleMoeKeywordRuns = (root.__dshWhaleMoeKeywordRuns || 0) + 1;
      var nodes = doc.querySelectorAll('[data-slot="conversation.chat.node"]');
      for (var i = nodes.length - 1; i >= 0; i -= 1) {
        var text = (nodes[i].textContent || "").slice(0, 2000);
        if (!text) continue;
        var id = core.matchKeyword(text, keywordsEnabled());
        root.__dshWhaleMoeKeywordMatched = id;
        if (!id) continue;
        var line = say("keyword", id);
        root.__dshWhaleMoeKeywordLine = line;
        if (KEYWORD_POSES[id]) showMood(KEYWORD_POSES[id], 3000, true);
        if (line) {
          addUsageStat("keywords", 1);
          applyQuestSignal("keyword", 1);
          showLine(line);
        }
        if (id === "thanks") {
          var out = applyGrowth({ type: "thanks" }, Date.now(), 0);
          if (out.unlocks.length) burst("🏅");
        }
        break;
      }
    }, 500);
  }

  var observer = null;
  var scheduled = false;
  function schedule() {
    root.__dshWhaleMoeScheduleCalls = (root.__dshWhaleMoeScheduleCalls || 0) + 1;
    root.__dshWhaleMoeScheduleSkipped = (root.__dshWhaleMoeScheduleSkipped || 0) + (scheduled || memory.failed ? 1 : 0);
    if (scheduled || memory.failed) return;
    scheduled = true;
    root.setTimeout(function () {
      scheduled = false;
      safeReconcile();
    }, DEBOUNCE_MS);
  }

  /* ---------- weather service (Open-Meteo, no key required) ---------- */
  var WEATHER_REFRESH_MIN = 30 * 60000;
  var WEATHER_REFRESH_MAX = 60 * 60000;
  var WEATHER_DATA_MS = 2 * 3600000;
  var recentLines = [];
  var weatherState = {
    city: readWeather("weatherCity"),
    key: readWeather("weatherKey"),
    coords: readCoords(),
    current: null,
    fetchedAt: 0,
    lastToldKind: "",
    nextRefreshAt: 0,
    retryAt: 0,
    status: ""
  };

  function readWeather(key) {
    try { return root.localStorage.getItem("whale-moe:" + key) || ""; } catch (e) { return ""; }
  }
  function readCoords() {
    try {
      var lat = root.localStorage.getItem("whale-moe:weatherLat");
      var lon = root.localStorage.getItem("whale-moe:weatherLon");
      if (lat === null || lon === null) return null;
      return { lat: Number(lat), lon: Number(lon) };
    } catch (e) { return null; }
  }
  function writeCoords(coords) {
    try {
      if (coords) {
        root.localStorage.setItem("whale-moe:weatherLat", String(coords.lat));
        root.localStorage.setItem("whale-moe:weatherLon", String(coords.lon));
      } else {
        root.localStorage.removeItem("whale-moe:weatherLat");
        root.localStorage.removeItem("whale-moe:weatherLon");
      }
    } catch (e) { /* storage unavailable */ }
  }

  function weatherJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = root.setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("weather timeout"));
      }, timeoutMs || 7000);
      root.fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("weather http " + res.status);
        return res.json();
      }).then(function (json) {
        root.clearTimeout(timer);
        resolve(json);
      }).catch(function (error) {
        root.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function weatherKeyParam() {
    var key = readWeather("weatherKey").trim();
    return key ? "&apikey=" + encodeURIComponent(key) : "";
  }

  function geocodeCity(city) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=zh&format=json" + weatherKeyParam();
    return weatherJson(url, 8000).then(function (json) {
      if (!json || !json.results || !json.results.length) throw new Error("city not found");
      return { lat: Number(json.results[0].latitude), lon: Number(json.results[0].longitude), name: json.results[0].name || city };
    });
  }

  function fetchWeather(city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("no city"));
    var cached = weatherState.coords;
    var coordsP = cached ? Promise.resolve(cached) : geocodeCity(useCity);
    return coordsP.then(function (coords) {
      weatherState.coords = coords;
      writeCoords(coords);
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + coords.lat + "&longitude=" + coords.lon + "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto" + weatherKeyParam();
      return weatherJson(url, 8000).then(function (json) {
        if (!json || !json.current) throw new Error("no current weather");
        weatherState.current = {
          temp: Number(json.current.temperature_2m),
          code: String(json.current.weather_code),
          wind: Number(json.current.wind_speed_10m || 0),
          humidity: Number(json.current.relative_humidity_2m || 0)
        };
        weatherState.fetchedAt = Date.now();
        weatherState.retryAt = 0;
        weatherState.nextRefreshAt = weatherState.fetchedAt + WEATHER_REFRESH_MIN + Math.floor(Math.random() * (WEATHER_REFRESH_MAX - WEATHER_REFRESH_MIN));
        weatherState.status = "ok";
        schedule();
        return weatherState.current;
      });
    });
  }

  function weatherEnsure(force) {
    var now = Date.now();
    var city = readWeather("weatherCity").trim();
    if (!city) return Promise.resolve(null);
    if (weatherState.city !== city || weatherState.key !== readWeather("weatherKey")) {
      weatherState.city = city;
      weatherState.key = readWeather("weatherKey");
      weatherState.coords = null;
      writeCoords(null);
    }
    var fresh = weatherState.current && now - weatherState.fetchedAt < WEATHER_DATA_MS;
    if (force || (!fresh && now >= weatherState.nextRefreshAt && now >= weatherState.retryAt)) {
      return fetchWeather(city).catch(function () {
        weatherState.status = "error";
        weatherState.retryAt = now + 60 * 60000;
        return null;
      });
    }
    return Promise.resolve(weatherState.current);
  }

  function weatherSummary() {
    if (!weatherState.current) return null;
    var w = core.weatherText(weatherState.current.code);
    return { temp: weatherState.current.temp, emoji: w.emoji, label: w.label, kind: w.kind, wind: weatherState.current.wind };
  }

  function weatherLine(now, counter) {
    var summary = weatherSummary();
    if (!summary) return "";
    var line = core.pickDialogueAvoidRecent("weather", summary.kind, counter || 0, Math.random, recentLines);
    if (!line) return "";
    var tail = " · 现在 " + Math.round(summary.temp) + "°C " + summary.label;
    return line + tail;
  }

  function weatherChangedSinceTold() {
    var summary = weatherSummary();
    return summary && summary.kind !== weatherState.lastToldKind;
  }

  root.__dshWhaleMoeWeather = weatherState;
  root.DshWhaleMoeWeatherTest = function (city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("请先填写城市"));
    var beforeCoords = weatherState.coords;
    var beforeKey = weatherState.key;
    if (key !== undefined && key !== null) {
      try { root.localStorage.setItem("whale-moe:weatherKey", String(key)); } catch (e) {}
    }
    weatherState.coords = null;
    return fetchWeather(useCity, key || "").then(function () {
      var s = weatherSummary();
      return "✅ 已连通：" + useCity + " " + Math.round(s.temp) + "°C " + s.label;
    }).catch(function (error) {
      weatherState.coords = beforeCoords;
      weatherState.key = beforeKey;
      throw error;
    });
  };

  /* ---------- weather visual fx (gated canvas layer) ----------
     rAF 门控例外(相对文件头 "no ambient rAF" 约定):
     仅在 motion/flash kind 激活 && 特效开关开 && 城市已填 && 天气新鲜(<2h)
     && 非 forced-colors && 非 reduced-motion && 页面可见时运行;
     任一条件翻转即 weatherFxStop() 取消循环并摘除节点,不养常驻循环。 */

  var WEATHER_FX_PARTICLE_MAX = 160;
  var weatherFxState = {
    canvas: null, ctx: null, rafId: 0, kind: "", mode: "", intensity: 1,
    particles: [], lastFrame: 0, nextFlashAt: 0, flashUntil: 0,
    running: false, busy: false, staticOnly: false, dpr: 1, frameMs: 0
  };

  function forcedColorsActive() {
    try { return root.matchMedia("(forced-colors: active)").matches; } catch (e) { return false; }
  }
  function weatherFxCurrent() {
    if (!weatherState.current) return null;
    return core.weatherFx(weatherState.current.code, weatherState.current.temp, weatherState.current.wind);
  }
  function weatherFxGate(computed) {
    var enabled = readPref("weatherFx")
      && readWeather("weatherCity").trim().length > 0
      && weatherState.current
      && Date.now() - weatherState.fetchedAt < WEATHER_DATA_MS
      && !forcedColorsActive();
    var staticOnly = false;
    if (enabled && motionReduced()) { staticOnly = true; }
    var busy = !!(computed && BUSY_STATES[computed.state] === 1);
    return { enabled: enabled, busy: busy, staticOnly: staticOnly };
  }
  function ensureFxLayer() {
    var existing = doc.querySelector("[data-dsh-whale-weather-fx]");
    if (existing) {
      weatherFxState.canvas = existing;
      weatherFxState.ctx = existing.getContext("2d");
      return existing;
    }
    var canvas = doc.createElement("canvas");
    canvas.setAttribute("data-dsh-whale-weather-fx", "true");
    doc.body.appendChild(canvas);
    weatherFxState.canvas = canvas;
    weatherFxState.ctx = canvas.getContext("2d");
    return canvas;
  }
  function weatherFxSize() {
    var canvas = weatherFxState.canvas;
    if (!canvas || !weatherFxState.ctx) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 1.5);
    var w = root.innerWidth;
    var h = root.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    weatherFxState.dpr = dpr;
  }
  function weatherFxSeedParticles(spec) {
    var pool = [];
    var count = Math.min(WEATHER_FX_PARTICLE_MAX, spec.count | 0);
    for (var i = 0; i < count; i += 1) {
      pool.push({
        x: Math.random() * root.innerWidth,
        y: Math.random() * root.innerHeight,
        phase: Math.random() * Math.PI * 2,
        speed: spec.speed * (0.85 + Math.random() * 0.3),
        length: spec.length || 0,
        size: spec.size || 2,
        opacity: spec.opacity * (0.7 + Math.random() * 0.5)
      });
    }
    return pool;
  }
  function weatherFxDrawStatic(spec) {
    var ctx = weatherFxState.ctx;
    var w = weatherFxState.canvas.width;
    var h = weatherFxState.canvas.height;
    var dpr = weatherFxState.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
    var tint = spec.tint || "";
    if (tint === "dim") {
      ctx.fillStyle = "rgba(120,130,150," + (spec.opacity || 0.05) + ")";
      ctx.fillRect(0, 0, root.innerWidth, root.innerHeight);
    } else if (tint === "warm") {
      ctx.fillStyle = "rgba(255,190,110," + (spec.opacity || 0.05) + ")";
      ctx.fillRect(0, 0, root.innerWidth, root.innerHeight);
    } else if (tint === "frost") {
      var grad = ctx.createRadialGradient(root.innerWidth / 2, root.innerHeight / 2, Math.min(w, h) / 4, root.innerWidth / 2, root.innerHeight / 2, Math.max(w, h) / 2);
      grad.addColorStop(0, "rgba(200,220,255,0)");
      grad.addColorStop(1, "rgba(200,220,255," + (spec.opacity || 0.1) + ")");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, root.innerWidth, root.innerHeight);
    }
  }
  function weatherFxDrawMotion(spec, ts, dim) {
    var ctx = weatherFxState.ctx;
    var w = root.innerWidth;
    var h = root.innerHeight;
    var dpr = weatherFxState.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var kind = weatherFxState.kind;
    var busyDim = dim || 1;
    for (var i = 0; i < weatherFxState.particles.length; i += 1) {
      var p = weatherFxState.particles[i];
      var drift = spec.drift || 0;
      if (kind === "rain") {
        p.y += p.speed / 60;
        p.x += (spec.windDrift || 0) * 0.4 + Math.sin(p.phase) * 2;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        ctx.strokeStyle = "rgba(180,200,230," + (p.opacity * busyDim) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y - (p.length || 14));
        ctx.stroke();
      } else if (kind === "snow") {
        p.y += p.speed / 60;
        p.x += Math.sin(p.phase + ts / 800) * drift / 30;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.fillStyle = "rgba(255,255,255," + (p.opacity * busyDim) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "wind") {
        p.x += p.speed / 60;
        p.y += Math.sin(p.phase) * 0.6;
        if (p.x > w + 160) { p.x = -160; p.y = Math.random() * h; }
        ctx.strokeStyle = "rgba(220,230,245," + (p.opacity * busyDim) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.length || 60), p.y + 2);
        ctx.stroke();
      } else if (kind === "fog" || kind === "hot") {
        p.x += p.speed / 60;
        if (p.x > w + 200) { p.x = -200; p.y = Math.random() * h; }
        var gradX = p.x;
        var grad = ctx.createLinearGradient(gradX - 160, 0, gradX + 160, 0);
        var color = kind === "hot" ? "255,220,160" : "225,230,240";
        grad.addColorStop(0, "rgba(" + color + ",0)");
        grad.addColorStop(0.5, "rgba(" + color + "," + (p.opacity * busyDim) + ")");
        grad.addColorStop(1, "rgba(" + color + ",0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }
  function weatherFxLoop(ts) {
    if (doc.hidden) { weatherFxStop(); return; }
    var spec = weatherFxCurrent();
    var gate = weatherFxGate(memory.state);
    if (!gate.enabled || !spec) { weatherFxStop(); return; }
    var dim = gate.busy ? 0.6 : 1;
    var intensity = gate.busy ? Math.max(1, spec.intensity - 1) : spec.intensity;
    var now = Date.now();
    if (spec.mode === "static" || gate.staticOnly) {
      if (weatherFxState.staticOnly !== true) {
        weatherFxState.staticOnly = true;
        weatherFxDrawStatic({ tint: spec.params.tint, opacity: spec.params.opacity * dim });
      }
    } else {
      weatherFxState.staticOnly = false;
      weatherFxDrawMotion(spec.params, now, dim);
      if (spec.kind === "thunder" && spec.params.flash) {
        if (!weatherFxState.nextFlashAt) weatherFxState.nextFlashAt = now + spec.params.flash.minMs + Math.random() * (spec.params.flash.maxMs - spec.params.flash.minMs);
        if (now >= weatherFxState.nextFlashAt && now >= weatherFxState.flashUntil) {
          weatherFxState.flashUntil = now + 140;
          weatherFxState.nextFlashAt = now + spec.params.flash.minMs + Math.random() * (spec.params.flash.maxMs - spec.params.flash.minMs);
        }
        if (now < weatherFxState.flashUntil) {
          var ctx = weatherFxState.ctx;
          ctx.setTransform(weatherFxState.dpr, 0, 0, weatherFxState.dpr, 0, 0);
          ctx.fillStyle = "rgba(255,255,255," + (spec.params.flash.opacity * dim) + ")";
          ctx.fillRect(0, 0, root.innerWidth, root.innerHeight);
        }
      }
    }
    weatherFxState.rafId = root.requestAnimationFrame(weatherFxLoop);
  }
  function weatherFxStart(spec) {
    if (weatherFxState.running && weatherFxState.kind === spec.kind && weatherFxState.intensity === spec.intensity) return;
    weatherFxStop();
    ensureFxLayer();
    weatherFxSize();
    weatherFxState.kind = spec.kind;
    weatherFxState.mode = spec.mode;
    weatherFxState.intensity = spec.intensity;
    weatherFxState.particles = (spec.mode === "motion") ? weatherFxSeedParticles(spec.params) : [];
    weatherFxState.staticOnly = false;
    weatherFxState.running = true;
    weatherFxState.lastFrame = Date.now();
    weatherFxState.rafId = root.requestAnimationFrame(weatherFxLoop);
  }
  function weatherFxStop() {
    if (weatherFxState.rafId) { root.cancelAnimationFrame(weatherFxState.rafId); weatherFxState.rafId = 0; }
    weatherFxState.running = false;
    weatherFxState.particles = [];
    weatherFxState.nextFlashAt = 0;
    weatherFxState.flashUntil = 0;
    var nodes = doc.querySelectorAll("[data-dsh-whale-weather-fx]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
    weatherFxState.canvas = null;
    weatherFxState.ctx = null;
  }
  function weatherFxReconcile(computed) {
    var gate = weatherFxGate(computed);
    var spec = weatherFxCurrent();
    if (!gate.enabled || !spec) { weatherFxStop(); return; }
    if (!weatherFxState.running || weatherFxState.kind !== spec.kind || weatherFxState.intensity !== spec.intensity) {
      weatherFxStart(spec);
    }
    if (weatherFxState.busy !== gate.busy) weatherFxState.busy = gate.busy;
  }
  root.__dshWhaleMoeWeatherFxDebug = {
    get running() { return weatherFxState.running; },
    get kind() { return weatherFxState.kind; },
    get intensity() { return weatherFxState.intensity; },
    get busy() { return weatherFxState.busy; },
    get particles() { return weatherFxState.particles.length; }
  };

  /* ---------- idle chat scheduler (5-8 min, context-aware) ---------- */
  var IDLE_CHAT_MIN = 5 * 60000;
  var IDLE_CHAT_MAX = 8 * 60000;
  var GREET_GAP_MS = 3 * 3600000;
  var idleChat = {
    nextAt: Date.now() + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN)),
    lastGreetAt: -Infinity,
    lastGreetBucket: ""
  };

  function rememberLine(line) {
    if (!line) return;
    recentLines.push(line);
    if (recentLines.length > 12) recentLines.shift();
  }

  function latestTaskTopic() {
    try {
      var nodes = doc.querySelectorAll('[data-slot="conversation.chat.node"]');
      if (!nodes.length) return "general";
      var last = nodes[nodes.length - 1];
      var text = (last.textContent || "").slice(0, 1200);
      return core.classifyTask(text);
    } catch (e) { return "general"; }
  }

  function bubbleFree() {
    try {
      var bubble = doc.querySelector("[data-dsh-whale-bubble]");
      return !bubble || bubble.hidden || !(bubble.textContent || "").trim();
    } catch (e) { return true; }
  }

  function showChatLine(line) {
    if (!line) return;
    rememberLine(line);
    showLine(line);
  }

  function maybeGreet(now) {
    if (now - idleChat.lastGreetAt < GREET_GAP_MS) return false;
    var bucket = core.greetBucket(new Date(now).getHours());
    if (bucket === "night") return false;
    idleChat.lastGreetAt = now;
    idleChat.lastGreetBucket = bucket;
    var line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
    var summary = weatherSummary();
    if (line && summary) line += " · 现在 " + Math.round(summary.temp) + "°C " + summary.label;
    showChatLine(line);
    return true;
  }

  function idleChatTick(now) {
    var city = readWeather("weatherCity").trim();
    var view = detectView();
    if (view === "settings" || memory.state.state !== "idle" || !readPref("chat") || !bubbleFree() || !readPref("pet")) return;
    if (now < idleChat.nextAt) return;

    idleChat.nextAt = now + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN));
    var line = "";
    var bucket = core.greetBucket(new Date(now).getHours());
    if (now - idleChat.lastGreetAt >= GREET_GAP_MS && bucket !== "night") {
      line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
      idleChat.lastGreetAt = now;
      idleChat.lastGreetBucket = bucket;
    } else if (city) {
      weatherEnsure(false).then(function () {
        if (memory.state.state !== "idle" || !bubbleFree() || !weatherChangedSinceTold()) return;
        var weatherNow = weatherLine(Date.now(), 0);
        if (weatherNow) {
          var summary = weatherSummary();
          weatherState.lastToldKind = summary ? summary.kind : "";
          var weatherPose = "";
          if (summary && weatherState.current) {
            var fxSpec = core.weatherFx(weatherState.current.code, weatherState.current.temp, weatherState.current.wind);
            var fxKind = fxSpec ? fxSpec.kind : summary.kind;
            if (fxKind === "rain") weatherPose = Math.random() < 0.3 ? "weather-rain-happy" : "weather-umbrella";
            else if (fxKind === "snow") weatherPose = "weather-snow";
            else if (fxKind === "cold") weatherPose = "weather-cold";
            else if (fxKind === "thunder") weatherPose = "weather-thunder";
            else if (fxKind === "hot") weatherPose = "daily-melt";
          }
          if (weatherPose) showMood(weatherPose, 6500, true);
          showChatLine(weatherNow);
        }
      });
    }
    if (!line) {
      var topic = latestTaskTopic();
      line = core.pickDialogueAvoidRecent("context", topic, 0, Math.random, recentLines);
    }
    if (!line && growth && growth.level >= 3 && Math.random() < 0.25) {
      var tier = core.moodTier(growth.mood);
      var bondEvent = growth.level >= 7 ? "l7" : (growth.level >= 5 ? "l5" : "l3");
      if (tier === "low") bondEvent = "low-mood";
      else if (tier === "high" && Math.random() < 0.5) bondEvent = "high-mood";
      line = core.pickDialogueAvoidRecent("bond", bondEvent, 0, Math.random, recentLines);
    }
    if (!line) {
      var memeBank = Math.random() < 0.5 ? "worker" : (Math.random() < 0.5 ? "slack" : "ddl");
      line = core.pickDialogueAvoidRecent("meme", memeBank, 0, Math.random, recentLines);
    }
    if (line) showChatLine(line);
  }

  root.__dshWhaleMoeIdleChat = idleChat;
  root.__dshWhaleMoeClaimQuest = claimQuestById;
  root.__dshWhaleMoeApplyBadge = applyBadge;

  function onUserActivity() {
    memory.lastInteractionAt = Date.now();
    schedule();
  }

  function start() {
    if (root.__dshWhaleMoeStarted) return;
    root.__dshWhaleMoeStarted = true;
    root.addEventListener("pointerdown", onUserActivity, true);
    root.addEventListener("keydown", onUserActivity, true);
    root.addEventListener("resize", schedule);
    root.addEventListener("storage", schedule);
    root.addEventListener("whale-moe-prefs-change", schedule);
    root.addEventListener("visibilitychange", function () {
      if (doc.hidden) {
        if (gameOpen) { gamePausedFlag = true; gamePauseBadge(true, "hidden"); }
        weatherFxStop();
      } else {
        schedule();
      }
    });    try {
      fetch("/assets/peek-calibration.json").then(function (r) { return r.json(); }).then(function (json) {
        root.__dshWhalePeekCalibration = json;
        schedule();
      }).catch(function () { /* fallback sizes */ });
    } catch (e) { /* fetch unavailable */ }
    if (!root.__dshWhaleMoeIdleTimer && !motionReduced()) {
      root.__dshWhaleMoeIdleTimer = root.setInterval(function () {
        var now = Date.now();
        var node = doc.querySelector("[data-dsh-whale-root]");
        if (node && memory.state.state === "idle") {
          /* 微动作：随机 18-28s 一次，幅度轻 */
          if (!memory.nextIdleMicroAt) memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000);
          if (now >= memory.nextIdleMicroAt) {
            memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000);
            var motionNode = node.querySelector("[data-dsh-whale-motion]");
            if (motionNode && !layerState.pendingSwap) {
              var cls = Math.random() < 0.5 ? "dsh-whale-hop" : "dsh-whale-squint";
              motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint");
              void motionNode.offsetWidth;
              motionNode.classList.add(cls);
              root.setTimeout(function () { motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint"); }, 900);
            }
          }
          /* 大动作：随机 35-60s 一次，无固定顺序，每张停留 4.2-5.8s。
             D7: 复活低频毒舌(teasing)——仅非工作台视图、待机态、按
             TEASE_CHANCE 概率触发，不进入状态机，工作态稳定规则不受影响。 */
          if (!memory.nextIdleActionAt) memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000);
          if (now >= memory.nextIdleActionAt) {
            memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000);
            var teasingView = detectView() !== "workbench";
            if (teasingView && Math.random() < core.TEASE_CHANCE * 4) {
              showMood("teasing", 3200, true);
              if (readPref("chat")) {
                var teaseLine = say("interact", "tease");
                if (teaseLine) showChatLine(teaseLine);
              }
            } else {
              showMood(IDLE_ACTION_POOL[Math.floor(Math.random() * IDLE_ACTION_POOL.length)], 4200 + Math.floor(Math.random() * 1600), true);
            }
          }
        }
        /* 工作状态保持 running 姿势稳定，不再随机切工作小剧场；
           低余额提示也只在不忙时露脸，免得打断工作态。 */
        try {
          var low = root.localStorage.getItem("dsh.balance.low") === "1";
          if (low && !BUSY_STATES[memory.state.state] && now - lastBalanceLowAt > 60000) {
            lastBalanceLowAt = now;
            showMood("balance-low", 5000, true);
          }
        } catch (e) { /* ignore */ }
        schedule();
      }, 3000);
    }
    root.addEventListener("dsh-whale-balance-low", function () {
      lastBalanceLowAt = Date.now();
      if (!BUSY_STATES[memory.state.state]) showMood("balance-low", 5000, true);
      if (growth && growth.achievements.indexOf("balance-low") === -1) {
        growth.achievements.push("balance-low");
        saveGrowth();
        announceUnlocks(["balance-low"]);
      }
    });
    var gazePending = false;
    root.addEventListener("pointermove", function (event) {
      if (gazePending || motionReduced()) return;
      var mode = readMode();
      if (mode !== "float" && mode !== "side") return;
      var node = doc.querySelector("[data-dsh-whale-root]");
      if (!node) return;
      gazePending = true;
      root.requestAnimationFrame(function () {
        gazePending = false;
        var rect = node.getBoundingClientRect();
        if (rect.width <= 1) return;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var gx = clamp((event.clientX - cx) / Math.max(rect.width, 48) * 5, -4, 4);
        var gy = clamp((event.clientY - cy) / Math.max(rect.height, 48) * 4, -3, 3);
        node.style.setProperty("--wm-gaze-x", gx.toFixed(2) + "px");
        node.style.setProperty("--wm-gaze-y", gy.toFixed(2) + "px");
        node.style.setProperty("--wm-gaze-r", (gx * 0.3).toFixed(2) + "deg");
      });
    }, { passive: true });

    function init() {
      safeReconcile();
      observer = new root.MutationObserver(schedule);
      observer.observe(doc.documentElement, {
        attributes: true,
        childList: true,
        subtree: true
      });
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }

  root.__dshWhaleMoeDebug = { state: "boot", pose: null, line: "", view: "home" };
  start();
})(typeof window === "undefined" ? null : window);
