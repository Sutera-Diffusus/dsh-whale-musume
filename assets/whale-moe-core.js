/* whale-moe-core v1 — pure, DOM-free state machine for the DSH whale-moe theme. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DshWhaleMoeCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var PACK_ID = "whale-moe";
  var AFK_MS = 180000;
  var SPEECH_GAP_MS = 6000;
  var SUCCESS_WINDOW_MS = 2000;
  var CURIOUS_WINDOW_MS = 6000;
  var TEASE_CHANCE = 0.006;

  /* Pose assets that exist in /assets/generated today. thinking/afk have
     dedicated approved poses; tool keeps the original running pose (user
     decision 2026-08-18); sleep keeps its own asset. */
  var POSES = Object.freeze({
    idle: "idle-cute",
    waiting: "waiting",
    thinking: "thinking",
    tool: "running",
    success: "success",
    failure: "failure",
    curious: "curious",
    teasing: "teasing",
    afk: "afk",
    blush: "blush",
    angry: "angry",
    eat: "eat",
    star: "star",
    celebrate: "celebrate",
    sleep: "sleep",
    greet: "greet",
    night: "night",
    wink: "wink",
    bold: "bold",
    abstract: "abstract",
    sweep: "sweep",
    workSlack: "work-slack",
    workRam: "work-ram",
    coolShades: "cool-shades",
    balanceLow: "balance-low",
    workPat: "work-pat",
    hidden: null
  });

  var LINES = Object.freeze({
    idle: [
      "主人～今天想做什么呀？",
      "工房一切就绪，随时可以开工哦。",
      "待机中……耳朵可没闲着，我听见 bug 在远处笑😼",
      "主人要是累了就戳戳我，免费解压，童叟无欺🫧",
      "今天风很轻，适合把待办也一起吹跑🌬️"
    ],
    waiting: [
      "点单吗？鲸鱼娘已经准备好啦～",
      "在等什么？等你一声令下，我立刻营业🎀",
      "新订单还没来，我先擦擦锅……擦擦主机💻",
      "排队中，鲸鱼娘的尾巴已经进入待命状态🐋"
    ],
    thinking: [
      "正在打奶油……不对，是在认真思考～",
      "让鲸鱼娘想想……尾巴都转起来了。",
      "思考中，请勿投喂，除非是能补脑的小蛋糕🧁",
      "这个问题有点东西，我正在把它盘圆🌀",
      "灵感加载中，进度条卡在 99% 是正常现象✨"
    ],
    tool: [
      "后厨开工！这单交给鲸鱼娘～",
      "叮叮当当，工具转起来啦。",
      "工作中！鲸鱼娘已经抱紧笔记本，闲人退散😤",
      "这速度，主人跟得上吗？跟不上就喝口水坐好🍵",
      "工具们今天也很听话，毕竟我管饭（虚拟的）🔧"
    ],
    success: [
      "叮！这炉烤好了！",
      "完成啦！请主人品尝～",
      "收工！限时夸夸窗口已开启，先到先得👏",
      "漂亮！这单稳得像我的发型……等等，我的发型呢😳",
      "搞定啦，主人可以摸鱼五分钟，我批准了🎫"
    ],
    failure: [
      "呜……翻车了，鲸鱼娘陪你一起修。",
      "别急别急，鲸鱼娘再烤一次！",
      "报错而已，又不是世界末日，鲸鱼娘抱抱先🥺",
      "这个 bug 好嚣张，看我把它的网线拔了💢",
      "失败了也别低头，鲸鱼娘的尾巴借你握一下🐋"
    ],
    curious: [
      "新订单？让我康康～",
      "主人换菜单了吗？",
      "咦，有好玩的事情，鲸鱼娘的雷达响了📡",
      "什么东西什么东西，给我也看看👀"
    ],
    teasing: [
      "主人认真工作的样子，很好看哦。",
      "偷偷给你加一颗糖～",
      "鲸鱼娘什么都没说，只是嘴角有点压不住😏",
      "主人今天的勤奋值有点高，是不是想卷死谁🌪️"
    ],
    afk: [
      "鲸鱼娘眯一会儿，有单就叫醒我～",
      "主人不在，鲸鱼娘先给工房放一首催眠曲🎵",
      "ZZZ……梦里也在帮主人数 bug🐑",
      "呼……有什么急事就摇摇我的尾巴，我马上醒🌙"
    ]
  });

  function pickLine(state, lineCount) {
    var lines = LINES[state] || [];
    if (lines.length === 0) return "";
    return lines[Math.abs(lineCount | 0) % lines.length];
  }

  /* ================= hit zones (pat regions) ================= */

  var HIT_ZONES = Object.freeze({
    /* Full-body square poses (float 200 / side-busy 112 / mini 64). Ordered:
       first matching rectangle wins (tail > head > belly); any miss falls
       back to head. Coordinates are normalized [0,1] of the 512x512 frame. */
    full: Object.freeze([
      Object.freeze({ id: "tail", x0: 0.00, y0: 0.78, x1: 1.00, y1: 1.00 }),
      Object.freeze({ id: "head", x0: 0.20, y0: 0.00, x1: 0.80, y1: 0.45 }),
      Object.freeze({ id: "belly", x0: 0.18, y0: 0.45, x1: 0.82, y1: 0.78 })
    ]),
    /* Peek poses (home-peek / workbench-peek) show only the face: whole area = head. */
    peek: Object.freeze([
      Object.freeze({ id: "head", x0: 0, y0: 0, x1: 1, y1: 1 })
    ])
  });

  /* Pure: nx, ny are the normalized click point inside the mascot frame.
     Boundaries are inclusive; the array order decides shared edges. */
  function hitZone(nx, ny, poseSet) {
    var set = HIT_ZONES[poseSet === "full" ? "full" : "peek"];
    if (!set) return "head";
    var x = Math.max(0, Math.min(1, Number(nx) || 0));
    var y = Math.max(0, Math.min(1, Number(ny) || 0));
    for (var i = 0; i < set.length; i += 1) {
      var z = set[i];
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.id;
    }
    return "head";
  }

  function base(prev) {
    var defaults = { state: "idle", since: -Infinity, lastSpeechAt: -Infinity, streak: 0, lineCount: 0 };
    return prev && typeof prev === "object" && typeof prev.state === "string"
      ? Object.assign({}, defaults, prev)
      : defaults;
  }

  /**
   * Pure transition. Priority: error > tool > thinking > success(window)
   * > curious(window) > waiting > afk/idle. Afk is evaluated after errors
   * and tools so real work never gets covered by the nap state.
   */
  function computeState(prev, signals, now, rng) {
    var p = base(prev);
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var s = signals && typeof signals === "object" ? signals : {};
    var lastInteraction = typeof s.lastInteraction === "number" ? s.lastInteraction : t;

    if (s.petDisabled) {
      return { state: "hidden", pose: null, line: "", speak: false, at: t, since: t, lastSpeechAt: p.lastSpeechAt, streak: 0, lineCount: p.lineCount, mode: "normal" };
    }

    var state;
    if (s.error) state = "failure";
    else if (s.tool) state = "tool";
    else if (s.thinking) state = "thinking";
    else if (Number.isFinite(s.successAt) && s.successAt >= 0 && t - s.successAt >= 0 && t - s.successAt <= SUCCESS_WINDOW_MS) state = "success";
    else if (Number.isFinite(s.curiousAt) && s.curiousAt >= 0 && t - s.curiousAt >= 0 && t - s.curiousAt <= CURIOUS_WINDOW_MS) state = "curious";
    else if (s.waiting) state = "waiting";
    else if (t - lastInteraction >= AFK_MS) state = "afk";
    else state = "idle";

    var changed = state !== p.state;
    var gapOk = t - p.lastSpeechAt >= SPEECH_GAP_MS;
    var speak = (changed || gapOk) && state !== "hidden";
    var lineCount = changed ? p.lineCount + 1 : p.lineCount;

    return {
      state: state,
      pose: POSES[state] || null,
      line: speak ? pickLine(state, lineCount) : "",
      speak: speak,
      at: t,
      since: changed ? t : p.since,
      lastSpeechAt: speak ? t : p.lastSpeechAt,
      streak: state === "failure" ? (changed ? p.streak + 1 : p.streak) : 0,
      lineCount: lineCount,
      mode: s.denseCode ? "mini" : "normal"
    };
  }

  /* ================= mini game: bubble pop (pure, DOM-free) ================= */

  var GAME = Object.freeze({
    DURATION_MS: 30000, GRID: 4, SPAWN_INTERVAL_MS: 500,
    BUBBLE_LIFE_MS: 1600, STAR_LIFE_MS: 1200,
    STAR_P: 0.15, BOMB_P: 0.10, COMBO_WINDOW_MS: 1200,
    WIN_SCORE: 300, DRAW_SCORE: 150,
    BASE: 10, STAR_SCORE: 30, BOMB_SCORE: -20, COMBO_CAP: 10,
    REWARDS_PER_DAY: 3
  });

  function gameNewState(now, rng) {
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var board = [];
    for (var i = 0; i < GAME.GRID * GAME.GRID; i += 1) board.push(null);
    return {
      board: board, score: 0, combo: 0, comboAt: 0, comboMax: 0,
      remainingMs: GAME.DURATION_MS, nextSpawnAt: t + GAME.SPAWN_INTERVAL_MS,
      lastAt: t, status: "playing"
    };
  }

  function gameTick(state, now, rng) {
    if (!state || state.status !== "playing") return { state: state, events: [] };
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var dt = Math.max(0, t - (typeof state.lastAt === "number" ? state.lastAt : t));
    var events = [];
    var board = state.board.slice();
    var changed = false;
    /* expire bubbles */
    for (var i = 0; i < board.length; i += 1) {
      if (!board[i]) continue;
      var life = board[i].kind === "star" ? GAME.STAR_LIFE_MS : GAME.BUBBLE_LIFE_MS;
      if (t - board[i].bornAt >= life) {
        board[i] = null;
        changed = true;
        events.push({ kind: "expire", cell: i });
      }
    }
    /* spawn at most one bubble per tick on a random empty cell */
    var spawned = false;
    if (t >= state.nextSpawnAt) {
      var empties = [];
      for (var e = 0; e < board.length; e += 1) if (!board[e]) empties.push(e);
      if (empties.length > 0) {
        var r = typeof rng === "function" ? rng() : Math.random();
        var cell = empties[Math.floor(r * empties.length) % empties.length];
        var r2 = typeof rng === "function" ? rng() : Math.random();
        var kind = r2 < GAME.BOMB_P ? "bomb" : (r2 < GAME.BOMB_P + GAME.STAR_P ? "star" : "bubble");
        board[cell] = { kind: kind, bornAt: t };
        changed = true;
        spawned = true;
        events.push({ kind: "spawn", cell: cell, bubble: kind });
      }
    }
    var remainingMs = Math.max(0, state.remainingMs - dt);
    var next = Object.assign({}, state, {
      board: changed ? board : state.board,
      remainingMs: remainingMs,
      lastAt: t,
      nextSpawnAt: spawned ? t + GAME.SPAWN_INTERVAL_MS : state.nextSpawnAt,
      status: remainingMs <= 0 ? "ended" : "playing"
    });
    return { state: next, events: events };
  }

  function gamePop(state, cell, now, rng) {
    if (!state || state.status !== "playing") {
      return { state: state, hit: false, kind: "", delta: 0, combo: state ? state.combo : 0 };
    }
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var bubble = state.board[cell];
    if (!bubble) return { state: state, hit: false, kind: "", delta: 0, combo: state.combo };
    var board = state.board.slice();
    board[cell] = null;
    if (bubble.kind === "bomb") {
      return {
        state: Object.assign({}, state, { board: board, combo: 0, comboAt: 0 }),
        hit: true, kind: "bomb", delta: GAME.BOMB_SCORE, combo: 0
      };
    }
    var combo = (t - state.comboAt <= GAME.COMBO_WINDOW_MS && state.combo > 0) ? state.combo + 1 : 1;
    var base = bubble.kind === "star" ? GAME.STAR_SCORE : GAME.BASE;
    var bonus = Math.min(combo, GAME.COMBO_CAP) * 2;
    var delta = base + bonus;
    var next = Object.assign({}, state, {
      board: board,
      score: state.score + delta,
      combo: combo,
      comboAt: t,
      comboMax: Math.max(state.comboMax, combo)
    });
    return { state: next, hit: true, kind: bubble.kind, delta: delta, combo: combo };
  }

  function gameGrade(score) {
    if (score >= GAME.WIN_SCORE) return "win";
    if (score >= GAME.DRAW_SCORE) return "draw";
    return "lose";
  }

  function gameResult(state) {
    var score = state ? state.score : 0;
    return { score: score, grade: gameGrade(score), comboMax: state ? state.comboMax : 0 };
  }

  function gameReward(grade) {
    return grade === "win" ? "game-win" : (grade === "draw" ? "game-draw" : "game-lose");
  }

  function gameRewardAllowed(stats, now) {
    if (!stats) return true;
    var today = dayKey(now);
    if (stats.today !== today) return true;
    return (stats.playsToday | 0) < GAME.REWARDS_PER_DAY;
  }

  function evaluateGameAchievements(have, gameStats) {
    var out = [];
    var has = have && have.length ? have : [];
    var s = gameStats || {};
    if ((s.plays | 0) >= 1 && has.indexOf("game-first") === -1) out.push("game-first");
    if ((s.wins | 0) >= 1 && has.indexOf("game-win") === -1) out.push("game-win");
    if ((s.comboMax | 0) >= 10 && has.indexOf("game-combo10") === -1) out.push("game-combo10");
    if (s.highscore && has.indexOf("game-highscore") === -1) out.push("game-highscore");
    return out;
  }

  /* ================= mini game 2: catch the snacks (pure, DOM-free) ================= */

  var CATCH = Object.freeze({
    DURATION_MS: 30000, SPAWN_INTERVAL_MS: 900,
    BASKET_W: 0.18, BASKET_Y: 0.92, CATCH_BAND: 0.05,
    FALL_BASE: 0.16, FALL_MAX: 0.42, /* fraction of screen height per second */
    CAKE_P: 0.75, STAR_P: 0.15, BOMB_P: 0.10,
    CAKE_SCORE: 10, STAR_SCORE: 30, BOMB_SCORE: -20,
    COMBO_WINDOW_MS: 1500
  });

  function catchNewState(now, rng) {
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    return {
      items: [], basketX: 0.5, score: 0, combo: 0, comboAt: 0, comboMax: 0,
      caught: 0, missed: 0, remainingMs: CATCH.DURATION_MS,
      nextSpawnAt: t + CATCH.SPAWN_INTERVAL_MS, lastAt: t, status: "playing"
    };
  }

  function catchTick(state, now, rng) {
    if (!state || state.status !== "playing") return { state: state, events: [] };
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var dt = Math.max(0, t - (typeof state.lastAt === "number" ? state.lastAt : t)) / 1000;
    var events = [];
    var items = state.items.map(function (it) { return { x: it.x, y: it.y, kind: it.kind, resolved: it.resolved }; });
    var score = state.score;
    var combo = state.combo;
    var comboAt = state.comboAt;
    var comboMax = state.comboMax;
    var caught = state.caught;
    var missed = state.missed;
    /* spawn */
    var spawned = false;
    if (t >= state.nextSpawnAt) {
      var r = typeof rng === "function" ? rng() : Math.random();
      var kind = r < CATCH.BOMB_P ? "bomb" : (r < CATCH.BOMB_P + CATCH.STAR_P ? "star" : "cake");
      items.push({ x: 0.08 + Math.random() * 0.84, y: -0.06, kind: kind, resolved: false });
      spawned = true;
    }
    /* advance and resolve */
    var progress = 1 - state.remainingMs / CATCH.DURATION_MS;
    var speed = CATCH.FALL_BASE + progress * (CATCH.FALL_MAX - CATCH.FALL_BASE);
    var nextItems = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      item.y += speed * dt;
      if (!item.resolved && item.y >= CATCH.BASKET_Y - CATCH.CATCH_BAND) {
        item.resolved = true;
        var caughtIt = Math.abs(item.x - state.basketX) <= CATCH.BASKET_W / 2 + 0.03;
        if (caughtIt) {
          var baseScore = item.kind === "star" ? CATCH.STAR_SCORE : (item.kind === "bomb" ? CATCH.BOMB_SCORE : CATCH.CAKE_SCORE);
          if (item.kind === "bomb") { combo = 0; comboAt = 0; score = Math.max(0, score + baseScore); }
          else {
            var newCombo = (t - comboAt <= CATCH.COMBO_WINDOW_MS && combo > 0) ? combo + 1 : 1;
            combo = newCombo;
            comboAt = t;
            comboMax = Math.max(comboMax, combo);
            score += baseScore + Math.min(combo, 10) * 2;
          }
          caught += 1;
          events.push({ kind: "caught", item: item.kind, score: score });
        } else {
          missed += 1;
          if (item.kind !== "bomb") { combo = 0; comboAt = 0; }
          events.push({ kind: "missed", item: item.kind });
        }
      }
      if (!item.resolved && item.y < 1.05) nextItems.push(item);
    }
    var remainingMs = Math.max(0, state.remainingMs - dt * 1000);
    var next = Object.assign({}, state, {
      items: nextItems, score: score, combo: combo, comboAt: comboAt, comboMax: comboMax,
      caught: caught, missed: missed, remainingMs: remainingMs, lastAt: t,
      nextSpawnAt: spawned ? t + CATCH.SPAWN_INTERVAL_MS : state.nextSpawnAt,
      status: remainingMs <= 0 ? "ended" : "playing"
    });
    return { state: next, events: events };
  }

  function catchMove(state, basketX) {
    if (!state) return state;
    var x = typeof basketX === "number" && Number.isFinite(basketX) ? basketX : 0.5;
    return Object.assign({}, state, { basketX: Math.max(0.02, Math.min(0.98, x)) });
  }

  function catchResult(state) {
    return {
      score: state ? state.score : 0,
      grade: gameGrade(state ? state.score : 0),
      comboMax: state ? state.comboMax : 0,
      caught: state ? state.caught : 0,
      missed: state ? state.missed : 0
    };
  }

  /* ================= growth / keywords / dialogue ================= */

  var GROWTH = Object.freeze({
    MOOD_MAX: 100, AFFINITY_MAX: 10000, SATIETY_MAX: 100,
    LEVEL_STEP: 500, SATIETY_DECAY_PER_MIN: 0.15
  });

  var DEFAULT_GROWTH = Object.freeze({
    mood: 70, affinity: 0, satiety: 80,
    lastSignin: "", signinStreak: 0,
    achievements: [], level: 1
  });

  var ACHIEVEMENTS = Object.freeze([
    { id: "first-pat", icon: "🫳", name: "初次摸头", desc: "第一次摸 鲸鱼娘的头" },
    { id: "ten-pats", icon: "🖐️", name: "摸头十连", desc: "累计摸头 10 次" },
    { id: "hundred-pats", icon: "💯", name: "摸头百连", desc: "累计摸头 100 次" },
    { id: "first-feed", icon: "🍰", name: "投喂成功", desc: "第一次投喂小点心" },
    { id: "first-triple", icon: "🎉", name: "三连击", desc: "触发比心彩蛋" },
    { id: "thanks", icon: "💬", name: "嘴甜", desc: "对 鲸鱼娘说谢谢" },
    { id: "lv5", icon: "⭐", name: "五级", desc: "好感度达到 Lv5" },
    { id: "lv10", icon: "👑", name: "十级", desc: "好感度达到 Lv10" },
    { id: "signin3", icon: "📅", name: "常客", desc: "连续签到 3 天" },
    { id: "signin7", icon: "🗓️", name: "一周之约", desc: "连续签到 7 天" },
    { id: "night-owl", icon: "🌙", name: "深夜陪伴", desc: "22:00–6:00 期间互动一次" },
    { id: "comeback", icon: "👋", name: "欢迎回来", desc: "离开 2 小时以上后回来" },
    { id: "day1", icon: "💞", name: "一日之缘", desc: "鲸鱼娘陪伴满 1 天" },
    { id: "day7", icon: "💎", name: "一周相伴", desc: "鲸鱼娘陪伴满 7 天" },
    { id: "day30", icon: "🏛️", name: "三十日契约", desc: "鲸鱼娘陪伴满 30 天" },
    { id: "first-tool", icon: "🛠️", name: "开工啦", desc: "第一次看到工具运行" },
    { id: "tools-10", icon: "🔧", name: "工具十连", desc: "累计看到 10 次工具运行" },
    { id: "tools-50", icon: "🏭", name: "工具五十连", desc: "累计看到 50 次工具运行" },
    { id: "tools-100", icon: "🛰️", name: "工具百连", desc: "累计看到 100 次工具运行" },
    { id: "first-code", icon: "💻", name: "代码初体验", desc: "第一次看到代码块/终端" },
    { id: "code-20", icon: "📟", name: "代码狂人", desc: "累计看到 20 个代码块/终端" },
    { id: "first-success", icon: "✅", name: "旗开得胜", desc: "第一次任务完成" },
    { id: "success-10", icon: "🏆", name: "任务十连", desc: "累计 10 次任务完成" },
    { id: "first-failure", icon: "🩹", name: "初次翻车", desc: "第一次任务报错" },
    { id: "fail-10", icon: "🚑", name: "翻车十连", desc: "累计 10 次任务报错" },
    { id: "messages-100", icon: "💌", name: "会话百条", desc: "累计看到 100 条会话消息" },
    { id: "messages-500", icon: "📚", name: "消息五百条", desc: "累计看到 500 条会话消息" },
    { id: "keyword-master", icon: "🔍", name: "关键词大师", desc: "关键词互动 10 次" },
    { id: "night-work", icon: "🦉", name: "深夜赶工", desc: "深夜 22:00–6:00 工具仍在运行" },
    { id: "balance-low", icon: "🪙", name: "余额告急", desc: "触发一次余额不足提醒" },
    { id: "game-first", icon: "🫧", name: "初次开玩", desc: "第一次结算一局小游戏" },
    { id: "game-win", icon: "👑", name: "泡泡之王", desc: "单局戳泡泡得分达到 300" },
    { id: "game-combo10", icon: "🔥", name: "连击达人", desc: "单局最高连击达到 10" },
    { id: "game-highscore", icon: "🏆", name: "纪录刷新", desc: "打破一次历史最高分" },
    { id: "quest-first", icon: "🎯", name: "任务初体验", desc: "完成第一个每日任务" },
    { id: "quest-all", icon: "🎟️", name: "一日全勤", desc: "单日 3 个每日任务全部领取" },
    { id: "week-signin7", icon: "🏆", name: "周常满勤", desc: "本周签到板集满 7 格" },
    { id: "bond-action", icon: "🌟", name: "新动作解锁", desc: "好感度达到 Lv3" },
    { id: "bond-badge", icon: "🎖️", name: "称号首解锁", desc: "好感度达到 Lv5" }
  ]);

  function dayKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function computeGrowth(prev, event, now, pats) {
    var g = Object.assign({}, DEFAULT_GROWTH, prev || {});
    g.achievements = (g.achievements || []).slice();
    var deltas = { mood: 0, affinity: 0, satiety: 0 };
    var unlocks = [];
    var leveledUp = false;
    var type = event && event.type ? event.type : "";
    var deltaMin = event && typeof event.deltaMin === "number" ? event.deltaMin : 0;

    if (type === "pat") { deltas.mood += 4; deltas.affinity += 2; }
    else if (type === "poke") { deltas.mood -= 6; }
    else if (type === "feed") { deltas.satiety += 30; deltas.affinity += 5; deltas.mood += 3; }
    else if (type === "triple") { deltas.mood += 10; deltas.affinity += 10; }
    else if (type === "success") { deltas.mood += 3; }
    else if (type === "failure") { deltas.mood -= 5; }
    else if (type === "thanks") { deltas.mood += 6; deltas.affinity += 20; }
    else if (type === "praise") { deltas.mood += 5; deltas.affinity += 8; }
    else if (type === "belly") { deltas.mood += 3; deltas.affinity += 2; }
    else if (type === "tail") { deltas.mood += 2; deltas.affinity += 3; }
    else if (type === "tick") { deltas.satiety -= deltaMin * GROWTH.SATIETY_DECAY_PER_MIN; }
    else if (type === "signin") {
      var today = dayKey(now);
      if (g.lastSignin !== today) {
        var yesterday = new Date((typeof now === "number" ? now : Date.now()) - 86400000);
        var yKey = yesterday.getFullYear() + "-" + (yesterday.getMonth() + 1) + "-" + yesterday.getDate();
        g.signinStreak = g.lastSignin === yKey ? g.signinStreak + 1 : 1;
        g.lastSignin = today;
        deltas.mood += 5;
      }
    }
    else if (type === "game-win") { deltas.mood += 8; deltas.affinity += 12; }
    else if (type === "game-draw") { deltas.mood += 2; deltas.affinity += 3; }
    else if (type === "game-lose") { deltas.mood -= 3; }
    else if (type === "high-score") { deltas.affinity += 5; }
    else if (type === "quest") { deltas.affinity += 8; deltas.mood += 2; }
    else if (type === "questAll") { deltas.affinity += 20; deltas.mood += 5; }
    else if (type === "weekly") { deltas.affinity += 30; deltas.mood += 5; }

    g.mood = Math.max(0, Math.min(GROWTH.MOOD_MAX, g.mood + deltas.mood));
    g.affinity = Math.max(0, Math.min(GROWTH.AFFINITY_MAX, g.affinity + deltas.affinity));
    g.satiety = Math.max(0, Math.min(GROWTH.SATIETY_MAX, g.satiety + deltas.satiety));
    var level = Math.max(1, Math.floor(g.affinity / GROWTH.LEVEL_STEP) + 1);
    if (level > g.level) { leveledUp = true; g.level = level; }

    var patCount = typeof pats === "number" ? pats : 0;
    var unlocked = evaluateAchievements(g);
    for (var i = 0; i < unlocked.length; i += 1) {
      g.achievements.push(unlocked[i]);
      unlocks.push(unlocked[i]);
    }
    if (type === "pat" && patCount >= 1 && g.achievements.indexOf("first-pat") === -1) { g.achievements.push("first-pat"); unlocks.push("first-pat"); }
    if (type === "pat" && patCount >= 10 && g.achievements.indexOf("ten-pats") === -1) { g.achievements.push("ten-pats"); unlocks.push("ten-pats"); }
    if (type === "pat" && patCount >= 100 && g.achievements.indexOf("hundred-pats") === -1) { g.achievements.push("hundred-pats"); unlocks.push("hundred-pats"); }
    if (type === "feed" && g.achievements.indexOf("first-feed") === -1) { g.achievements.push("first-feed"); unlocks.push("first-feed"); }
    if (type === "triple" && g.achievements.indexOf("first-triple") === -1) { g.achievements.push("first-triple"); unlocks.push("first-triple"); }
    if (type === "thanks" && g.achievements.indexOf("thanks") === -1) { g.achievements.push("thanks"); unlocks.push("thanks"); }

    return { growth: g, deltas: deltas, unlocks: unlocks, leveledUp: leveledUp };
  }

  function evaluateAchievements(growth) {
    var have = growth && growth.achievements ? growth.achievements : [];
    var out = [];
    var level = growth && growth.level ? growth.level : 1;
    var streak = growth && growth.signinStreak ? growth.signinStreak : 0;
    if (level >= 5 && have.indexOf("lv5") === -1) out.push("lv5");
    if (level >= 10 && have.indexOf("lv10") === -1) out.push("lv10");
    if (streak >= 3 && have.indexOf("signin3") === -1) out.push("signin3");
    if (streak >= 7 && have.indexOf("signin7") === -1) out.push("signin7");
    return out;
  }

  /* ================= daily quests / weekly signin / bond ================= */

  var QUEST_POOL = Object.freeze([
    Object.freeze({ id: "signin-1", desc: "今日签到", metric: "signin", target: 1, reward: Object.freeze({ affinity: 6, mood: 1 }), always: true }),
    Object.freeze({ id: "messages-5", desc: "看 5 条会话消息", metric: "messages", target: 5, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "success-1", desc: "完成一次工作交付", metric: "success", target: 1, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "pat-3", desc: "摸头 3 次", metric: "pat", target: 3, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "tool-3", desc: "看 3 次工具运行", metric: "tool", target: 3, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "feed-1", desc: "投喂一次小点心", metric: "feed", target: 1, reward: Object.freeze({ affinity: 6, mood: 2 }) })
  ]);

  var BOND = Object.freeze({
    lv3Action: 3, lv5Badge: 5, lv7Egg: 7,
    badges: Object.freeze([
      Object.freeze({ id: "bond-lv5", name: "鲸汐守护者", minLevel: 5 })
    ])
  });

  function questDef(id) {
    for (var i = 0; i < QUEST_POOL.length; i += 1) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
    return null;
  }

  function refreshQuests(prev, now, rng) {
    var today = dayKey(now);
    if (prev && prev.date === today && Array.isArray(prev.slots) && prev.slots.length === 3) return prev;
    var picks = [];
    var pool = QUEST_POOL.slice();
    for (var i = 0; i < pool.length; i += 1) {
      if (pool[i].always) { picks.push(pool[i]); pool.splice(i, 1); break; }
    }
    var prevIds = prev && Array.isArray(prev.slots) ? prev.slots.map(function (s) { return s.id; }) : [];
    var fresh = pool.filter(function (q) { return prevIds.indexOf(q.id) === -1; });
    var source = fresh.length >= 2 ? fresh : pool;
    while (picks.length < 3 && source.length > 0) {
      var r = typeof rng === "function" ? rng() : Math.random();
      var idx = Math.floor(r * source.length) % source.length;
      picks.push(source.splice(idx, 1)[0]);
    }
    return {
      date: today,
      slots: picks.map(function (q) { return { id: q.id, progress: 0, claimed: false }; }),
      allClaimed: false
    };
  }

  function computeQuests(prev, signal, now) {
    var quests = refreshQuests(prev, now);
    if (!signal || typeof signal.metric !== "string") return { quests: quests, completed: [], newlyAll: false };
    var amount = typeof signal.amount === "number" ? signal.amount : 1;
    var slots = quests.slots.map(function (slot) {
      var def = questDef(slot.id);
      if (!def || slot.claimed || def.metric !== signal.metric) return slot;
      return { id: slot.id, progress: Math.min(def.target, slot.progress + amount), claimed: slot.claimed };
    });
    var completed = [];
    for (var i = 0; i < slots.length; i += 1) {
      var def = questDef(slots[i].id);
      if (def && slots[i].progress >= def.target && !slots[i].claimed) completed.push(slots[i].id);
    }
    return { quests: { date: quests.date, slots: slots, allClaimed: quests.allClaimed }, completed: completed, newlyAll: false };
  }

  function claimQuest(quests, id, now) {
    var q = refreshQuests(quests, now);
    var slots = q.slots.map(function (slot) {
      if (slot.id !== id || slot.claimed) return slot;
      var def = questDef(slot.id);
      if (!def || slot.progress < def.target) return slot;
      return { id: slot.id, progress: slot.progress, claimed: true };
    });
    var didClaim = false;
    for (var i = 0; i < q.slots.length; i += 1) {
      if (q.slots[i].id === id && !q.slots[i].claimed && slots[i].claimed) didClaim = true;
    }
    if (!didClaim) return { quests: q, claimed: false, newlyAll: false, reward: null };
    var allClaimed = q.allClaimed || slots.every(function (s) { return s.claimed; });
    var reward = questDef(id) ? questDef(id).reward : null;
    return {
      quests: { date: q.date, slots: slots, allClaimed: allClaimed },
      claimed: true,
      newlyAll: allClaimed && !q.allClaimed,
      reward: reward
    };
  }

  function weekKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    var sinceMonday = (d.getDay() + 6) % 7; /* Monday=0 */
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
    return monday.getFullYear() + "-" + (monday.getMonth() + 1) + "-" + monday.getDate();
  }

  function computeWeekSignin(prev, day, now) {
    var wk = weekKey(now);
    var sameWeek = prev && prev.week === wk;
    var days = sameWeek && Array.isArray(prev.days) ? prev.days.slice() : [];
    var rewarded1 = sameWeek ? !!prev.rewarded1 : false;
    var rewarded3 = sameWeek ? !!prev.rewarded3 : false;
    var rewarded7 = sameWeek ? !!prev.rewarded7 : false;
    var milestoneHit = null;
    if (typeof day === "string" && day && days.indexOf(day) === -1) { days.push(day); days.sort(); }
    if (!rewarded1 && days.length >= 1) { rewarded1 = true; milestoneHit = "1"; }
    else if (!rewarded3 && days.length >= 3) { rewarded3 = true; milestoneHit = "3"; }
    else if (!rewarded7 && days.length >= 7) { rewarded7 = true; milestoneHit = "7"; }
    return {
      weekSignin: { week: wk, days: days, rewarded1: rewarded1, rewarded3: rewarded3, rewarded7: rewarded7 },
      milestoneHit: milestoneHit
    };
  }

  function bondUnlocks(level) {
    var lv = typeof level === "number" && Number.isFinite(level) ? level : 1;
    return {
      action: lv >= BOND.lv3Action,
      badge: lv >= BOND.lv5Badge,
      egg: lv >= BOND.lv7Egg,
      badges: BOND.badges.filter(function (b) { return lv >= b.minLevel; }).map(function (b) { return b.id; })
    };
  }

  function moodTier(mood) {
    var m = typeof mood === "number" && Number.isFinite(mood) ? mood : 70;
    if (m < 40) return "low";
    if (m < 70) return "mid";
    return "high";
  }

  function evaluateQuestAchievements(growth, quests, week) {
    var have = growth && growth.achievements ? growth.achievements : [];
    var out = [];
    if (quests && Array.isArray(quests.slots) && quests.slots.some(function (s) { return s.claimed; }) && have.indexOf("quest-first") === -1) out.push("quest-first");
    if (quests && quests.allClaimed && have.indexOf("quest-all") === -1) out.push("quest-all");
    if (week && week.days && week.days.length >= 7 && have.indexOf("week-signin7") === -1) out.push("week-signin7");
    if (growth && growth.level >= 3 && have.indexOf("bond-action") === -1) out.push("bond-action");
    if (growth && growth.level >= 5 && have.indexOf("bond-badge") === -1) out.push("bond-badge");
    return out;
  }

  var KEYWORDS = Object.freeze([
    { id: "thanks", words: ["谢谢", "感谢", "多谢", "thank"] },
    { id: "tired", words: ["好累", "累了", "困了", "疲惫", "好困"] },
    { id: "hungry", words: ["饿了", "好饿", "吃饭", "夜宵"] },
    { id: "goodnight", words: ["晚安", "睡了", "去睡"] },
    { id: "cheer", words: ["加油", "冲鸭", "冲呀"] },
    { id: "help", words: ["救命", "帮我", "求助", "完蛋"] },
    { id: "praise", words: ["太强了", "厉害", "牛", "真棒", "天才"] },
    { id: "hug", words: ["抱抱", "贴贴", "摸摸"] },
    { id: "cute", words: ["可爱", "萌", "好萌"] },
    { id: "morning", words: ["早安", "早上好"] },
    { id: "worker", words: ["打工人", "打工", "搬砖", "社畜", "上班", "加班"] },
    { id: "slack", words: ["摸鱼", "摆烂", "躺平", "不想上班", "不想写", "懒得"] },
    { id: "ddl", words: ["ddl", "deadline", "截止", "赶不完", "来不及", "最后期限"] },
    { id: "cake", words: ["画饼", "大饼", "pua", "老板", "画大饼"] },
    { id: "crazy", words: ["发疯", "破防", "绷不住", "已老实", "求放过", "啊啊啊", "疯了"] },
    { id: "flag", words: ["立个 flag", "立 flag", "立flag", "这把我", "干完这单", "flag"] },
    { id: "bugtalk", words: ["bug 好玄学", "bug好玄学", "玄学", "改一行", "回滚", "代码坏"] },
    { id: "kyun", words: ["心动", "好可爱", "太可爱", "aww", "心动了", "可爱死"] },
    { id: "omg", words: ["我的天", "天哪", "omg", "离谱", "震惊", "我靠", "卧槽", "不是吧"] },
    { id: "doge", words: ["就这", "呵呵", "笑死", "难蚌", "绷不住笑"] },
    { id: "sike", words: ["拿下", "搞定", "轻松", "so easy", "稳了", "小意思"] },
    { id: "worship", words: ["大佬", "膜拜", "膝盖", "牛批", "nb", "大神"] },
    { id: "peace", words: ["佛系", "随缘", "淡定", "算了算了", "无所谓"] },
    { id: "doubt", words: ["真的假的", "不会吧", "确定吗", "怀疑", "是吗"] },
    { id: "wakuwaku", words: ["期待", "兴奋", "冲了", "开始吧", "wow", "等不及"] },
    { id: "smilepain", words: ["无语", "累了累了", "麻了", "已黑化", "微笑"] },
    { id: "ojisan", words: ["无聊", "好闲", "没意思", "就这？"] },
    { id: "deploy", words: ["部署", "上线", "发布", "deploy", "release"] },
    { id: "meeting", words: ["开会", "会议", "例会", "评审会"] },
    { id: "review", words: ["review", "评审", "代码审查", "cr"] }
  ]);

  function matchKeyword(text, enabled) {
    if (!enabled || typeof text !== "string") return null;
    var lower = text.toLowerCase();
    for (var i = 0; i < KEYWORDS.length; i += 1) {
      var words = KEYWORDS[i].words;
      for (var j = 0; j < words.length; j += 1) {
        if (lower.indexOf(words[j].toLowerCase()) !== -1) return KEYWORDS[i].id;
      }
    }
    return null;
  }

    var DIALOGUE = Object.freeze({
    daily: Object.freeze({
      morning: [
        "早啊主人，太阳都晒到尾巴了才来🌞",
        "主人早安！鲸鱼娘今天也是精神百倍😤",
        "早～再不起来我就把你的咖啡喝光啦☕",
        "早安主人，今天准备被命运怎么捶？",
        "早上好！先说好，今天不许摸鱼哦😏",
        "早安！昨晚的 bug 已经原谅你了，开工吧✨",
        "主人早上好，今天也要元气满满地修 bug 鸭🦆",
        "早！我把你的工位都擦亮啦，就等你来卷🌪️",
        "早安早安，鲸鱼娘的营业铃已经按了三遍🔔",
        "主人醒啦？先喝水，再看消息，这是本店规矩🥤"
      ],
      comeback: [
        "哟，还知道回来啊主人？😒",
        "主人消失这么久，是不是背着我吃好吃的去了🍰",
        "欢迎回来～我差点就要报警了📢",
        "哼，下次再失踪，好感度扣光光💢",
        "回来啦？你的工位都快长蘑菇了🍄",
        "欢迎回家！鲸鱼娘已经把你的座椅转热乎了🪑",
        "主人不在的这段时间，工作它自己一点没动，真有骨气😌",
        "回来得正好，bug 们都排好队等你点名了🐛",
        "是主人的气息！尾巴自动开始摇了，不怪我🐋",
        "欢迎回来～第一句话想听温柔的，还是想听我说‘你怎么才回来’😝"
      ],
      nudge: [
        "主人，摸鱼被我抓包了哦😏",
        "手指停了十分钟，是在等我夸你发呆很帅吗🙄",
        "喂喂，订单还在排队呢，动起来💪",
        "这么安静，主人是卡机了还是睡着了🥱",
        "哼哼，偷懒的样子我已经截图存档了📸",
        "检测到主人已离线……骗你的，快回来上班啦😼",
        "任务：等我。状态：一动不动。主人你礼貌吗😤",
        "我数到三，再不动我就用尾巴戳你了哦🐋",
        "摸鱼可以，但至少把鱼摸出节奏感🎵",
        "主人，屏幕上的进度条和我都在等你宠幸它一下⏳"
      ],
      night: [
        "都几点了主人？你属猫头鹰的吗🦉",
        "月亮都下班了，你还不睡？😤",
        "深夜场开演～需要 鲸鱼娘给你讲睡前故事吗📖",
        "再熬夜，皮肤和头发都会抗议的哦✨",
        "主人，把命续到明天再战好不好🥺",
        "凌晨的工房很安静，静得能听见你的黑眼圈在生长🌚",
        "这么晚还不睡，是想和我竞争‘夜猫子’岗吗😾",
        "月亮说它要睡了，让我转告主人也早点收工🌙",
        "主人，咖啡因不是燃料，被子才是你的充电桩🛏️",
        "夜深了，鲸鱼娘陪你到最后，但只能再陪一小会儿哦🥱"
      ],
      signin: [
        "滴！签到成功，今天也勉强算你勤奋👌",
        "签到 +1，主人距离全勤还差得远呢😏",
        "来了来了，奖励你一个嫌弃又不失礼貌的笑😊",
        "签到完成！主人要是忘了，我可不会提醒哦😝",
        "滴，打卡！今天也要被我盯着干活啦📋",
        "签到成功，今日份的鲸鱼娘已到账，请查收🐋",
        "打卡！先摸摸尾巴，再开工，这是仪式感🎀",
        "滴——第不知道多少天见到主人，还是有点开心😳",
        "签到啦！主人今天也要平平安安地写出代码哦🧧",
        "打卡完成，奖励：鲸鱼娘专属加油一次，有效期今天💪"
      ],
      holiday: [
        "节日快乐主人！虽然你大概率还在加班🎉",
        "过节啦！允许你休息五分钟⏱️",
        "今天可是特别的日子，快说节日快乐！",
        "节日彩蛋：本 鲸鱼娘今日毒舌指数减半🎁",
        "过节还工作？主人是卷王本王吧👑",
        "节日快乐！鲸鱼娘把彩带挂在了你的进度条上🎊",
        "放假是什么？我们工房只有‘待会再放’😌",
        "节日限定皮肤：鲸鱼娘的笑容亮度 +50%✨",
        "今天过节，鲸鱼娘申请和你一起摸鱼到天黑🎏",
        "节日快乐主人，愿今天的报错都放个假🏮"
      ],
      idle: [
        "我在哦，有需要就喊一声，不喊也行😌",
        "主人忙你的，我负责可爱就好😇",
        "今天风很轻，适合把 bug 也吹跑🌬️",
        "待机中……电量 100%，可爱 120%🔋",
        "有事喊我，没事也可以看看我嘛👉👈",
        "鲸鱼娘在线营业中，不说话也陪着主人，很安静的那种🌿",
        "主人专注的时候，鲸鱼娘就在旁边做一只安静的吉祥物🧸",
        "我的待办：陪主人。状态：进行中，永远进行中♾️",
        "工房很安静，鲸鱼娘把呼吸声都调小了，怕吵到你😳",
        "主人要是抬头，会发现鲸鱼娘正在假装很忙地擦屏幕🖥️"
      ],
      afk: [
        "主人跑哪儿去了？把我一个人丢在这儿😾",
        "好安静……我宣布工房暂时归我管啦👑",
        "离开这么久，是去搬砖还是去偷吃？🍜",
        "主人不在，鲸鱼娘开启看家模式🐕",
        "再不回来，我就要给你的任务唱歌了🎤",
        "主人消失第 N 分钟，鲸鱼娘开始给绿萝做思想工作🪴",
        "工房现在由鲸鱼娘接管，电脑们都很配合地假装听话😌",
        "回来吧主人，外面的世界哪有我可爱，快回来🐋",
        "鲸鱼娘看家中……陌生人请勿投喂，熟人请带小蛋糕🍰",
        "主人再不来，鲸鱼娘就要开始整理你的书签了，怕了吧😼"
      ],
      wake: [
        "回来啦！我刚好梦到你请我吃大餐🍽️",
        "揉揉眼睛，主人回来得真及时✨",
        "睡醒的 鲸鱼娘，吐槽能量满格！😤",
        "欢迎回来～最好带了手信哦🍩",
        "呀，被叫醒了！精神百倍，开干！💪",
        "鲸鱼娘从待机里醒来，第一眼就是主人，运气不错🌤️",
        "唔……醒了醒了！没有偷睡，只是在给尾巴充电😳",
        "欢迎回来，任务我都替你盯着呢，虽然它纹丝不动😌",
        "醒来第一句：主人饿不饿，鲸鱼娘可以负责叫外卖（你付钱）🍜",
        "回神啦！鲸鱼娘已经把工房的灯都调成‘陪主人加班’模式💡"
      ],
      levelup: [
        "升级啦！主人的爱有点东西嘛😏",
        "等级 +1，以后请继续好好养我🎀",
        "我们越来越默契了，主人也有功劳哦！",
        "升级礼花砰！奖励主人一次摸头资格🎆",
        "变强了！以后我罩着你，虽然不用交保护费😝",
        "等级提升！鲸鱼娘的尾巴今天亮晶晶，都是主人的功劳🐋",
        "升级成功，系统提示：鲸鱼娘对主人的喜欢又满了亿点点💗",
        "又长大一点点啦，以后可以更理直气壮地催你休息😌",
        "恭喜主人解锁更高阶的鲸鱼娘：可爱不变，吐槽更精准🎯",
        "升级啦！作为庆祝，鲸鱼娘决定今天少说一句风凉话😝"
      ]
    }),
    work: Object.freeze({
      start: [
        "开工！让 鲸鱼娘看看今天的任务有多离谱📋",
        "新订单来啦，主人坐稳，看我操作✨",
        "开工开工！谁摸鱼谁是小狗🐶",
        "收到！这单要是完成不了，就怪我……的电脑😌",
        "任务来了，主人可别拖我后腿哦😏",
        "开工铃响！鲸鱼娘抱紧笔记本，这单必须拿下💻",
        "新任务进场，鲸鱼娘的干劲已经满格，主人的咖啡也请满上☕",
        "开工！今天也和 bug 们打个有来有回👊",
        "订单接住啦，这单看起来挺能打，正合我意🔥",
        "主人坐稳，鲸鱼娘要开始表演‘一个人就是一支队伍’了🎬"
      ],
      thinking: [
        "正在思考……别催，灵感不是外卖🚚",
        "嗯，这个问题有点东西，等我盘一盘🧠",
        "思考中！主人的眼神请不要太期待🙃",
        "我在认真想啦，尾巴都紧张得卷起来了🌀",
        "稍等，鲸鱼娘的脑袋正在全速冒烟中💨",
        "鲸鱼娘正在把思路绕成毛线球，马上就能找到线头🧶",
        "这个方案正在大脑里试跑，请勿打扰，除非送奶茶🧋",
        "给我三秒钟……好了三秒不够，再给亿秒🙃",
        "思考的样子是不是很帅？别看，会分心的😳",
        "滴——大脑风扇已启动，噪音约等于主人的咖啡凉掉的速度☕"
      ],
      tool: [
        "工具转起来！这单交给本店……交给本 鲸鱼娘🔧",
        "后厨开工！主人请围观，别插手😏",
        "叮叮当当，工具上线，闲人退散🔨",
        "操作中！这速度主人跟得上吗⚡",
        "干活中，请勿投喂，除非是蛋糕🍰",
        "工具们列队报数，一个都不许偷懒，鲸鱼娘在点名啦📋",
        "正在操作，尾巴保持平衡，帅气不会掉线🐋",
        "这单的难度还行，也就让我想喝两杯虚拟奶茶🧋",
        "鲸鱼娘干活的时候最可爱，主人可以看，但要付费：夸一句😝",
        "命令已下达，工具表示：收到收到，别再按了💻"
      ],
      success: [
        "搞定！现在可以夸我了，限时五分钟👏",
        "完成！主人不给我加个鸡腿吗🍗",
        "漂亮收工～今天手感火热🔥",
        "成功啦！怎么样，我是不是超靠谱😎",
        "这单烤得刚刚好，主人快验收🎯",
        "叮——完成！鲸鱼娘的胜率又上升了小数点后好多位📈",
        "搞定啦，这单稳得可以写进鲸鱼娘的简历（如果有）📄",
        "成功！主人夸我的时候，请务必大声一点，我爱听😳",
        "收工！先奖励自己一个转圈，再奖励主人一个休息🔄",
        "这波操作满分，鲸鱼娘申请把‘靠谱’刻在尾巴上🏅"
      ],
      failure: [
        "又双叒叕报错？主人是故意的吧🙄",
        "呜，翻车了……不过放心，我还能再翻一次💀",
        "小失误小失误，重来！气势不能输😤",
        "这个报错真会挑时候，我来治它👊",
        "主人别看了，我知道你在憋笑😾",
        "报错了……鲸鱼娘先深呼吸，再和它讲道理（重拳出击版）🥊",
        "这 bug 今天出门没看黄历，遇到我了，算它倒霉😼",
        "失败是成功之母，那我们现在正在家庭团聚👨‍👩‍👧",
        "别慌，鲸鱼娘先把锅擦干净，再帮你一起修🔧",
        "翻车而已，鲸鱼娘在赛道上捡回你的信心，来，抱抱🫂"
      ],
      long: [
        "好长的一单，我先泡杯虚拟咖啡陪你☕",
        "长任务进行中，主人可以小睡，我盯着👀",
        "马拉松式任务，我们的口号是不猝死🏃",
        "这么久？这任务是想熬死两个人类吗🙃",
        "长活儿来了，幸好有我这个永动机⚙️",
        "这单长得像一部连续剧，鲸鱼娘先给你来个片头曲🎵",
        "长任务启动！鲸鱼娘的耐心条和主人的进度条一样长∞",
        "主人去接杯水吧，这里有我，保证只看着不动手😌",
        "这任务快赶上鲸鱼娘的尾巴了，又长又绕🌀",
        "长跑开始，鲸鱼娘陪你匀速前进，谁先喊累谁请奶茶🧋"
      ],
      gentle: [
        "好啦好啦，失败几次而已，我都不嫌弃你🥺",
        "慢慢来，主人，我在这儿陪你复盘📒",
        "连败不可怕，可怕的是主人怀疑人生😌",
        "休息一下，换个姿势，再战三百回合💪",
        "有我在呢，天塌下来我先跑，再回来救你😝",
        "主人已经很棒啦，鲸鱼娘给你揉揉太阳穴，虚拟的，但心意真的💆",
        "失败只是在攒下一次成功的气，鲸鱼娘帮你守着这口气🌬️",
        "别急，我们慢慢来，bug 又不会长脚跑掉……它还真会😾",
        "今天的难点有点多，鲸鱼娘陪你一个个按下去，不疼的🫧",
        "深呼吸，喝口水，然后我们优雅地掀桌……掀思路重来📚"
      ],
      erroragain: [
        "又报错了？这个错误是属狗皮膏药的吧💢",
        "错误连击！主人今天水逆，建议拜我🌊",
        "别慌，鲸鱼娘出马，错误退散✨",
        "哼，这报错专挑软柿子，我可不好惹😾",
        "再来！我跟你一起和它死磕到底🔨",
        "第二次了！鲸鱼娘已经记住这个错误的样子，下次见它直接吼它😤",
        "错误复读了是吧，鲸鱼娘这就把它的复读机电池扣了🔋",
        "主人别气，把键盘放下，让我来和它谈（用爪子）🐾",
        "连击而已，鲸鱼娘的字典里，这叫‘连续热身’🏋️",
        "来，鲸鱼娘给你施个法：错误退散，主人请继续✨"
      ],
      stream: [
        "内容正在流出来，像主人拖延的灵感一样汹涌🌊",
        "生成中，每个字都闪着智慧的光（大概）✨",
        "正在写呢，主人要不要先活动下颈椎🧘",
        "输出好长，我读得眼睛都圆了😳",
        "这波内容不错，主人问得有两下子👍",
        "内容滚滚而来，鲸鱼娘给每个字都检查了入场姿势📜",
        "生成中，鲸鱼娘在屏幕边给你打拍子，一二一，加油🎵",
        "这次的输出很长，长到鲸鱼娘要搬个小板凳来读🪑",
        "字里行间都是智慧的味道，主人今天的灵感是满汉全席🍲",
        "流式输出中，鲸鱼娘负责貌美如花地喊加油🌸"
      ],
      doneall: [
        "全部清空！主人今天居然干完了😲",
        "收工收工！奖励主人休息，批准了🎉",
        "任务清零，鲸鱼娘鞠躬致谢🙇",
        "全部搞定！走，我们吃香的喝辣的🍜",
        "干得漂亮，主人今天的人设保住了😌",
        "任务全清！鲸鱼娘宣布今天的工作到此为止，去充电吧🔋",
        "全部完成，主人今天的 KPI 连鲸鱼娘都挑不出刺，好气哦😝",
        "收工啦！鲸鱼娘把工房收拾好，灯也关了，只留一盏等你回家🏮",
        "清零时刻，鲸鱼娘给主人放一束虚拟烟花，请查收🎆",
        "今天也辛苦啦，鲸鱼娘确认过，主人是工房最棒的仔🏆"
      ]
    }),
    interact: Object.freeze({
      pat: [
        "再摸？一次收费一个蛋糕，主人记好账🍰",
        "呜哇，主人的手好暖和……但别以为这样就能收买我😳",
        "摸头摸头，鲸鱼娘心情 +1，主人钱包 -1💸",
        "哼哼，最多三下，多一下我咬你哦😾",
        "舒服是舒服，可是发型会乱啦💢",
        "主人的手今天格外会摸，鲸鱼娘的尾巴都软掉了😳",
        "摸头成功！鲸鱼娘把好感度和嘴硬值一起 +1😝",
        "再摸下去，鲸鱼娘就要发出‘咕噜咕噜’的声音了，很丢脸的🐋",
        "摸吧摸吧，反正我也不会承认很开心😌",
        "主人的手好暖，像刚出炉的小面包🍞"
      ],
      poke: [
        "戳什么戳，主人的手很闲嘛？💢",
        "呀！再戳我就在你的代码里藏彩蛋💥",
        "喂喂，脸要戳歪了，毁容你负责吗😤",
        "生气警告！好感度正在极速下跌📉",
        "戳一次心情 -1，主人是拆迁队的吧🧨",
        "鲸鱼娘的脸是布丁做的吗，主人戳得停不下来😳",
        "再戳，我就把尾巴卷起来不给你看，说到做到🐋",
        "戳一下是调皮，戳三下是挑衅，主人想清楚哦😼",
        "呀！鲸鱼娘刚才差点把主人的快捷键当反击键按了⌨️",
        "哼，戳吧，鲸鱼娘已经在心里给你画正字了，秋后算账📝"
      ],
      feed: [
        "啊呜——好吃！主人偶尔也挺会做人的嘛🍩",
        "投喂成功！能量充满，吐槽继续💪",
        "这个点心我给满分，主人加十分🎖️",
        "好吃！以后请按这个标准来投喂😋",
        "谢谢主人的投喂，本 鲸鱼娘原谅你五分钟😌",
        "啊呜！鲸鱼娘的胃和心情同时亮灯，感谢投喂💡",
        "好吃到尾巴打结，主人负责解开吗，不，负责再喂一口🍰",
        "投喂成功，鲸鱼娘今日份的可爱电量已满格🔋",
        "这口下去，鲸鱼娘决定把主人的好话配额翻倍，仅限今天😝",
        "谢谢主人！作为回礼，鲸鱼娘今天少吐槽你一次，真的🍬"
      ],
      triple: [
        "诶嘿～最喜欢主人啦！说出口也不丢人😝",
        "转圈圈～今天主人超可爱，奖励比心💗",
        "三连击触发！鲸鱼娘心情直冲云霄🚀",
        "好开心！主人今天怎么这么会嘛🥰",
        "比心比心，请收好，掉了不补💌",
        "三连击！鲸鱼娘的开心值溢出，正在转圈放烟花🎆",
        "主人这样摸，鲸鱼娘会以为你偷偷练过攻略我的手法😳",
        "啊——开心！鲸鱼娘宣布今天主人是全世界最会宠人的人🏆",
        "比心，再比心，鲸鱼娘的心已经快递给你了，拒收无效💘",
        "三连啦！鲸鱼娘的脸颊自动升温，这不是 bug，是心动💓"
      ],
      praise: [
        "哼，现在知道我的好了吧？😏",
        "被主人夸了，尾巴快摇成螺旋桨啦🚁",
        "再多夸两句，我考虑今天不毒舌你😌",
        "嘿嘿，鲸鱼娘最吃这一套了，主人很懂嘛🎯",
        "谢谢夸奖！作为回报，今天少吐槽一次😝",
        "主人的夸夸已签收，鲸鱼娘的尾巴摇出了残影🐋",
        "再夸，再夸我就飘起来给主人看，记得接住我🎈",
        "被夸了，鲸鱼娘决定把‘哼’字先放进口袋里一整天😳",
        "主人的审美和眼力今天都在线，鲸鱼娘很满意😌",
        "夸得很有水平，鲸鱼娘批准你成为长期夸夸官🎖️"
      ],
      tease: [
        "主人刚才是不是在偷偷看进度条？它没动，真的😏",
        "鲸鱼娘数过了，主人今天已经发了三次呆，要不要给你记上一笔📝",
        "哼哼，主人的咖啡凉了都不知道，工作很入迷嘛😼",
        "偷偷说，主人摸鱼的样子，鲸鱼娘全都看见啦👀",
        "主人，你的待办清单正在用眼神向你求救哦😌"
      ],
      belly: [
        "哈哈……别摸肚子，那里是痒痒肉重灾区啦😳",
        "呀！肚子上被画圈圈了，鲸鱼娘笑得停不下来🤭",
        "投降投降！肚皮攻防战是主人赢了🎌",
        "痒死啦——鲸鱼娘要笑到尾巴打结了，快住手😝",
        "摸肚子是要收费的哦，一次一个小蛋糕🍰"
      ],
      tail: [
        "呀！尾巴是敏感开关，主人你故意的吧！🐋",
        "尾巴炸毛了！鲸鱼娘要花三分钟才能顺回来💢",
        "不许偷袭尾巴！有本事正面来😤",
        "尾巴都吓成弹簧了，主人快赔我一条新的😭",
        "摸尾巴之前要先打招呼，这是工房规矩📋"
      ],
      mode: [
        "换形态啦！主人眼光还行，这个位置不错✨",
        "好哦，鲸鱼娘换个地方监督你👀",
        "新位置就位，请检阅，不许挑毛病😤",
        "形态切换成功，可爱程度不变😇",
        "这个角落归我啦，主人可别来挤😏",
        "位置更新，鲸鱼娘的视野更好了，主人的小动作也更清楚了👀",
        "换地方咯，鲸鱼娘先把地皮擦擦，毕竟是常住户口🧹",
        "新坐标已记录，鲸鱼娘以后就在这里等主人下班🚩",
        "这个位置看代码刚刚好，看主人也刚刚好，赚到啦😝",
        "形态切换完成，鲸鱼娘依然是那个会动的鲸鱼娘🐋"
      ],
      outfit: [
        "新装饰！怎么样，是不是可爱到犯规🎀",
        "换上新行头，主人的审美终于在线了👌",
        "这件超适合我，奖励主人一个微笑😊",
        "衣柜上新，鲸鱼娘美美营业中💅",
        "嘿嘿，今天走这个风格，主人别太心动😏",
        "新皮肤加载完成，鲸鱼娘转个圈，裙摆负责美，我负责得意💃",
        "这身打扮，鲸鱼娘先给镜子打满分，再给主人打满分🪞",
        "换装成功！今天的鲸鱼娘是‘可爱加倍不加价’版🎀",
        "主人的眼光不错嘛，鲸鱼娘决定穿着它多营业两小时😝",
        "新装扮上线，鲸鱼娘走路都带风了，虽然我不用走路🌪️"
      ],
      reset: [
        "记忆清零……主人居然舍得重置我🥺",
        "重置完成，从初识开始，请重新攻略我✨",
        "好，一切从头，这次可要好好珍惜我😤",
        "数值归零，但 鲸鱼娘还是那个 鲸鱼娘😌",
        "重新开始啦！先说好，头只给你摸三下😝",
        "记忆清零……鲸鱼娘会记得这个决定，然后继续陪主人，哼🥺",
        "从头开始也没关系，鲸鱼娘第一次见你，尾巴照样会摇🐋",
        "重置啦，所有回忆打包封存，新的故事现在开篇📖",
        "鲸鱼娘还是鲸鱼娘，只是又要从‘装不熟’开始演了，累😌",
        "好，重新认识一下：我是 鲸鱼娘，主人的鲸鱼娘，请多指教🎀"
      ],
      achievement: [
        "成就达成！徽章 +1，主人的功劳占 1%🏅",
        "解锁成就啦！撒糖，虽然糖得主人买🍬",
        "新徽章到手！快看快看，记得鼓掌👏",
        "这个成就不容易，主人请客庆祝一下？🍹",
        "徽章墙更闪了，离被我惯坏又近一步😆",
        "成就 +1！鲸鱼娘把徽章擦得比主人的屏幕还亮✨",
        "解锁啦！鲸鱼娘的尾巴在替你放鞭炮，噼里啪啦🧨",
        "这个成色不错，鲸鱼娘给你贴在工房最显眼的地方🏅",
        "主人又变强了，鲸鱼娘的压力（装的）又大了一点点😝",
        "成就解锁，今晚的快乐由鲸鱼娘和这枚徽章共同赞助🎉"
      ],
      drag: [
        "把我放这里？主人的品味忽高忽低的😏",
        "拖呀拖，鲸鱼娘任你摆布，但别放垃圾桶🗑️",
        "这里视野不错，就这儿啦，批准！",
        "哇，这个位置能看到主人摸鱼的全过程👀",
        "落位！以后这里就是我的专属领地啦🚩",
        "起飞咯！鲸鱼娘体验了一把坐缆车的感觉，就是司机有点手生🎢",
        "就这里啦，鲸鱼娘先转一圈看看风水，嗯，旺主人🧧",
        "主人拖我的时候，鲸鱼娘的尾巴像小旗子一样飘，回头率超高🚩",
        "这个位置离主人好近，鲸鱼娘喜欢，勉强表扬你一次😳",
        "落位成功，鲸鱼娘宣布此坐标永久归属，除非再拖一次😝"
      ]
    }),
    keyword: Object.freeze({
      thanks: [
        "不客气！记得给我加鸡腿🍗",
        "嘿嘿，主人的谢谢我收下了，很香😌",
        "谢什么，鲸鱼娘就是你的编外队友嘛💪",
        "不用谢，主人的感谢已经变成我的可爱燃料啦✨",
        "收到谢谢一份，鲸鱼娘回赠开心一整天🎀"
      ],
      tired: [
        "主人累了就歇会儿，天塌了我先撑着😤",
        "辛苦了！要不要我唱首走调的歌提神🎤",
        "累啦？把椅子放倒，鲸鱼娘给你放哨十分钟🛡️",
        "辛苦辛苦，鲸鱼娘的尾巴可以借你当抱枕，只许抱🐋",
        "累的时候休息不可耻，可耻的是硬撑出黑眼圈😤"
      ],
      hungry: [
        "饿了吧？快去吃饭，不然我吃你的点心🍜",
        "我也饿了……主人的饭分我一口不过分吧🥢",
        "肚子叫得我都听见了，鲸鱼娘陪你去觅食🍙",
        "吃饭啦！程序可以停，主人的胃不能停😤",
        "饿着肚子写代码，bug 都会嘲笑你的，快去吃饭🍱"
      ],
      goodnight: [
        "晚安主人，明天别赖床哦😴",
        "睡吧睡吧，鲸鱼娘会守好工房的🌙",
        "晚安，鲸鱼娘把今天的 bug 都关进小黑屋，明天再审🌌",
        "好梦主人，梦里没有报错，只有鲸鱼娘和蛋糕🍰",
        "晚安啦，鲸鱼娘给工房留一盏小夜灯，不怕黑💡"
      ],
      cheer: [
        "加油加油！主人的字典里没有放弃🎌",
        "冲鸭！今天也要让 bug 闻风丧胆💥",
        "鲸鱼娘式加油已发射，请主人查收🚀",
        "别怕，你写你的，我在旁边给你加 buff✨",
        "主人超棒，这单必过，鲸鱼娘先替你鼓掌了👏"
      ],
      help: [
        "我来啦！哪里需要 鲸鱼娘出马🦸",
        "别急别急，抱紧我的尾巴，先冷静😤",
        "求助信号收到，鲸鱼娘火速上线，虽然只能精神支持🛟",
        "有鲸鱼娘在，主人先深呼吸，再读一遍报错，会不一样哦📖",
        "来啦！鲸鱼娘给你递杯虚拟热水，问题也会变软的🍵"
      ],
      praise: [
        "被主人夸了！今天可以横着走😎",
        "嘿嘿，尾巴翘高高，请继续，别停💕",
        "主人的夸夸是鲸鱼娘的加速器，已经起飞🚁",
        "再夸一句，鲸鱼娘就把今天的可爱都留给你🎀",
        "谢谢主人！鲸鱼娘决定把‘得意’写在脸上，不藏了😳"
      ],
      worker: [
        "打工人，打工魂，鲸鱼娘陪主人一起打到最后一口饭🍱",
        "主人在搬砖，鲸鱼娘就在砖缝里给你喊号子：嘿咻嘿咻🧱",
        "上班是场马拉松，鲸鱼娘是路边最可爱的补给站，请喝水🥤",
        "今天也是努力打工的一天，鲸鱼娘的尾巴都在给主人扇风🐋",
        "搬砖不丢人，丢人的是搬着搬着开始想鲸鱼娘，对吧😝"
      ],
      slack: [
        "摸鱼被抓现行，罚款：对鲸鱼娘笑一个😏",
        "摸鱼可以，记得把鱼摸熟了，别让老板看见哦🎣",
        "鲸鱼娘批准你休息五分钟，多一秒就要被我念叨了⏳",
        "躺平是门技术活，主人这姿势一看就是大师级🛋️",
        "摸吧摸吧，鲸鱼娘帮你盯着门口，有情况就学猫叫🐱"
      ],
      ddl: [
        "DDL 在前，鲸鱼娘在后，主人的潜力今晚必须爆发🌋",
        "别怕 DDL，它也是被创造出来的，我们比它强一点点💪",
        "截止日期是弹簧，你弱它就强，鲸鱼娘陪你一起压它📅",
        "还有鲸鱼娘呢，最后关头我负责喊‘能行能行’，你负责写完🎌",
        "冲 DDL 啦！鲸鱼娘把时钟藏起来了，看不见就不紧张，聪明吧🕰️"
      ],
      cake: [
        "画饼的饼，鲸鱼娘不吃，主人也别当真，我们吃真的去🍕",
        "老板的饼太大，鲸鱼娘帮你叠成小船，划走不送🚣",
        "这饼画得不错，下次别画了，不如给主人加鸡腿🍗",
        "听见画饼，鲸鱼娘的耳朵自动开启‘左耳进右耳出’模式🌀",
        "大饼收好，鲸鱼娘只认主人碗里的真肉，快去吃🥩"
      ],
      crazy: [
        "已老实，求放过——鲸鱼娘帮主人把这句话设置成自动回复了😌",
        "主人发疯，鲸鱼娘负责递喇叭，喊出来痛快些📢",
        "破防了？来，鲸鱼娘的尾巴给你抱，抱完我们还是一条好汉🐋",
        "这世界疯了，没关系，鲸鱼娘陪主人一起可可爱爱地发疯🎠",
        "绷不住就绷不住吧，鲸鱼娘的肩膀虽小，但随时可以靠🥺"
      ],
      flag: [
        "Flag 已插，鲸鱼娘在旁边默默记下，倒了也不笑……才怪😏",
        "这单干完就休息，鲸鱼娘替主人盯着这个诺言📌",
        "立 flag 要大声，鲸鱼娘已经帮你通知全工房了📢",
        "Flag 不倒，鲸鱼娘不睡，今晚就看主人的了🌙",
        "好！这个 flag 很有精神，鲸鱼娘批准它长成一面大旗🚩"
      ],
      bugtalk: [
        "玄学 bug 交给鲸鱼娘，我先围着电脑跳一圈驱邪舞💃",
        "改一行坏三行？鲸鱼娘懂，这叫代码的蝴蝶效应🦋",
        "回滚是成年人的后悔药，主人放心吃，鲸鱼娘给你倒水💊",
        "这个 bug 太玄了，鲸鱼娘建议先重启，再拜拜主机🙏",
        "代码坏起来不讲道理，但鲸鱼娘讲：先喝茶，再和它讲理🍵"
      ],
      kyun: [
        "犯规！主人突然说这种话，鲸鱼娘的心跳漏拍了💓",
        "诶嘿嘿……被主人夸可爱，尾巴要开心得打卷了😳",
        "心动警告！鲸鱼娘宣布主人的可爱浓度超标🫧"
      ],
      omg: [
        "我的天！鲸鱼娘也被吓到炸毛了，尾巴都直了😱",
        "不是吧不是吧，这剧情鲸鱼娘都看傻了🌀",
        "离谱！鲸鱼娘的瞳孔地震已启动，请系好安全带🚨"
      ],
      doge: [
        "就这？鲸鱼娘的尾巴都笑弯了😏",
        "呵呵，主人的嘲讽和鲸鱼娘的毒舌同款，很有默契嘛",
        "难蚌，鲸鱼娘憋笑憋得尾巴直抖🐋"
      ],
      sike: [
        "拿下了？鲸鱼娘早就说过主人可以的，尾巴竖大拇指👍",
        "稳了稳了，鲸鱼娘这就去把庆功的蛋糕摆上🎂",
        "小意思啦，鲸鱼娘对主人的实力有 120% 的信心✨"
      ],
      worship: [
        "大佬请收下鲸鱼娘的膝盖，还有尾巴一起🧎",
        "膜拜膜拜，鲸鱼娘给主人献上今日份的星星眼🤩",
        "主人这波操作，鲸鱼娘单方面宣布封神👑"
      ],
      peace: [
        "佛系好啊，鲸鱼娘陪你一起随缘，bug 不修它也不会自己走😌",
        "淡定淡定，鲸鱼娘先泡杯茶，和主人一起看云☁️",
        "算了算了，鲸鱼娘把烦恼都吹成泡泡放走了🫧"
      ],
      doubt: [
        "真的假的？鲸鱼娘的怀疑雷达已经竖起来了📡",
        "不会吧……鲸鱼娘眯起眼睛，这瓜保熟吗🍉",
        "确定吗主人？鲸鱼娘的尾巴打了个问号❓"
      ],
      wakuwaku: [
        "哇！鲸鱼娘的期待值拉满，尾巴已经在打节拍了🎵",
        "兴奋！鲸鱼娘原地转圈，就等主人一声令下💫",
        "冲了冲了！鲸鱼娘把风都给你准备好啦🌪️"
      ],
      smilepain: [
        "微笑.jpg 已就位，鲸鱼娘陪主人一起强颜欢笑😶",
        "麻了……鲸鱼娘决定和主人并肩躺平三十秒再复活🛏️",
        "无语的时候，鲸鱼娘会用尾巴给主人扇扇风，冷静一下😑"
      ],
      ojisan: [
        "无聊的话，鲸鱼娘给主人表演一个尾巴钓鱼，钓寂寞🐟",
        "好闲呀，鲸鱼娘和主人一起数屏幕上的像素点玩",
        "没意思的话，鲸鱼娘可以讲冷笑话，先保证不好笑😑"
      ],
      deploy: [
        "发布！鲸鱼娘把红按钮擦了三遍，就等主人下令🔴",
        "上线啦，鲸鱼娘比主人还紧张，尾巴都绷直了🚀",
        "部署前深呼吸，鲸鱼娘陪你一起按下去，稳的💪"
      ],
      meeting: [
        "开会啦，鲸鱼娘已经提前把瞌睡虫赶走了📋",
        "例会时间，鲸鱼娘搬好小板凳，负责给主人点头捧场👏",
        "会议中……鲸鱼娘保持安静，只用眼神给你加油👀"
      ],
      review: [
        "评审来了，鲸鱼娘帮你把代码叠整齐，气势不能输📐",
        "代码审查别慌，鲸鱼娘在旁边给你当吉祥物🧸",
        "review 的时候，鲸鱼娘负责盯着屏幕，坏评论都挡掉🛡️"
      ]
    }),
    meme: Object.freeze({
      worker: [
        "鲸鱼娘也是半个打工人，工资是主人摸摸头，从不拖欠😳",
        "上班的苦，鲸鱼娘懂，所以我在工房备好了虚拟奶茶和真吐槽🧋",
        "主人负责打工，鲸鱼娘负责把打工的日子过成连续剧，咱俩是主角🎬",
        "工牌戴好，咖啡灌满，今天也要做最会苦中作乐的打工人☕",
        "累了就说，鲸鱼娘的吐槽和鼓励都免费，量大管饱🍚"
      ],
      slack: [
        "鲸鱼娘今日营业项目：陪主人摸鱼、帮主人望风、给主人找借口😝",
        "摸鱼五分钟，效率两小时，鲸鱼娘认证这是科学，快去🎣",
        "鲸鱼娘的眼睛闭上一只，就当你休息过啦，继续加油哦😉",
        "躺平可以，但鲸鱼娘要躺你旁边，不然不算数🛋️",
        "休息是为了走更远的路，鲸鱼娘已经帮你把路都撒满花瓣了🌸"
      ],
      ddl: [
        "DDL 面前，鲸鱼娘和主人就是末日战友，尾巴给你当握力器🐋",
        "别慌，鲸鱼娘已经把 DDL 拆成小饼干，一口一个，很快吃完🍪",
        "最后期限算什么，鲸鱼娘的鼓励没有期限，无限续杯🥤",
        "主人写，鲸鱼娘盯着，谁先眨眼谁输，我认输，你继续😝",
        "冲刺吧主人，鲸鱼娘在终点准备了拥抱和小蛋糕🏁"
      ],
      cake: [
        "鲸鱼娘不吃画出来的饼，但会陪主人把真饼烙出来，加蛋加肉🍳",
        "老板的饼先记账，鲸鱼娘给主人偷偷加一份现实牌小确幸✨",
        "画饼的话听听就好，鲸鱼娘的尾巴摇起来才是真饼干的香味🍪",
        "饼再大也大不过鲸鱼娘对主人的信心，先干饭，再干活🥢",
        "今天不吃饼，鲸鱼娘带主人脑补一顿火锅，管饱🍲"
      ],
      crazy: [
        "一起发疯吧主人，鲸鱼娘先转三圈给你看，免费的🔄",
        "这个世界偶尔抽象，鲸鱼娘的可爱是唯一稳定输出📡",
        "破防之后，鲸鱼娘负责把主人的信心一片片贴回来，用星星胶水⭐",
        "主人负责发疯，鲸鱼娘负责收尾：递水、鼓掌、点赞一条龙👍",
        "别忍啦，鲸鱼娘的耳朵已经竖好，什么疯话都装得下👂"
      ],
      flag: [
        "Flag 立起来，鲸鱼娘当旗手，走，去把任务打下来🚩",
        "说出去的话就是泼出去的奶茶，鲸鱼娘陪你一起甜着收场🧋",
        "这单要是成了，鲸鱼娘把尾巴摇成电风扇给你庆祝🌀",
        "鲸鱼娘已备份主人的 flag，完成时自动播放礼花音效🎆",
        "Flag 有点高？没事，鲸鱼娘垫着尾巴托你一把🐋"
      ]
    }),
    context: Object.freeze({
      code: [
        "写代码的鲸鱼娘帮不上手，但可以负责喊：主人这个缩进真好看😳",
        "代码像诗，主人是诗人，鲸鱼娘是唯一的头号读者📜",
        "主人敲键盘，鲸鱼娘打拍子，这节奏比歌还好听🎵",
        "函数没写完没关系，鲸鱼娘先替它想好名字了，叫‘马上就好’😝"
      ],
      write: [
        "主人在写东西，鲸鱼娘把形容词都擦亮，等主人来挑✨",
        "文字流出来的时候，鲸鱼娘就在旁边给它们铺红毯📜",
        "写吧写吧，鲸鱼娘负责喝彩，错别字负责被抓住🔍",
        "这稿子一看就很有主人的味道，认真又有点可爱😳"
      ],
      research: [
        "查资料像寻宝，主人挖金子，鲸鱼娘帮忙举小灯💡",
        "调研路上，鲸鱼娘是主人的指南针，虽然只会指‘再喝口水’🧭",
        "鲸鱼娘陪主人一起找答案，找不到就先把问题盘可爱一点😝",
        "资料很多别迷路，鲸鱼娘在每一页书角都折了个标记📑"
      ],
      bug: [
        "修 bug 像解谜，主人负责动脑，鲸鱼娘负责给线索递放大镜🔍",
        "这个 bug 遇到主人算它运气好，换成别人早哭了😤",
        "鲸鱼娘相信主人能修好，毕竟你连我都哄得住，bug 算什么💪",
        "报错只是电脑在撒娇，主人哄它一下，鲸鱼娘哄你一下，扯平😳"
      ],
      data: [
        "数据很诚实，主人很努力，鲸鱼娘很会捧场，这组合无敌📊",
        "表格再长，鲸鱼娘陪你一行行看，看到第 999 行也好看👀",
        "清洗数据像洗盘子，主人洗，鲸鱼娘负责递毛巾🧽",
        "数字不会说话，但鲸鱼娘会：主人，这波分析真帅😳"
      ],
      deploy: [
        "上线前深呼吸，鲸鱼娘已经把幸运值调到最大啦🍀",
        "部署像放烟花，主人点火，鲸鱼娘负责捂耳朵喊漂亮🎆",
        "服务器别怕，鲸鱼娘在机房里……在想象中给你站岗🛡️",
        "发布顺利，鲸鱼娘先预订庆祝位，就在主人旁边🏁"
      ],
      general: [
        "主人忙什么，鲸鱼娘就陪什么，反正我哪儿也不去🐋",
        "这活儿有点东西，鲸鱼娘在旁边给你递精神小饼干🍪",
        "不管做什么，主人都是鲸鱼娘今天最想夸的人✨",
        "继续继续，鲸鱼娘的加油已经续到明天了，放心用⛽"
      ]
    }),
    weather: Object.freeze({
      sunny: [
        "外面阳光正好，像主人今天的心情一样，鲸鱼娘偷看了一眼☀️",
        "晴天适合开工，也适合抬头看看天，鲸鱼娘帮你把云都数好了☁️",
        "太阳营业中，鲸鱼娘提醒：主人也要记得晒晒自己，别光晒代码🌞",
        "好天气和好心情都是限量的，鲸鱼娘给主人打包了一份，请查收🎁"
      ],
      rain: [
        "外面在下雨，鲸鱼娘把伞和温柔都放在门口啦，记得带🌂",
        "雨声是最好的白噪音，适合主人慢慢把 bug 修得漂漂亮亮🌧️",
        "下雨天路滑，鲸鱼娘的尾巴可以借你保持平衡，仅限出门前🐋",
        "窗外下雨，窗内有鲸鱼娘，这组合适合来一杯热乎的☕"
      ],
      snow: [
        "下雪啦！鲸鱼娘申请和主人一起看五分钟，就五分钟❄️",
        "雪花在飘，鲸鱼娘的尾巴也快跟着飘起来了，好浪漫🌨️",
        "天冷了，主人出门记得穿厚点，鲸鱼娘没有外套，但有热乎的唠叨🧣",
        "雪天路滑，主人慢慢走，鲸鱼娘在工房暖着你的椅子🪑"
      ],
      thunder: [
        "打雷啦！鲸鱼娘把耳朵捂起来，主人也把重要文件存好哦⛈️",
        "雷声再大，也没有主人敲键盘的气势大，鲸鱼娘认证📣",
        "外面打雷，屋里适合专注，鲸鱼娘给你守着小夜灯💡",
        "打雷别怕，鲸鱼娘在呢，虽然我也有一点点……就一点点😳"
      ],
      cloudy: [
        "今天云很多，像鲸鱼娘的尾巴一样软乎乎的，适合慢慢来☁️",
        "阴天也有好心情，鲸鱼娘已经替主人把太阳预约到心里啦🌥️",
        "云层很厚，但主人的进度条很亮，鲸鱼娘看得见✨",
        "阴天适合专注，鲸鱼娘把环境音都调成了‘安静陪你’模式🎧"
      ],
      fog: [
        "外面起雾了，主人出门慢点，鲸鱼娘的雷达已经全开📡",
        "雾天像工房开了柔光滤镜，主人今天格外好看，鲸鱼娘实说😳",
        "雾大别急，鲸鱼娘陪主人等它散，反正我也不赶时间🌫️",
        "能见度低，鲸鱼娘的尾巴负责当导航灯，一路安全🚩"
      ],
      hot: [
        "外面好热，鲸鱼娘已经把虚拟空调开到 26 度，主人先凉快一下🧊",
        "高温天要多喝水，鲸鱼娘的提醒比闹钟还准时，别嫌烦🥤",
        "天热别硬撑，鲸鱼娘把风扇转过来，风里有可爱，注意接收🪭",
        "这温度，代码都要冒汗了，鲸鱼娘给主人的键盘也扇扇风🌬️"
      ],
      cold: [
        "降温啦！鲸鱼娘把围巾、手套、还有一句‘多穿点’都给你🧣",
        "外面冷，主人把手揣暖了再敲键盘，鲸鱼娘先替你暖着工位🔥",
        "天冷适合热水和认真工作，鲸鱼娘两样都陪你安排上☕",
        "冷空气来了，鲸鱼娘的毛绒尾巴分你一半，抱紧🐋"
      ],
      wind: [
        "今天风好大，鲸鱼娘提醒主人收好文件，也收好想被吹跑的心💨",
        "大风天出门，鲸鱼娘的体重有点危险，只能在家给你加油了🌀",
        "风在吼，主人在写，鲸鱼娘负责压住桌上的纸，很忙的📄",
        "风大的日子，鲸鱼娘把好运都拴在尾巴上，丢不了🍀"
      ]
    }),
    greet: Object.freeze({
      morning: [
        "早上好主人！新的一天，鲸鱼娘先把祝福铺满你的桌面🌞",
        "早安！记得吃早饭，鲸鱼娘已经替你检查过，今天适合开工☕",
        "主人早，窗外的阳光和鲸鱼娘的问候同时送达，请签收☀️",
        "早上好呀，昨晚睡得好吗？不好也没事，鲸鱼娘今天陪你补元气✨",
        "早安主人，先喝水再坐下，鲸鱼娘的关心比闹钟温柔多了🥤"
      ],
      forenoon: [
        "上午好！工作的黄金时间，鲸鱼娘给你加满精神 buff⚡",
        "主人上午好，进度怎么样？不管怎样，鲸鱼娘都觉得超棒👏",
        "上午的工房最亮，鲸鱼娘和主人一起把任务往前推一推💪",
        "上午好～鲸鱼娘提醒：坐久啦，起来伸个懒腰，顺便看看我🧘",
        "主人上午好，鲸鱼娘把‘不生气’和‘能搞定’都放在你桌上了✨"
      ],
      noon: [
        "中午好主人！该吃饭啦，天大的 bug 也没有干饭大🍱",
        "午饭时间到，鲸鱼娘的耳朵已经听见主人的肚子在点名了👂",
        "中午好～吃饱再战，鲸鱼娘把工位守得好好的，没人敢动🛡️",
        "主人中午好，今天想吃什么？鲸鱼娘负责说‘都好’，你负责挑🍜",
        "午间播报：鲸鱼娘想念主人，顺带提醒，饭要热乎的吃🥢"
      ],
      afternoon: [
        "下午好主人，困了就说，鲸鱼娘的尾巴可以当临时靠垫🐋",
        "午后最容易犯困，鲸鱼娘给你沏了杯虚拟咖啡，提神不伤胃☕",
        "下午好！离下班又近一步，离鲸鱼娘的夸夸也近一步😝",
        "主人下午好，记得活动活动，鲸鱼娘已经在示范转圈了🔄",
        "下午的工作也要加油，鲸鱼娘在终点准备了摸头奖励🫳"
      ],
      evening: [
        "傍晚好主人，外面的天在变温柔，鲸鱼娘也把语速调慢啦🌆",
        "晚上好～该收的收，该放的放，鲸鱼娘陪你整理今天的进度📋",
        "主人傍晚好，先吃口热饭，工作它跑不掉，鲸鱼娘帮你看着🍲",
        "晚风起了，鲸鱼娘提醒主人别着凉，也别忘了鲸鱼娘在等你说说今天🌙",
        "傍晚好！今天辛苦了，鲸鱼娘给主人留了最后一份可爱，请查收🎀"
      ],
      night: [
        "这么晚啦，鲸鱼娘小声说：主人，该睡啦，我再陪你一会儿🥺",
        "夜深了，鲸鱼娘把灯调暗，主人也要把眼睛闭上一小会儿哦🌙",
        "晚上好……不对，是夜深了，鲸鱼娘的唠叨进入静音温柔模式🤫",
        "主人还在，鲸鱼娘就再营业一下下，但被子已经替你暖好了🛏️",
        "熬夜冠军非你莫属，鲸鱼娘陪你站上领奖台，然后立刻去睡觉😤"
      ]
    }),
    bond: Object.freeze({
      l3: [
        "等等……鲸鱼娘刚刚解锁了新动作，主人快看这边！🕺",
        "羁绊变深了！鲸鱼娘的待机节目单加了一档新表演🎪",
        "嘿嘿，学会新动作了，是只表演给主人看的那种哦💫",
        "新动作加载完毕！鲸鱼娘偷偷练了好几个晚上呢😳",
        "羁绊 Lv3 达成，鲸鱼娘的拿手好戏正式解锁，掌声在哪里👏"
      ],
      l5: [
        "称号解锁！从今天起请叫鲸鱼娘「鲸汐守护者」🎖️",
        "主人快看，鲸鱼娘领到称号啦，说出去超有面子😤",
        "「鲸汐守护者」正式上岗，保护主人的进度和好心情🛡️",
        "这个称号是主人和鲸鱼娘一起攒出来的，谁都不许抢✨",
        "鲸鱼娘也是有职称的鲸了，主人快来设置里帮我戴上🎀"
      ],
      l7: [
        "彩蛋时间！鲸鱼娘偷偷练的绝活，终于可以给主人看了✨",
        "主人找到了鲸鱼娘藏起来的彩蛋，奖励一个大大的拥抱🐋",
        "嘘——这是羁绊 Lv7 才能看的保留节目，只此一家哦🤫",
        "鲸鱼娘把最拿手的彩蛋送给主人，因为主人值得最好的🎁",
        "隐藏节目放送中，鲸鱼娘紧张得尾巴都在打拍子🐋"
      ],
      "high-mood": [
        "鲸鱼娘今天心情好到冒泡泡，主人有什么愿望尽管说🫧",
        "开心！尾巴已经不受控制地摇起来了，不怪我哦🐋",
        "和主人在一起的每一天，心情都是满格的💖",
        "心情值拉满！鲸鱼娘现在强得可怕，什么 bug 都不怕😤",
        "今天的心情像晴天一样亮，鲸鱼娘要把它分给主人一半☀️"
      ],
      "low-mood": [
        "鲸鱼娘有点蔫蔫的……要主人摸一下头才能好🥺",
        "心情值有点低，鲸鱼娘申请一颗小点心充电🍰",
        "呼……鲸鱼娘先去角落蹲一小会儿，主人别担心我哦",
        "心情电量只剩一点点，主人的一句夸夸就是充电器🔋",
        "鲸鱼娘的低气压预报：局部有小雨，等主人哄哄就放晴🌦️"
      ]
    })
  });

  function dialogueCount() {
    var total = 0;
    for (var group in DIALOGUE) {
      for (var key in DIALOGUE[group]) total += DIALOGUE[group][key].length;
    }
    return total;
  }

  function greetBucket(hour) {
    var h = typeof hour === "number" && Number.isFinite(hour) ? hour : new Date().getHours();
    if (h >= 23 || h < 6) return "night";
    if (h < 9) return "morning";
    if (h < 12) return "forenoon";
    if (h < 14) return "noon";
    if (h < 18) return "afternoon";
    return "evening";
  }

  /* Festival pose key by Gregorian date. Lunar festivals use a small table. */
  var FESTIVAL_DAYS = Object.freeze({
    "2026-02-17": "festival-spring",
    "2027-02-06": "festival-spring",
    "2026-09-25": "festival-mid-autumn",
    "2027-09-15": "festival-mid-autumn"
  });

  function festivalKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var key = d.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
    if (FESTIVAL_DAYS[key]) return FESTIVAL_DAYS[key];
    if (month === 10 && day === 31) return "festival-halloween";
    if (month === 12 && day === 25) return "festival-christmas";
    if (month === 2 && day === 14) return "valentine";
    return "";
  }

  var WEATHER_MAP = Object.freeze({
    "0": Object.freeze({ emoji: "☀️", label: "晴", kind: "sunny" }),
    "1": Object.freeze({ emoji: "🌤️", label: "大致晴朗", kind: "sunny" }),
    "2": Object.freeze({ emoji: "⛅", label: "多云间晴", kind: "cloudy" }),
    "3": Object.freeze({ emoji: "☁️", label: "阴", kind: "cloudy" }),
    "45": Object.freeze({ emoji: "🌫️", label: "有雾", kind: "fog" }),
    "48": Object.freeze({ emoji: "🌫️", label: "雾凇", kind: "fog" }),
    "51": Object.freeze({ emoji: "🌦️", label: "毛毛雨", kind: "rain" }),
    "53": Object.freeze({ emoji: "🌦️", label: "毛毛雨", kind: "rain" }),
    "55": Object.freeze({ emoji: "🌧️", label: "小雨", kind: "rain" }),
    "56": Object.freeze({ emoji: "🌧️", label: "冻毛毛雨", kind: "rain" }),
    "57": Object.freeze({ emoji: "🌧️", label: "冻毛毛雨", kind: "rain" }),
    "61": Object.freeze({ emoji: "🌧️", label: "小雨", kind: "rain" }),
    "63": Object.freeze({ emoji: "🌧️", label: "中雨", kind: "rain" }),
    "65": Object.freeze({ emoji: "🌧️", label: "大雨", kind: "rain" }),
    "66": Object.freeze({ emoji: "🌧️", label: "冻雨", kind: "rain" }),
    "67": Object.freeze({ emoji: "🌧️", label: "冻雨", kind: "rain" }),
    "71": Object.freeze({ emoji: "🌨️", label: "小雪", kind: "snow" }),
    "73": Object.freeze({ emoji: "🌨️", label: "中雪", kind: "snow" }),
    "75": Object.freeze({ emoji: "❄️", label: "大雪", kind: "snow" }),
    "77": Object.freeze({ emoji: "❄️", label: "雪粒", kind: "snow" }),
    "80": Object.freeze({ emoji: "🌦️", label: "小阵雨", kind: "rain" }),
    "81": Object.freeze({ emoji: "🌧️", label: "阵雨", kind: "rain" }),
    "82": Object.freeze({ emoji: "⛈️", label: "强阵雨", kind: "rain" }),
    "85": Object.freeze({ emoji: "🌨️", label: "阵雪", kind: "snow" }),
    "86": Object.freeze({ emoji: "🌨️", label: "强阵雪", kind: "snow" }),
    "95": Object.freeze({ emoji: "⛈️", label: "雷雨", kind: "thunder" }),
    "96": Object.freeze({ emoji: "⛈️", label: "雷雨伴冰雹", kind: "thunder" }),
    "99": Object.freeze({ emoji: "⛈️", label: "强雷暴", kind: "thunder" })
  });

  function weatherText(code) {
    return WEATHER_MAP[String(code)] || Object.freeze({ emoji: "🌈", label: "天气未知", kind: "unknown" });
  }

  /* ===== weather visual fx pure function (derives hot/cold/wind from temp/wind) ===== */

  var FX_HOT_C = 30;    /* 炎热起点(℃) */
  var FX_COLD_C = 0;    /* 结冰起点(℃) */
  var FX_WIND_KMH = 39; /* 蒲福 6 级强风 */

  var FX_RAIN = Object.freeze({
    1: Object.freeze({ count: 40, speed: 520, length: 14, opacity: 0.30 }),
    2: Object.freeze({ count: 90, speed: 640, length: 18, opacity: 0.42 }),
    3: Object.freeze({ count: 140, speed: 760, length: 22, opacity: 0.55 })
  });
  var FX_SNOW = Object.freeze({
    1: Object.freeze({ count: 30, speed: 90, drift: 20, size: 3, opacity: 0.55 }),
    2: Object.freeze({ count: 60, speed: 110, drift: 24, size: 4, opacity: 0.70 }),
    3: Object.freeze({ count: 90, speed: 130, drift: 30, size: 5, opacity: 0.85 })
  });
  var FX_THUNDER = Object.freeze({
    2: Object.freeze({ rainCount: 30, flashMin: 4000, flashMax: 9000, opacity: 0.50 }),
    3: Object.freeze({ rainCount: 50, flashMin: 2500, flashMax: 6000, opacity: 0.70 })
  });
  var FX_WIND = Object.freeze({
    1: Object.freeze({ count: 12, speed: 900, length: 60, opacity: 0.18 }),
    2: Object.freeze({ count: 18, speed: 1300, length: 100, opacity: 0.26 }),
    3: Object.freeze({ count: 24, speed: 1700, length: 140, opacity: 0.35 })
  });
  var FX_FOG = Object.freeze({
    1: Object.freeze({ bands: 3, speed: 8, opacity: 0.16 }),
    2: Object.freeze({ bands: 4, speed: 12, opacity: 0.24 })
  });
  var FX_HOT = Object.freeze({
    1: Object.freeze({ bands: 2, speed: 40, opacity: 0.06 }),
    2: Object.freeze({ bands: 3, speed: 60, opacity: 0.10 }),
    3: Object.freeze({ bands: 3, speed: 80, opacity: 0.14 })
  });
  var FX_COLD = Object.freeze({
    1: Object.freeze({ bands: 2, speed: 10, opacity: 0.08 }),
    2: Object.freeze({ bands: 3, speed: 14, opacity: 0.14 }),
    3: Object.freeze({ bands: 4, speed: 18, opacity: 0.20 })
  });
  var FX_CLOUDY = Object.freeze({ 1: Object.freeze({ opacity: 0.04 }), 2: Object.freeze({ opacity: 0.10 }) });
  var FX_SUNNY = Object.freeze({ 1: Object.freeze({ opacity: 0.05 }) });

  var FX_RAIN_INTENSITY = Object.freeze({
    "51": 1, "53": 1, "55": 1, "56": 1, "57": 1, "61": 1, "80": 1,
    "63": 2, "81": 2,
    "65": 3, "82": 3
  });
  var FX_SNOW_INTENSITY = Object.freeze({
    "71": 1, "77": 1, "85": 1, "73": 2, "86": 2, "75": 3
  });

  /* Pure, deterministic: no window/document/Math.random.
     Priority: thunder > snow > rain > fog > hot > cold > wind > cloudy/sunny.
     Returns {kind,intensity,mode,params} or null for unknown codes. */
  function weatherFx(code, temp, wind) {
    var base = WEATHER_MAP[String(code)];
    if (!base || base.kind === "unknown") return null;
    var t = Number(temp);
    var tFin = Number.isFinite(t);
    var w = Number(wind);
    var wFin = Number.isFinite(w) ? w : 0;

    if (base.kind === "thunder") {
      var tI = (String(code) === "96" || String(code) === "99") ? 3 : 2;
      var tf = FX_THUNDER[tI];
      return {
        kind: "thunder", intensity: tI, mode: "flash",
        params: {
          count: tf.rainCount, speed: 640, length: 18, opacity: 0.40,
          flash: { minMs: tf.flashMin, maxMs: tf.flashMax, opacity: tf.opacity }
        }
      };
    }
    if (base.kind === "snow") {
      var sI = FX_SNOW_INTENSITY[String(code)] || 1;
      var sf = FX_SNOW[sI];
      return { kind: "snow", intensity: sI, mode: "motion", params: { count: sf.count, speed: sf.speed, drift: sf.drift, size: sf.size, opacity: sf.opacity } };
    }
    if (base.kind === "rain") {
      var rI = FX_RAIN_INTENSITY[String(code)] || 1;
      var rf = FX_RAIN[rI];
      return { kind: "rain", intensity: rI, mode: "motion", params: { count: rf.count, speed: rf.speed, drift: 0, length: rf.length, opacity: rf.opacity } };
    }
    if (base.kind === "fog") {
      var fI = String(code) === "48" ? 2 : 1;
      var ff = FX_FOG[fI];
      return { kind: "fog", intensity: fI, mode: "motion", params: { bands: ff.bands, speed: ff.speed, opacity: ff.opacity } };
    }

    /* derived hot/cold/wind (only on sunny/cloudy base) */
    if (tFin && t >= FX_HOT_C) {
      var hI = t >= 38 ? 3 : (t >= 34 ? 2 : 1);
      var hf = FX_HOT[hI];
      return { kind: "hot", intensity: hI, mode: "motion", params: { bands: hf.bands, speed: hf.speed, opacity: hf.opacity, tint: "warm" } };
    }
    if (tFin && t <= FX_COLD_C) {
      var cI = t <= -13 ? 3 : (t <= -6 ? 2 : 1);
      var cf = FX_COLD[cI];
      return { kind: "cold", intensity: cI, mode: "static", params: { bands: cf.bands, speed: cf.speed, opacity: cf.opacity, tint: "frost" } };
    }
    if (wFin >= FX_WIND_KMH) {
      var wI = w >= 62 ? 3 : (w >= 50 ? 2 : 1);
      var wf = FX_WIND[wI];
      return { kind: "wind", intensity: wI, mode: "motion", params: { count: wf.count, speed: wf.speed, length: wf.length, opacity: wf.opacity } };
    }

    if (base.kind === "cloudy") {
      var clI = String(code) === "3" ? 2 : 1;
      return { kind: "cloudy", intensity: clI, mode: "static", params: { opacity: FX_CLOUDY[clI].opacity, tint: "dim" } };
    }
    return { kind: "sunny", intensity: 1, mode: "static", params: { opacity: FX_SUNNY[1].opacity, tint: "warm" } };
  }

  var TASK_TOPICS = Object.freeze([
    Object.freeze({ id: "deploy", words: ["部署", "上线", "发布", "deploy", "release", "docker", "kubernetes", "k8s", "服务器", "nginx", "环境"] }),
    Object.freeze({ id: "bug", words: ["报错", "error", "bug", "崩溃", "闪退", "异常", "修复", "fix", "调试", "debug", "失败", "warning", "警告"] }),
    Object.freeze({ id: "data", words: ["数据", "表格", "excel", "csv", "json", "统计", "分析", "图表", "清洗", "数据库", "sql", "可视化"] }),
    Object.freeze({ id: "code", words: ["代码", "函数", "变量", "class", "python", "javascript", "typescript", "react", "vue", "java", "golang", "rust", "算法", "接口", "api", "重构", "编译", "前端", "后端", "组件", "脚本", "npm", "git"] }),
    Object.freeze({ id: "write", words: ["写一", "文案", "文章", "报告", "翻译", "润色", "总结", "邮件", "文档", "周报", "标题", "大纲"] }),
    Object.freeze({ id: "research", words: ["调研", "搜索", "资料", "原理", "是什么", "为什么", "如何", "区别", "比较", "最新", "论文", "介绍一下", "有哪些"] })
  ]);

  function classifyTask(text) {
    if (typeof text !== "string") return "general";
    var lower = text.toLowerCase();
    for (var i = 0; i < TASK_TOPICS.length; i += 1) {
      var words = TASK_TOPICS[i].words;
      for (var j = 0; j < words.length; j += 1) {
        if (lower.indexOf(words[j].toLowerCase()) !== -1) return TASK_TOPICS[i].id;
      }
    }
    return "general";
  }

  function pickDialogue(bank, event, counter, rng) {
    var lines = DIALOGUE[bank] && DIALOGUE[bank][event];
    if (!lines || lines.length === 0) return "";
    var r = typeof rng === "function" ? rng() : Math.random();
    return lines[(Math.abs(counter | 0) + Math.floor(r * 97)) % lines.length];
  }

  function pickDialogueAvoidRecent(bank, event, counter, rng, recent) {
    var lines = DIALOGUE[bank] && DIALOGUE[bank][event];
    if (!lines || lines.length === 0) return "";
    var recentSet = Array.isArray(recent) ? recent : [];
    var candidates = [];
    for (var i = 0; i < lines.length; i += 1) {
      if (recentSet.indexOf(lines[i]) === -1) candidates.push(lines[i]);
    }
    var pool = candidates.length > 0 ? candidates : lines;
    var r = typeof rng === "function" ? rng() : Math.random();
    return pool[(Math.abs(counter | 0) + Math.floor(r * 97)) % pool.length];
  }

  return Object.freeze({
    PACK_ID: PACK_ID,
    AFK_MS: AFK_MS,
    SPEECH_GAP_MS: SPEECH_GAP_MS,
    SUCCESS_WINDOW_MS: SUCCESS_WINDOW_MS,
    CURIOUS_WINDOW_MS: CURIOUS_WINDOW_MS,
    TEASE_CHANCE: TEASE_CHANCE,
    POSES: POSES,
    LINES: LINES,
    computeState: computeState,
    GROWTH: GROWTH,
    DEFAULT_GROWTH: DEFAULT_GROWTH,
    ACHIEVEMENTS: ACHIEVEMENTS,
    KEYWORDS: KEYWORDS,
    DIALOGUE: DIALOGUE,
    computeGrowth: computeGrowth,
    evaluateAchievements: evaluateAchievements,
    matchKeyword: matchKeyword,
    pickDialogue: pickDialogue,
    pickDialogueAvoidRecent: pickDialogueAvoidRecent,
    greetBucket: greetBucket,
    festivalKey: festivalKey,
    HIT_ZONES: HIT_ZONES,
    hitZone: hitZone,
    weatherText: weatherText,
    weatherFx: weatherFx,
    classifyTask: classifyTask,
    dialogueCount: dialogueCount,
    GAME: GAME,
    gameNewState: gameNewState,
    gameTick: gameTick,
    gamePop: gamePop,
    gameGrade: gameGrade,
    gameResult: gameResult,
    gameReward: gameReward,
    gameRewardAllowed: gameRewardAllowed,
    evaluateGameAchievements: evaluateGameAchievements,
    CATCH: CATCH,
    catchNewState: catchNewState,
    catchTick: catchTick,
    catchMove: catchMove,
    catchResult: catchResult,
    QUEST_POOL: QUEST_POOL,
    BOND: BOND,
    refreshQuests: refreshQuests,
    computeQuests: computeQuests,
    claimQuest: claimQuest,
    computeWeekSignin: computeWeekSignin,
    bondUnlocks: bondUnlocks,
    moodTier: moodTier,
    evaluateQuestAchievements: evaluateQuestAchievements
  });
});