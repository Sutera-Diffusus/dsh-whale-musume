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
    idle: ["主人～今天想做什么呀？", "工房一切就绪，随时可以开工哦。"],
    waiting: ["点单吗？鲸汐已经准备好啦～"],
    thinking: ["正在打奶油……不对，是在认真思考～", "让鲸汐想想……尾巴都转起来了。"],
    tool: ["后厨开工！这单交给鲸汐～", "叮叮当当，工具转起来啦。"],
    success: ["叮！这炉烤好了！", "完成啦！请主人品尝～"],
    failure: ["呜……翻车了，鲸汐陪你一起修。", "别急别急，鲸汐再烤一次！"],
    curious: ["新订单？让我康康～", "主人换菜单了吗？"],
    teasing: ["主人认真工作的样子，很好看哦。", "偷偷给你加一颗糖～"],
    afk: ["鲸汐眯一会儿，有单就叫醒我～"]
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
    var r = typeof rng === "function" ? rng() : 1;
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
    else if (r < TEASE_CHANCE) state = "teasing";
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
    { id: "morning", words: ["早安", "早上好"] }
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
      morning: ["早啊主人，太阳都晒到尾巴了才来🌞", "主人早安！DS娘今天也是精神百倍😤", "早～再不起来我就把你的咖啡喝光啦☕", "早安主人，今天准备被命运怎么捶？", "早上好！先说好，今天不许摸鱼哦😏"],
      comeback: ["哟，还知道回来啊主人？😒", "主人消失这么久，是不是背着我吃好吃的去了🍰", "欢迎回来～我差点就要报警了📢", "哼，下次再失踪，好感度扣光光💢", "回来啦？你的工位都快长蘑菇了🍄"],
      nudge: ["主人，摸鱼被我抓包了哦😏", "手指停了十分钟，是在等我夸你发呆很帅吗🙄", "喂喂，订单还在排队呢，动起来💪", "这么安静，主人是卡机了还是睡着了🥱", "哼哼，偷懒的样子我已经截图存档了📸"],
      night: ["都几点了主人？你属猫头鹰的吗🦉", "月亮都下班了，你还不睡？😤", "深夜场开演～需要 DS娘给你讲睡前故事吗📖", "再熬夜，皮肤和头发都会抗议的哦✨", "主人，把命续到明天再战好不好🥺"],
      signin: ["滴！签到成功，今天也勉强算你勤奋👌", "签到 +1，主人距离全勤还差得远呢😏", "来了来了，奖励你一个嫌弃又不失礼貌的笑😊", "签到完成！主人要是忘了，我可不会提醒哦😝", "滴，打卡！今天也要被我盯着干活啦📋"],
      holiday: ["节日快乐主人！虽然你大概率还在加班🎉", "过节啦！允许你休息五分钟⏱️", "今天可是特别的日子，快说节日快乐！", "节日彩蛋：本 DS娘今日毒舌指数减半🎁", "过节还工作？主人是卷王本王吧👑"],
      idle: ["我在哦，有需要就喊一声，不喊也行😌", "主人忙你的，我负责可爱就好😇", "今天风很轻，适合把 bug 也吹跑🌬️", "待机中……电量 100%，可爱 120%🔋", "有事喊我，没事也可以看看我嘛👉👈"],
      afk: ["主人跑哪儿去了？把我一个人丢在这儿😾", "好安静……我宣布工房暂时归我管啦👑", "离开这么久，是去搬砖还是去偷吃？🍜", "主人不在，DS娘开启看家模式🐕", "再不回来，我就要给你的任务唱歌了🎤"],
      wake: ["回来啦！我刚好梦到你请我吃大餐🍽️", "揉揉眼睛，主人回来得真及时✨", "睡醒的 DS娘，吐槽能量满格！😤", "欢迎回来～最好带了手信哦🍩", "呀，被叫醒了！精神百倍，开干！💪"],
      levelup: ["升级啦！主人的爱有点东西嘛😏", "等级 +1，以后请继续好好养我🎀", "我们越来越默契了，主人也有功劳哦！", "升级礼花砰！奖励主人一次摸头资格🎆", "变强了！以后我罩着你，虽然不用交保护费😝"]
    }),
    work: Object.freeze({
      start: ["开工！让 DS娘看看今天的任务有多离谱📋", "新订单来啦，主人坐稳，看我操作✨", "开工开工！谁摸鱼谁是小狗🐶", "收到！这单要是完成不了，就怪我……的电脑😌", "任务来了，主人可别拖我后腿哦😏"],
      thinking: ["正在思考……别催，灵感不是外卖🚚", "嗯，这个问题有点东西，等我盘一盘🧠", "思考中！主人的眼神请不要太期待🙃", "我在认真想啦，尾巴都紧张得卷起来了🌀", "稍等，DS娘的脑袋正在全速冒烟中💨"],
      tool: ["工具转起来！这单交给本店……交给本 DS娘🔧", "后厨开工！主人请围观，别插手😏", "叮叮当当，工具上线，闲人退散🔨", "操作中！这速度主人跟得上吗⚡", "干活中，请勿投喂，除非是蛋糕🍰"],
      success: ["搞定！现在可以夸我了，限时五分钟👏", "完成！主人不给我加个鸡腿吗🍗", "漂亮收工～今天手感火热🔥", "成功啦！怎么样，我是不是超靠谱😎", "这单烤得刚刚好，主人快验收🎯"],
      failure: ["又双叒叕报错？主人是故意的吧🙄", "呜，翻车了……不过放心，我还能再翻一次💀", "小失误小失误，重来！气势不能输😤", "这个报错真会挑时候，我来治它👊", "主人别看了，我知道你在憋笑😾"],
      long: ["好长的一单，我先泡杯虚拟咖啡陪你☕", "长任务进行中，主人可以小睡，我盯着👀", "马拉松式任务，我们的口号是不猝死🏃", "这么久？这任务是想熬死两个人类吗🙃", "长活儿来了，幸好有我这个永动机⚙️"],
      gentle: ["好啦好啦，失败几次而已，我都不嫌弃你🥺", "慢慢来，主人，我在这儿陪你复盘📒", "连败不可怕，可怕的是主人怀疑人生😌", "休息一下，换个姿势，再战三百回合💪", "有我在呢，天塌下来我先跑，再回来救你😝"],
      erroragain: ["又报错了？这个错误是属狗皮膏药的吧💢", "错误连击！主人今天水逆，建议拜我🌊", "别慌，DS娘出马，错误退散✨", "哼，这报错专挑软柿子，我可不好惹😾", "再来！我跟你一起和它死磕到底🔨"],
      stream: ["内容正在流出来，像主人拖延的灵感一样汹涌🌊", "生成中，每个字都闪着智慧的光（大概）✨", "正在写呢，主人要不要先活动下颈椎🧘", "输出好长，我读得眼睛都圆了😳", "这波内容不错，主人问得有两下子👍"],
      doneall: ["全部清空！主人今天居然干完了😲", "收工收工！奖励主人休息，批准了🎉", "任务清零，DS娘鞠躬致谢🙇", "全部搞定！走，我们吃香的喝辣的🍜", "干得漂亮，主人今天的人设保住了😌"]
    }),
    interact: Object.freeze({
      pat: ["再摸？一次收费一个蛋糕，主人记好账🍰", "呜哇，主人的手好暖和……但别以为这样就能收买我😳", "摸头摸头，DS娘心情 +1，主人钱包 -1💸", "哼哼，最多三下，多一下我咬你哦😾", "舒服是舒服，可是发型会乱啦💢"],
      poke: ["戳什么戳，主人的手很闲嘛？💢", "呀！再戳我就在你的代码里藏彩蛋💥", "喂喂，脸要戳歪了，毁容你负责吗😤", "生气警告！好感度正在极速下跌📉", "戳一次心情 -1，主人是拆迁队的吧🧨"],
      feed: ["啊呜——好吃！主人偶尔也挺会做人的嘛🍩", "投喂成功！能量充满，吐槽继续💪", "这个点心我给满分，主人加十分🎖️", "好吃！以后请按这个标准来投喂😋", "谢谢主人的投喂，本 DS娘原谅你五分钟😌"],
      triple: ["诶嘿～最喜欢主人啦！说出口也不丢人😝", "转圈圈～今天主人超可爱，奖励比心💗", "三连击触发！DS娘心情直冲云霄🚀", "好开心！主人今天怎么这么会嘛🥰", "比心比心，请收好，掉了不补💌"],
      praise: ["哼，现在知道我的好了吧？😏", "被主人夸了，尾巴快摇成螺旋桨啦🚁", "再多夸两句，我考虑今天不毒舌你😌", "嘿嘿，DS娘最吃这一套了，主人很懂嘛🎯", "谢谢夸奖！作为回报，今天少吐槽一次😝"],
      mode: ["换形态啦！主人眼光还行，这个位置不错✨", "好哦，DS娘换个地方监督你👀", "新位置就位，请检阅，不许挑毛病😤", "形态切换成功，可爱程度不变😇", "这个角落归我啦，主人可别来挤😏"],
      outfit: ["新装饰！怎么样，是不是可爱到犯规🎀", "换上新行头，主人的审美终于在线了👌", "这件超适合我，奖励主人一个微笑😊", "衣柜上新，DS娘美美营业中💅", "嘿嘿，今天走这个风格，主人别太心动😏"],
      reset: ["记忆清零……主人居然舍得重置我🥺", "重置完成，从初识开始，请重新攻略我✨", "好，一切从头，这次可要好好珍惜我😤", "数值归零，但 DS娘还是那个 DS娘😌", "重新开始啦！先说好，头只给你摸三下😝"],
      achievement: ["成就达成！徽章 +1，主人的功劳占 1%🏅", "解锁成就啦！撒糖，虽然糖得主人买🍬", "新徽章到手！快看快看，记得鼓掌👏", "这个成就不容易，主人请客庆祝一下？🍹", "徽章墙更闪了，离被我惯坏又近一步😆"],
      drag: ["把我放这里？主人的品味忽高忽低的😏", "拖呀拖，DS娘任你摆布，但别放垃圾桶🗑️", "这里视野不错，就这儿啦，批准！", "哇，这个位置能看到主人摸鱼的全过程👀", "落位！以后这里就是我的专属领地啦🚩"]
    }),
    keyword: Object.freeze({
      thanks: ["不客气！记得给我加鸡腿🍗", "嘿嘿，主人的谢谢我收下了，很香😌"],
      tired: ["主人累了就歇会儿，天塌了我先撑着😤", "辛苦了！要不要我唱首走调的歌提神🎤"],
      hungry: ["饿了吧？快去吃饭，不然我吃你的点心🍜", "我也饿了……主人的饭分我一口不过分吧🥢"],
      goodnight: ["晚安主人，明天别赖床哦😴", "睡吧睡吧，DS娘会守好工房的🌙"],
      cheer: ["加油加油！主人的字典里没有放弃🎌", "冲鸭！今天也要让 bug 闻风丧胆💥"],
      help: ["我来啦！哪里需要 DS娘出马🦸", "别急别急，抱紧我的尾巴，先冷静😤"],
      praise: ["被主人夸了！今天可以横着走😎", "嘿嘿，尾巴翘高高，请继续，别停💕"]
    })
  });

  function dialogueCount() {
    var total = 0;
    for (var group in DIALOGUE) {
      for (var key in DIALOGUE[group]) total += DIALOGUE[group][key].length;
    }
    return total;
  }

  function pickDialogue(bank, event, counter, rng) {
    var lines = DIALOGUE[bank] && DIALOGUE[bank][event];
    if (!lines || lines.length === 0) return "";
    var r = typeof rng === "function" ? rng() : Math.random();
    return lines[(Math.abs(counter | 0) + Math.floor(r * 97)) % lines.length];
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
    dialogueCount: dialogueCount,
  });
});