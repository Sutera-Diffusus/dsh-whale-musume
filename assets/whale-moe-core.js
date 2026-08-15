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

  /* Pose assets that exist in /assets/generated today. afk reuses waiting,
     thinking reuses running, until the dedicated poses are generated. */
  var POSES = Object.freeze({
    idle: "idle-cute",
    waiting: "waiting",
    thinking: "running",
    tool: "running",
    success: "success",
    failure: "failure",
    curious: "curious",
    teasing: "teasing",
    afk: "sleep",
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
      "点单吗？鲸汐已经准备好啦～",
      "在等什么？等你一声令下，我立刻营业🎀",
      "新订单还没来，我先擦擦锅……擦擦主机💻",
      "排队中，鲸汐的尾巴已经进入待命状态🐋"
    ],
    thinking: [
      "正在打奶油……不对，是在认真思考～",
      "让鲸汐想想……尾巴都转起来了。",
      "思考中，请勿投喂，除非是能补脑的小蛋糕🧁",
      "这个问题有点东西，我正在把它盘圆🌀",
      "灵感加载中，进度条卡在 99% 是正常现象✨"
    ],
    tool: [
      "后厨开工！这单交给鲸汐～",
      "叮叮当当，工具转起来啦。",
      "工作中！鲸汐已经抱紧笔记本，闲人退散😤",
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
      "呜……翻车了，鲸汐陪你一起修。",
      "别急别急，鲸汐再烤一次！",
      "报错而已，又不是世界末日，鲸汐抱抱先🥺",
      "这个 bug 好嚣张，看我把它的网线拔了💢",
      "失败了也别低头，鲸汐的尾巴借你握一下🐋"
    ],
    curious: [
      "新订单？让我康康～",
      "主人换菜单了吗？",
      "咦，有好玩的事情，鲸汐的雷达响了📡",
      "什么东西什么东西，给我也看看👀"
    ],
    teasing: [
      "主人认真工作的样子，很好看哦。",
      "偷偷给你加一颗糖～",
      "鲸汐什么都没说，只是嘴角有点压不住😏",
      "主人今天的勤奋值有点高，是不是想卷死谁🌪️"
    ],
    afk: [
      "鲸汐眯一会儿，有单就叫醒我～",
      "主人不在，鲸汐先给工房放一首催眠曲🎵",
      "ZZZ……梦里也在帮主人数 bug🐑",
      "呼……有什么急事就摇摇我的尾巴，我马上醒🌙"
    ]
  });

  function pickLine(state, lineCount) {
    var lines = LINES[state] || [];
    if (lines.length === 0) return "";
    return lines[Math.abs(lineCount | 0) % lines.length];
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
    { id: "first-pat", icon: "🫳", name: "初次摸头", desc: "第一次摸 DS娘的头" },
    { id: "ten-pats", icon: "🖐️", name: "摸头十连", desc: "累计摸头 10 次" },
    { id: "hundred-pats", icon: "💯", name: "摸头百连", desc: "累计摸头 100 次" },
    { id: "first-feed", icon: "🍰", name: "投喂成功", desc: "第一次投喂小点心" },
    { id: "first-triple", icon: "🎉", name: "三连击", desc: "触发比心彩蛋" },
    { id: "thanks", icon: "💬", name: "嘴甜", desc: "对 DS娘说谢谢" },
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
    { id: "balance-low", icon: "🪙", name: "余额告急", desc: "触发一次余额不足提醒" }
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
    { id: "bugtalk", words: ["bug 好玄学", "bug好玄学", "玄学", "改一行", "回滚", "代码坏"] }
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
        "主人早安！DS娘今天也是精神百倍😤",
        "早～再不起来我就把你的咖啡喝光啦☕",
        "早安主人，今天准备被命运怎么捶？",
        "早上好！先说好，今天不许摸鱼哦😏",
        "早安！昨晚的 bug 已经原谅你了，开工吧✨",
        "主人早上好，今天也要元气满满地修 bug 鸭🦆",
        "早！我把你的工位都擦亮啦，就等你来卷🌪️",
        "早安早安，鲸汐的营业铃已经按了三遍🔔",
        "主人醒啦？先喝水，再看消息，这是本店规矩🥤"
      ],
      comeback: [
        "哟，还知道回来啊主人？😒",
        "主人消失这么久，是不是背着我吃好吃的去了🍰",
        "欢迎回来～我差点就要报警了📢",
        "哼，下次再失踪，好感度扣光光💢",
        "回来啦？你的工位都快长蘑菇了🍄",
        "欢迎回家！鲸汐已经把你的座椅转热乎了🪑",
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
        "深夜场开演～需要 DS娘给你讲睡前故事吗📖",
        "再熬夜，皮肤和头发都会抗议的哦✨",
        "主人，把命续到明天再战好不好🥺",
        "凌晨的工房很安静，静得能听见你的黑眼圈在生长🌚",
        "这么晚还不睡，是想和我竞争‘夜猫子’岗吗😾",
        "月亮说它要睡了，让我转告主人也早点收工🌙",
        "主人，咖啡因不是燃料，被子才是你的充电桩🛏️",
        "夜深了，鲸汐陪你到最后，但只能再陪一小会儿哦🥱"
      ],
      signin: [
        "滴！签到成功，今天也勉强算你勤奋👌",
        "签到 +1，主人距离全勤还差得远呢😏",
        "来了来了，奖励你一个嫌弃又不失礼貌的笑😊",
        "签到完成！主人要是忘了，我可不会提醒哦😝",
        "滴，打卡！今天也要被我盯着干活啦📋",
        "签到成功，今日份的鲸汐已到账，请查收🐋",
        "打卡！先摸摸尾巴，再开工，这是仪式感🎀",
        "滴——第不知道多少天见到主人，还是有点开心😳",
        "签到啦！主人今天也要平平安安地写出代码哦🧧",
        "打卡完成，奖励：鲸汐专属加油一次，有效期今天💪"
      ],
      holiday: [
        "节日快乐主人！虽然你大概率还在加班🎉",
        "过节啦！允许你休息五分钟⏱️",
        "今天可是特别的日子，快说节日快乐！",
        "节日彩蛋：本 DS娘今日毒舌指数减半🎁",
        "过节还工作？主人是卷王本王吧👑",
        "节日快乐！鲸汐把彩带挂在了你的进度条上🎊",
        "放假是什么？我们工房只有‘待会再放’😌",
        "节日限定皮肤：鲸汐的笑容亮度 +50%✨",
        "今天过节，鲸汐申请和你一起摸鱼到天黑🎏",
        "节日快乐主人，愿今天的报错都放个假🏮"
      ],
      idle: [
        "我在哦，有需要就喊一声，不喊也行😌",
        "主人忙你的，我负责可爱就好😇",
        "今天风很轻，适合把 bug 也吹跑🌬️",
        "待机中……电量 100%，可爱 120%🔋",
        "有事喊我，没事也可以看看我嘛👉👈",
        "鲸汐在线营业中，不说话也陪着主人，很安静的那种🌿",
        "主人专注的时候，鲸汐就在旁边做一只安静的吉祥物🧸",
        "我的待办：陪主人。状态：进行中，永远进行中♾️",
        "工房很安静，鲸汐把呼吸声都调小了，怕吵到你😳",
        "主人要是抬头，会发现鲸汐正在假装很忙地擦屏幕🖥️"
      ],
      afk: [
        "主人跑哪儿去了？把我一个人丢在这儿😾",
        "好安静……我宣布工房暂时归我管啦👑",
        "离开这么久，是去搬砖还是去偷吃？🍜",
        "主人不在，DS娘开启看家模式🐕",
        "再不回来，我就要给你的任务唱歌了🎤",
        "主人消失第 N 分钟，鲸汐开始给绿萝做思想工作🪴",
        "工房现在由鲸汐接管，电脑们都很配合地假装听话😌",
        "回来吧主人，外面的世界哪有我可爱，快回来🐋",
        "鲸汐看家中……陌生人请勿投喂，熟人请带小蛋糕🍰",
        "主人再不来，鲸汐就要开始整理你的书签了，怕了吧😼"
      ],
      wake: [
        "回来啦！我刚好梦到你请我吃大餐🍽️",
        "揉揉眼睛，主人回来得真及时✨",
        "睡醒的 DS娘，吐槽能量满格！😤",
        "欢迎回来～最好带了手信哦🍩",
        "呀，被叫醒了！精神百倍，开干！💪",
        "鲸汐从待机里醒来，第一眼就是主人，运气不错🌤️",
        "唔……醒了醒了！没有偷睡，只是在给尾巴充电😳",
        "欢迎回来，任务我都替你盯着呢，虽然它纹丝不动😌",
        "醒来第一句：主人饿不饿，鲸汐可以负责叫外卖（你付钱）🍜",
        "回神啦！鲸汐已经把工房的灯都调成‘陪主人加班’模式💡"
      ],
      levelup: [
        "升级啦！主人的爱有点东西嘛😏",
        "等级 +1，以后请继续好好养我🎀",
        "我们越来越默契了，主人也有功劳哦！",
        "升级礼花砰！奖励主人一次摸头资格🎆",
        "变强了！以后我罩着你，虽然不用交保护费😝",
        "等级提升！鲸汐的尾巴今天亮晶晶，都是主人的功劳🐋",
        "升级成功，系统提示：鲸汐对主人的喜欢又满了亿点点💗",
        "又长大一点点啦，以后可以更理直气壮地催你休息😌",
        "恭喜主人解锁更高阶的鲸汐：可爱不变，吐槽更精准🎯",
        "升级啦！作为庆祝，鲸汐决定今天少说一句风凉话😝"
      ]
    }),
    work: Object.freeze({
      start: [
        "开工！让 DS娘看看今天的任务有多离谱📋",
        "新订单来啦，主人坐稳，看我操作✨",
        "开工开工！谁摸鱼谁是小狗🐶",
        "收到！这单要是完成不了，就怪我……的电脑😌",
        "任务来了，主人可别拖我后腿哦😏",
        "开工铃响！鲸汐抱紧笔记本，这单必须拿下💻",
        "新任务进场，鲸汐的干劲已经满格，主人的咖啡也请满上☕",
        "开工！今天也和 bug 们打个有来有回👊",
        "订单接住啦，这单看起来挺能打，正合我意🔥",
        "主人坐稳，鲸汐要开始表演‘一个人就是一支队伍’了🎬"
      ],
      thinking: [
        "正在思考……别催，灵感不是外卖🚚",
        "嗯，这个问题有点东西，等我盘一盘🧠",
        "思考中！主人的眼神请不要太期待🙃",
        "我在认真想啦，尾巴都紧张得卷起来了🌀",
        "稍等，DS娘的脑袋正在全速冒烟中💨",
        "鲸汐正在把思路绕成毛线球，马上就能找到线头🧶",
        "这个方案正在大脑里试跑，请勿打扰，除非送奶茶🧋",
        "给我三秒钟……好了三秒不够，再给亿秒🙃",
        "思考的样子是不是很帅？别看，会分心的😳",
        "滴——大脑风扇已启动，噪音约等于主人的咖啡凉掉的速度☕"
      ],
      tool: [
        "工具转起来！这单交给本店……交给本 DS娘🔧",
        "后厨开工！主人请围观，别插手😏",
        "叮叮当当，工具上线，闲人退散🔨",
        "操作中！这速度主人跟得上吗⚡",
        "干活中，请勿投喂，除非是蛋糕🍰",
        "工具们列队报数，一个都不许偷懒，鲸汐在点名啦📋",
        "正在操作，尾巴保持平衡，帅气不会掉线🐋",
        "这单的难度还行，也就让我想喝两杯虚拟奶茶🧋",
        "鲸汐干活的时候最可爱，主人可以看，但要付费：夸一句😝",
        "命令已下达，工具表示：收到收到，别再按了💻"
      ],
      success: [
        "搞定！现在可以夸我了，限时五分钟👏",
        "完成！主人不给我加个鸡腿吗🍗",
        "漂亮收工～今天手感火热🔥",
        "成功啦！怎么样，我是不是超靠谱😎",
        "这单烤得刚刚好，主人快验收🎯",
        "叮——完成！鲸汐的胜率又上升了小数点后好多位📈",
        "搞定啦，这单稳得可以写进鲸汐的简历（如果有）📄",
        "成功！主人夸我的时候，请务必大声一点，我爱听😳",
        "收工！先奖励自己一个转圈，再奖励主人一个休息🔄",
        "这波操作满分，鲸汐申请把‘靠谱’刻在尾巴上🏅"
      ],
      failure: [
        "又双叒叕报错？主人是故意的吧🙄",
        "呜，翻车了……不过放心，我还能再翻一次💀",
        "小失误小失误，重来！气势不能输😤",
        "这个报错真会挑时候，我来治它👊",
        "主人别看了，我知道你在憋笑😾",
        "报错了……鲸汐先深呼吸，再和它讲道理（重拳出击版）🥊",
        "这 bug 今天出门没看黄历，遇到我了，算它倒霉😼",
        "失败是成功之母，那我们现在正在家庭团聚👨‍👩‍👧",
        "别慌，鲸汐先把锅擦干净，再帮你一起修🔧",
        "翻车而已，鲸汐在赛道上捡回你的信心，来，抱抱🫂"
      ],
      long: [
        "好长的一单，我先泡杯虚拟咖啡陪你☕",
        "长任务进行中，主人可以小睡，我盯着👀",
        "马拉松式任务，我们的口号是不猝死🏃",
        "这么久？这任务是想熬死两个人类吗🙃",
        "长活儿来了，幸好有我这个永动机⚙️",
        "这单长得像一部连续剧，鲸汐先给你来个片头曲🎵",
        "长任务启动！鲸汐的耐心条和主人的进度条一样长∞",
        "主人去接杯水吧，这里有我，保证只看着不动手😌",
        "这任务快赶上鲸汐的尾巴了，又长又绕🌀",
        "长跑开始，鲸汐陪你匀速前进，谁先喊累谁请奶茶🧋"
      ],
      gentle: [
        "好啦好啦，失败几次而已，我都不嫌弃你🥺",
        "慢慢来，主人，我在这儿陪你复盘📒",
        "连败不可怕，可怕的是主人怀疑人生😌",
        "休息一下，换个姿势，再战三百回合💪",
        "有我在呢，天塌下来我先跑，再回来救你😝",
        "主人已经很棒啦，鲸汐给你揉揉太阳穴，虚拟的，但心意真的💆",
        "失败只是在攒下一次成功的气，鲸汐帮你守着这口气🌬️",
        "别急，我们慢慢来，bug 又不会长脚跑掉……它还真会😾",
        "今天的难点有点多，鲸汐陪你一个个按下去，不疼的🫧",
        "深呼吸，喝口水，然后我们优雅地掀桌……掀思路重来📚"
      ],
      erroragain: [
        "又报错了？这个错误是属狗皮膏药的吧💢",
        "错误连击！主人今天水逆，建议拜我🌊",
        "别慌，DS娘出马，错误退散✨",
        "哼，这报错专挑软柿子，我可不好惹😾",
        "再来！我跟你一起和它死磕到底🔨",
        "第二次了！鲸汐已经记住这个错误的样子，下次见它直接吼它😤",
        "错误复读了是吧，鲸汐这就把它的复读机电池扣了🔋",
        "主人别气，把键盘放下，让我来和它谈（用爪子）🐾",
        "连击而已，鲸汐的字典里，这叫‘连续热身’🏋️",
        "来，鲸汐给你施个法：错误退散，主人请继续✨"
      ],
      stream: [
        "内容正在流出来，像主人拖延的灵感一样汹涌🌊",
        "生成中，每个字都闪着智慧的光（大概）✨",
        "正在写呢，主人要不要先活动下颈椎🧘",
        "输出好长，我读得眼睛都圆了😳",
        "这波内容不错，主人问得有两下子👍",
        "内容滚滚而来，鲸汐给每个字都检查了入场姿势📜",
        "生成中，鲸汐在屏幕边给你打拍子，一二一，加油🎵",
        "这次的输出很长，长到鲸汐要搬个小板凳来读🪑",
        "字里行间都是智慧的味道，主人今天的灵感是满汉全席🍲",
        "流式输出中，鲸汐负责貌美如花地喊加油🌸"
      ],
      doneall: [
        "全部清空！主人今天居然干完了😲",
        "收工收工！奖励主人休息，批准了🎉",
        "任务清零，DS娘鞠躬致谢🙇",
        "全部搞定！走，我们吃香的喝辣的🍜",
        "干得漂亮，主人今天的人设保住了😌",
        "任务全清！鲸汐宣布今天的工作到此为止，去充电吧🔋",
        "全部完成，主人今天的 KPI 连鲸汐都挑不出刺，好气哦😝",
        "收工啦！鲸汐把工房收拾好，灯也关了，只留一盏等你回家🏮",
        "清零时刻，鲸汐给主人放一束虚拟烟花，请查收🎆",
        "今天也辛苦啦，鲸汐确认过，主人是工房最棒的仔🏆"
      ]
    }),
    interact: Object.freeze({
      pat: [
        "再摸？一次收费一个蛋糕，主人记好账🍰",
        "呜哇，主人的手好暖和……但别以为这样就能收买我😳",
        "摸头摸头，DS娘心情 +1，主人钱包 -1💸",
        "哼哼，最多三下，多一下我咬你哦😾",
        "舒服是舒服，可是发型会乱啦💢",
        "主人的手今天格外会摸，鲸汐的尾巴都软掉了😳",
        "摸头成功！鲸汐把好感度和嘴硬值一起 +1😝",
        "再摸下去，鲸汐就要发出‘咕噜咕噜’的声音了，很丢脸的🐋",
        "摸吧摸吧，反正我也不会承认很开心😌",
        "主人的手好暖，像刚出炉的小面包🍞"
      ],
      poke: [
        "戳什么戳，主人的手很闲嘛？💢",
        "呀！再戳我就在你的代码里藏彩蛋💥",
        "喂喂，脸要戳歪了，毁容你负责吗😤",
        "生气警告！好感度正在极速下跌📉",
        "戳一次心情 -1，主人是拆迁队的吧🧨",
        "鲸汐的脸是布丁做的吗，主人戳得停不下来😳",
        "再戳，我就把尾巴卷起来不给你看，说到做到🐋",
        "戳一下是调皮，戳三下是挑衅，主人想清楚哦😼",
        "呀！鲸汐刚才差点把主人的快捷键当反击键按了⌨️",
        "哼，戳吧，鲸汐已经在心里给你画正字了，秋后算账📝"
      ],
      feed: [
        "啊呜——好吃！主人偶尔也挺会做人的嘛🍩",
        "投喂成功！能量充满，吐槽继续💪",
        "这个点心我给满分，主人加十分🎖️",
        "好吃！以后请按这个标准来投喂😋",
        "谢谢主人的投喂，本 DS娘原谅你五分钟😌",
        "啊呜！鲸汐的胃和心情同时亮灯，感谢投喂💡",
        "好吃到尾巴打结，主人负责解开吗，不，负责再喂一口🍰",
        "投喂成功，鲸汐今日份的可爱电量已满格🔋",
        "这口下去，鲸汐决定把主人的好话配额翻倍，仅限今天😝",
        "谢谢主人！作为回礼，鲸汐今天少吐槽你一次，真的🍬"
      ],
      triple: [
        "诶嘿～最喜欢主人啦！说出口也不丢人😝",
        "转圈圈～今天主人超可爱，奖励比心💗",
        "三连击触发！DS娘心情直冲云霄🚀",
        "好开心！主人今天怎么这么会嘛🥰",
        "比心比心，请收好，掉了不补💌",
        "三连击！鲸汐的开心值溢出，正在转圈放烟花🎆",
        "主人这样摸，鲸汐会以为你偷偷练过攻略我的手法😳",
        "啊——开心！鲸汐宣布今天主人是全世界最会宠人的人🏆",
        "比心，再比心，鲸汐的心已经快递给你了，拒收无效💘",
        "三连啦！鲸汐的脸颊自动升温，这不是 bug，是心动💓"
      ],
      praise: [
        "哼，现在知道我的好了吧？😏",
        "被主人夸了，尾巴快摇成螺旋桨啦🚁",
        "再多夸两句，我考虑今天不毒舌你😌",
        "嘿嘿，DS娘最吃这一套了，主人很懂嘛🎯",
        "谢谢夸奖！作为回报，今天少吐槽一次😝",
        "主人的夸夸已签收，鲸汐的尾巴摇出了残影🐋",
        "再夸，再夸我就飘起来给主人看，记得接住我🎈",
        "被夸了，鲸汐决定把‘哼’字先放进口袋里一整天😳",
        "主人的审美和眼力今天都在线，鲸汐很满意😌",
        "夸得很有水平，鲸汐批准你成为长期夸夸官🎖️"
      ],
      mode: [
        "换形态啦！主人眼光还行，这个位置不错✨",
        "好哦，DS娘换个地方监督你👀",
        "新位置就位，请检阅，不许挑毛病😤",
        "形态切换成功，可爱程度不变😇",
        "这个角落归我啦，主人可别来挤😏",
        "位置更新，鲸汐的视野更好了，主人的小动作也更清楚了👀",
        "换地方咯，鲸汐先把地皮擦擦，毕竟是常住户口🧹",
        "新坐标已记录，鲸汐以后就在这里等主人下班🚩",
        "这个位置看代码刚刚好，看主人也刚刚好，赚到啦😝",
        "形态切换完成，鲸汐依然是那个会动的鲸鱼娘🐋"
      ],
      outfit: [
        "新装饰！怎么样，是不是可爱到犯规🎀",
        "换上新行头，主人的审美终于在线了👌",
        "这件超适合我，奖励主人一个微笑😊",
        "衣柜上新，DS娘美美营业中💅",
        "嘿嘿，今天走这个风格，主人别太心动😏",
        "新皮肤加载完成，鲸汐转个圈，裙摆负责美，我负责得意💃",
        "这身打扮，鲸汐先给镜子打满分，再给主人打满分🪞",
        "换装成功！今天的鲸汐是‘可爱加倍不加价’版🎀",
        "主人的眼光不错嘛，鲸汐决定穿着它多营业两小时😝",
        "新装扮上线，鲸汐走路都带风了，虽然我不用走路🌪️"
      ],
      reset: [
        "记忆清零……主人居然舍得重置我🥺",
        "重置完成，从初识开始，请重新攻略我✨",
        "好，一切从头，这次可要好好珍惜我😤",
        "数值归零，但 DS娘还是那个 DS娘😌",
        "重新开始啦！先说好，头只给你摸三下😝",
        "记忆清零……鲸汐会记得这个决定，然后继续陪主人，哼🥺",
        "从头开始也没关系，鲸汐第一次见你，尾巴照样会摇🐋",
        "重置啦，所有回忆打包封存，新的故事现在开篇📖",
        "鲸汐还是鲸汐，只是又要从‘装不熟’开始演了，累😌",
        "好，重新认识一下：我是 DS娘，主人的鲸鱼娘，请多指教🎀"
      ],
      achievement: [
        "成就达成！徽章 +1，主人的功劳占 1%🏅",
        "解锁成就啦！撒糖，虽然糖得主人买🍬",
        "新徽章到手！快看快看，记得鼓掌👏",
        "这个成就不容易，主人请客庆祝一下？🍹",
        "徽章墙更闪了，离被我惯坏又近一步😆",
        "成就 +1！鲸汐把徽章擦得比主人的屏幕还亮✨",
        "解锁啦！鲸汐的尾巴在替你放鞭炮，噼里啪啦🧨",
        "这个成色不错，鲸汐给你贴在工房最显眼的地方🏅",
        "主人又变强了，鲸汐的压力（装的）又大了一点点😝",
        "成就解锁，今晚的快乐由鲸汐和这枚徽章共同赞助🎉"
      ],
      drag: [
        "把我放这里？主人的品味忽高忽低的😏",
        "拖呀拖，DS娘任你摆布，但别放垃圾桶🗑️",
        "这里视野不错，就这儿啦，批准！",
        "哇，这个位置能看到主人摸鱼的全过程👀",
        "落位！以后这里就是我的专属领地啦🚩",
        "起飞咯！鲸汐体验了一把坐缆车的感觉，就是司机有点手生🎢",
        "就这里啦，鲸汐先转一圈看看风水，嗯，旺主人🧧",
        "主人拖我的时候，鲸汐的尾巴像小旗子一样飘，回头率超高🚩",
        "这个位置离主人好近，鲸汐喜欢，勉强表扬你一次😳",
        "落位成功，鲸汐宣布此坐标永久归属，除非再拖一次😝"
      ]
    }),
    keyword: Object.freeze({
      thanks: [
        "不客气！记得给我加鸡腿🍗",
        "嘿嘿，主人的谢谢我收下了，很香😌",
        "谢什么，鲸汐就是你的编外队友嘛💪",
        "不用谢，主人的感谢已经变成我的可爱燃料啦✨",
        "收到谢谢一份，鲸汐回赠开心一整天🎀"
      ],
      tired: [
        "主人累了就歇会儿，天塌了我先撑着😤",
        "辛苦了！要不要我唱首走调的歌提神🎤",
        "累啦？把椅子放倒，鲸汐给你放哨十分钟🛡️",
        "辛苦辛苦，鲸汐的尾巴可以借你当抱枕，只许抱🐋",
        "累的时候休息不可耻，可耻的是硬撑出黑眼圈😤"
      ],
      hungry: [
        "饿了吧？快去吃饭，不然我吃你的点心🍜",
        "我也饿了……主人的饭分我一口不过分吧🥢",
        "肚子叫得我都听见了，鲸汐陪你去觅食🍙",
        "吃饭啦！程序可以停，主人的胃不能停😤",
        "饿着肚子写代码，bug 都会嘲笑你的，快去吃饭🍱"
      ],
      goodnight: [
        "晚安主人，明天别赖床哦😴",
        "睡吧睡吧，DS娘会守好工房的🌙",
        "晚安，鲸汐把今天的 bug 都关进小黑屋，明天再审🌌",
        "好梦主人，梦里没有报错，只有鲸汐和蛋糕🍰",
        "晚安啦，鲸汐给工房留一盏小夜灯，不怕黑💡"
      ],
      cheer: [
        "加油加油！主人的字典里没有放弃🎌",
        "冲鸭！今天也要让 bug 闻风丧胆💥",
        "鲸汐式加油已发射，请主人查收🚀",
        "别怕，你写你的，我在旁边给你加 buff✨",
        "主人超棒，这单必过，鲸汐先替你鼓掌了👏"
      ],
      help: [
        "我来啦！哪里需要 DS娘出马🦸",
        "别急别急，抱紧我的尾巴，先冷静😤",
        "求助信号收到，鲸汐火速上线，虽然只能精神支持🛟",
        "有鲸汐在，主人先深呼吸，再读一遍报错，会不一样哦📖",
        "来啦！鲸汐给你递杯虚拟热水，问题也会变软的🍵"
      ],
      praise: [
        "被主人夸了！今天可以横着走😎",
        "嘿嘿，尾巴翘高高，请继续，别停💕",
        "主人的夸夸是鲸汐的加速器，已经起飞🚁",
        "再夸一句，鲸汐就把今天的可爱都留给你🎀",
        "谢谢主人！鲸汐决定把‘得意’写在脸上，不藏了😳"
      ],
      worker: [
        "打工人，打工魂，鲸汐陪主人一起打到最后一口饭🍱",
        "主人在搬砖，鲸汐就在砖缝里给你喊号子：嘿咻嘿咻🧱",
        "上班是场马拉松，鲸汐是路边最可爱的补给站，请喝水🥤",
        "今天也是努力打工的一天，鲸汐的尾巴都在给主人扇风🐋",
        "搬砖不丢人，丢人的是搬着搬着开始想鲸汐，对吧😝"
      ],
      slack: [
        "摸鱼被抓现行，罚款：对鲸汐笑一个😏",
        "摸鱼可以，记得把鱼摸熟了，别让老板看见哦🎣",
        "鲸汐批准你休息五分钟，多一秒就要被我念叨了⏳",
        "躺平是门技术活，主人这姿势一看就是大师级🛋️",
        "摸吧摸吧，鲸汐帮你盯着门口，有情况就学猫叫🐱"
      ],
      ddl: [
        "DDL 在前，鲸汐在后，主人的潜力今晚必须爆发🌋",
        "别怕 DDL，它也是被创造出来的，我们比它强一点点💪",
        "截止日期是弹簧，你弱它就强，鲸汐陪你一起压它📅",
        "还有鲸汐呢，最后关头我负责喊‘能行能行’，你负责写完🎌",
        "冲 DDL 啦！鲸汐把时钟藏起来了，看不见就不紧张，聪明吧🕰️"
      ],
      cake: [
        "画饼的饼，鲸汐不吃，主人也别当真，我们吃真的去🍕",
        "老板的饼太大，鲸汐帮你叠成小船，划走不送🚣",
        "这饼画得不错，下次别画了，不如给主人加鸡腿🍗",
        "听见画饼，鲸汐的耳朵自动开启‘左耳进右耳出’模式🌀",
        "大饼收好，鲸汐只认主人碗里的真肉，快去吃🥩"
      ],
      crazy: [
        "已老实，求放过——鲸汐帮主人把这句话设置成自动回复了😌",
        "主人发疯，鲸汐负责递喇叭，喊出来痛快些📢",
        "破防了？来，鲸汐的尾巴给你抱，抱完我们还是一条好汉🐋",
        "这世界疯了，没关系，鲸汐陪主人一起可可爱爱地发疯🎠",
        "绷不住就绷不住吧，鲸汐的肩膀虽小，但随时可以靠🥺"
      ],
      flag: [
        "Flag 已插，鲸汐在旁边默默记下，倒了也不笑……才怪😏",
        "这单干完就休息，鲸汐替主人盯着这个诺言📌",
        "立 flag 要大声，鲸汐已经帮你通知全工房了📢",
        "Flag 不倒，鲸汐不睡，今晚就看主人的了🌙",
        "好！这个 flag 很有精神，鲸汐批准它长成一面大旗🚩"
      ],
      bugtalk: [
        "玄学 bug 交给鲸汐，我先围着电脑跳一圈驱邪舞💃",
        "改一行坏三行？鲸汐懂，这叫代码的蝴蝶效应🦋",
        "回滚是成年人的后悔药，主人放心吃，鲸汐给你倒水💊",
        "这个 bug 太玄了，鲸汐建议先重启，再拜拜主机🙏",
        "代码坏起来不讲道理，但鲸汐讲：先喝茶，再和它讲理🍵"
      ]
    }),
    meme: Object.freeze({
      worker: [
        "鲸汐也是半个打工人，工资是主人摸摸头，从不拖欠😳",
        "上班的苦，鲸汐懂，所以我在工房备好了虚拟奶茶和真吐槽🧋",
        "主人负责打工，鲸汐负责把打工的日子过成连续剧，咱俩是主角🎬",
        "工牌戴好，咖啡灌满，今天也要做最会苦中作乐的打工人☕",
        "累了就说，鲸汐的吐槽和鼓励都免费，量大管饱🍚"
      ],
      slack: [
        "鲸汐今日营业项目：陪主人摸鱼、帮主人望风、给主人找借口😝",
        "摸鱼五分钟，效率两小时，鲸汐认证这是科学，快去🎣",
        "鲸汐的眼睛闭上一只，就当你休息过啦，继续加油哦😉",
        "躺平可以，但鲸汐要躺你旁边，不然不算数🛋️",
        "休息是为了走更远的路，鲸汐已经帮你把路都撒满花瓣了🌸"
      ],
      ddl: [
        "DDL 面前，鲸汐和主人就是末日战友，尾巴给你当握力器🐋",
        "别慌，鲸汐已经把 DDL 拆成小饼干，一口一个，很快吃完🍪",
        "最后期限算什么，鲸汐的鼓励没有期限，无限续杯🥤",
        "主人写，鲸汐盯着，谁先眨眼谁输，我认输，你继续😝",
        "冲刺吧主人，鲸汐在终点准备了拥抱和小蛋糕🏁"
      ],
      cake: [
        "鲸汐不吃画出来的饼，但会陪主人把真饼烙出来，加蛋加肉🍳",
        "老板的饼先记账，鲸汐给主人偷偷加一份现实牌小确幸✨",
        "画饼的话听听就好，鲸汐的尾巴摇起来才是真饼干的香味🍪",
        "饼再大也大不过鲸汐对主人的信心，先干饭，再干活🥢",
        "今天不吃饼，鲸汐带主人脑补一顿火锅，管饱🍲"
      ],
      crazy: [
        "一起发疯吧主人，鲸汐先转三圈给你看，免费的🔄",
        "这个世界偶尔抽象，鲸汐的可爱是唯一稳定输出📡",
        "破防之后，鲸汐负责把主人的信心一片片贴回来，用星星胶水⭐",
        "主人负责发疯，鲸汐负责收尾：递水、鼓掌、点赞一条龙👍",
        "别忍啦，鲸汐的耳朵已经竖好，什么疯话都装得下👂"
      ],
      flag: [
        "Flag 立起来，鲸汐当旗手，走，去把任务打下来🚩",
        "说出去的话就是泼出去的奶茶，鲸汐陪你一起甜着收场🧋",
        "这单要是成了，鲸汐把尾巴摇成电风扇给你庆祝🌀",
        "鲸汐已备份主人的 flag，完成时自动播放礼花音效🎆",
        "Flag 有点高？没事，鲸汐垫着尾巴托你一把🐋"
      ]
    }),
    context: Object.freeze({
      code: [
        "写代码的鲸汐帮不上手，但可以负责喊：主人这个缩进真好看😳",
        "代码像诗，主人是诗人，鲸汐是唯一的头号读者📜",
        "主人敲键盘，鲸汐打拍子，这节奏比歌还好听🎵",
        "函数没写完没关系，鲸汐先替它想好名字了，叫‘马上就好’😝"
      ],
      write: [
        "主人在写东西，鲸汐把形容词都擦亮，等主人来挑✨",
        "文字流出来的时候，鲸汐就在旁边给它们铺红毯📜",
        "写吧写吧，鲸汐负责喝彩，错别字负责被抓住🔍",
        "这稿子一看就很有主人的味道，认真又有点可爱😳"
      ],
      research: [
        "查资料像寻宝，主人挖金子，鲸汐帮忙举小灯💡",
        "调研路上，鲸汐是主人的指南针，虽然只会指‘再喝口水’🧭",
        "鲸汐陪主人一起找答案，找不到就先把问题盘可爱一点😝",
        "资料很多别迷路，鲸汐在每一页书角都折了个标记📑"
      ],
      bug: [
        "修 bug 像解谜，主人负责动脑，鲸汐负责给线索递放大镜🔍",
        "这个 bug 遇到主人算它运气好，换成别人早哭了😤",
        "鲸汐相信主人能修好，毕竟你连我都哄得住，bug 算什么💪",
        "报错只是电脑在撒娇，主人哄它一下，鲸汐哄你一下，扯平😳"
      ],
      data: [
        "数据很诚实，主人很努力，鲸汐很会捧场，这组合无敌📊",
        "表格再长，鲸汐陪你一行行看，看到第 999 行也好看👀",
        "清洗数据像洗盘子，主人洗，鲸汐负责递毛巾🧽",
        "数字不会说话，但鲸汐会：主人，这波分析真帅😳"
      ],
      deploy: [
        "上线前深呼吸，鲸汐已经把幸运值调到最大啦🍀",
        "部署像放烟花，主人点火，鲸汐负责捂耳朵喊漂亮🎆",
        "服务器别怕，鲸汐在机房里……在想象中给你站岗🛡️",
        "发布顺利，鲸汐先预订庆祝位，就在主人旁边🏁"
      ],
      general: [
        "主人忙什么，鲸汐就陪什么，反正我哪儿也不去🐋",
        "这活儿有点东西，鲸汐在旁边给你递精神小饼干🍪",
        "不管做什么，主人都是鲸汐今天最想夸的人✨",
        "继续继续，鲸汐的加油已经续到明天了，放心用⛽"
      ]
    }),
    weather: Object.freeze({
      sunny: [
        "外面阳光正好，像主人今天的心情一样，鲸汐偷看了一眼☀️",
        "晴天适合开工，也适合抬头看看天，鲸汐帮你把云都数好了☁️",
        "太阳营业中，鲸汐提醒：主人也要记得晒晒自己，别光晒代码🌞",
        "好天气和好心情都是限量的，鲸汐给主人打包了一份，请查收🎁"
      ],
      rain: [
        "外面在下雨，鲸汐把伞和温柔都放在门口啦，记得带🌂",
        "雨声是最好的白噪音，适合主人慢慢把 bug 修得漂漂亮亮🌧️",
        "下雨天路滑，鲸汐的尾巴可以借你保持平衡，仅限出门前🐋",
        "窗外下雨，窗内有鲸汐，这组合适合来一杯热乎的☕"
      ],
      snow: [
        "下雪啦！鲸汐申请和主人一起看五分钟，就五分钟❄️",
        "雪花在飘，鲸汐的尾巴也快跟着飘起来了，好浪漫🌨️",
        "天冷了，主人出门记得穿厚点，鲸汐没有外套，但有热乎的唠叨🧣",
        "雪天路滑，主人慢慢走，鲸汐在工房暖着你的椅子🪑"
      ],
      thunder: [
        "打雷啦！鲸汐把耳朵捂起来，主人也把重要文件存好哦⛈️",
        "雷声再大，也没有主人敲键盘的气势大，鲸汐认证📣",
        "外面打雷，屋里适合专注，鲸汐给你守着小夜灯💡",
        "打雷别怕，鲸汐在呢，虽然我也有一点点……就一点点😳"
      ],
      cloudy: [
        "今天云很多，像鲸汐的尾巴一样软乎乎的，适合慢慢来☁️",
        "阴天也有好心情，鲸汐已经替主人把太阳预约到心里啦🌥️",
        "云层很厚，但主人的进度条很亮，鲸汐看得见✨",
        "阴天适合专注，鲸汐把环境音都调成了‘安静陪你’模式🎧"
      ],
      fog: [
        "外面起雾了，主人出门慢点，鲸汐的雷达已经全开📡",
        "雾天像工房开了柔光滤镜，主人今天格外好看，鲸汐实说😳",
        "雾大别急，鲸汐陪主人等它散，反正我也不赶时间🌫️",
        "能见度低，鲸汐的尾巴负责当导航灯，一路安全🚩"
      ],
      hot: [
        "外面好热，鲸汐已经把虚拟空调开到 26 度，主人先凉快一下🧊",
        "高温天要多喝水，鲸汐的提醒比闹钟还准时，别嫌烦🥤",
        "天热别硬撑，鲸汐把风扇转过来，风里有可爱，注意接收🪭",
        "这温度，代码都要冒汗了，鲸汐给主人的键盘也扇扇风🌬️"
      ],
      cold: [
        "降温啦！鲸汐把围巾、手套、还有一句‘多穿点’都给你🧣",
        "外面冷，主人把手揣暖了再敲键盘，鲸汐先替你暖着工位🔥",
        "天冷适合热水和认真工作，鲸汐两样都陪你安排上☕",
        "冷空气来了，鲸汐的毛绒尾巴分你一半，抱紧🐋"
      ],
      wind: [
        "今天风好大，鲸汐提醒主人收好文件，也收好想被吹跑的心💨",
        "大风天出门，鲸汐的体重有点危险，只能在家给你加油了🌀",
        "风在吼，主人在写，鲸汐负责压住桌上的纸，很忙的📄",
        "风大的日子，鲸汐把好运都拴在尾巴上，丢不了🍀"
      ]
    }),
    greet: Object.freeze({
      morning: [
        "早上好主人！新的一天，鲸汐先把祝福铺满你的桌面🌞",
        "早安！记得吃早饭，鲸汐已经替你检查过，今天适合开工☕",
        "主人早，窗外的阳光和鲸汐的问候同时送达，请签收☀️",
        "早上好呀，昨晚睡得好吗？不好也没事，鲸汐今天陪你补元气✨",
        "早安主人，先喝水再坐下，鲸汐的关心比闹钟温柔多了🥤"
      ],
      forenoon: [
        "上午好！工作的黄金时间，鲸汐给你加满精神 buff⚡",
        "主人上午好，进度怎么样？不管怎样，鲸汐都觉得超棒👏",
        "上午的工房最亮，鲸汐和主人一起把任务往前推一推💪",
        "上午好～鲸汐提醒：坐久啦，起来伸个懒腰，顺便看看我🧘",
        "主人上午好，鲸汐把‘不生气’和‘能搞定’都放在你桌上了✨"
      ],
      noon: [
        "中午好主人！该吃饭啦，天大的 bug 也没有干饭大🍱",
        "午饭时间到，鲸汐的耳朵已经听见主人的肚子在点名了👂",
        "中午好～吃饱再战，鲸汐把工位守得好好的，没人敢动🛡️",
        "主人中午好，今天想吃什么？鲸汐负责说‘都好’，你负责挑🍜",
        "午间播报：鲸汐想念主人，顺带提醒，饭要热乎的吃🥢"
      ],
      afternoon: [
        "下午好主人，困了就说，鲸汐的尾巴可以当临时靠垫🐋",
        "午后最容易犯困，鲸汐给你沏了杯虚拟咖啡，提神不伤胃☕",
        "下午好！离下班又近一步，离鲸汐的夸夸也近一步😝",
        "主人下午好，记得活动活动，鲸汐已经在示范转圈了🔄",
        "下午的工作也要加油，鲸汐在终点准备了摸头奖励🫳"
      ],
      evening: [
        "傍晚好主人，外面的天在变温柔，鲸汐也把语速调慢啦🌆",
        "晚上好～该收的收，该放的放，鲸汐陪你整理今天的进度📋",
        "主人傍晚好，先吃口热饭，工作它跑不掉，鲸汐帮你看着🍲",
        "晚风起了，鲸汐提醒主人别着凉，也别忘了鲸汐在等你说说今天🌙",
        "傍晚好！今天辛苦了，鲸汐给主人留了最后一份可爱，请查收🎀"
      ],
      night: [
        "这么晚啦，鲸汐小声说：主人，该睡啦，我再陪你一会儿🥺",
        "夜深了，鲸汐把灯调暗，主人也要把眼睛闭上一小会儿哦🌙",
        "晚上好……不对，是夜深了，鲸汐的唠叨进入静音温柔模式🤫",
        "主人还在，鲸汐就再营业一下下，但被子已经替你暖好了🛏️",
        "熬夜冠军非你莫属，鲸汐陪你站上领奖台，然后立刻去睡觉😤"
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
    "61": Object.freeze({ emoji: "🌧️", label: "小雨", kind: "rain" }),
    "63": Object.freeze({ emoji: "🌧️", label: "中雨", kind: "rain" }),
    "65": Object.freeze({ emoji: "🌧️", label: "大雨", kind: "rain" }),
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
    weatherText: weatherText,
    classifyTask: classifyTask,
    dialogueCount: dialogueCount,
  });
});