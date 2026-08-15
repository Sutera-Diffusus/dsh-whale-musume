# DS娘 梗聊天 + 可爱对话 + 天气陪伴 设计

日期：2026-08-15
状态：已获用户确认，待写实现计划

## 1. 目标

在不破坏现有状态机、工作态稳定性（v1.0.2）的前提下，把 DS娘 的台词从约 190 条扩到约 500 条，并让她具备：

1. 大量安全梗 + 可爱风格对话（元气青梅人设保留：可撒娇、可吐槽、不冒犯）
2. 低频主动闲聊（每 5–8 分钟一次），且尽量贴当前任务阶段/内容，不尴尬
3. 分时段问候（早安/上午好/中午好/下午好/傍晚好/晚上好），带关心话
4. 接入 Open-Meteo 天气，设置面板可填城市、选填 API Key，并有“测试连接”按钮

## 2. 用户已确认的决策

- 方案 A：就地扩容 `whale-moe-core.js` 词库 + presenter 新组件，不新增脚本文件
- 台词总量约 500 条；可爱为主 + 安全梗（不碰政治、歧视、争议梗）
- 天气位置：设置里手填城市；默认空 = 完全不联网
- 天气呈现：30–60 分钟查一次，待机闲聊时自然插入 + 偶发气泡；工作时不插嘴
- 主动闲聊：每 5–8 分钟一次；本地读任务文本做话题分类（只匹配关键词，绝不上传）
- 问候：>3 小时一次；配合天气变体；23:00–05:00 不主动打扰
- 设置面板必须有：城市输入框、API Key 输入框（选填）、测试连接按钮

## 3. 天气 API

主选 Open-Meteo（免费、无需 key、CORS 可用）：

- 地理编码：`https://geocoding-api.open-meteo.com/v1/search?name={城市}&count=1&language=zh&format=json`
- 天气：`https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
- 填了 API Key：在以上请求附加 `&apikey={key}`；无 key 正常走免费档
- 免费非商业额度对 30–60 分钟一次轮询绰绰有余

隐私：仅向 Open-Meteo 发送城市名/经纬度；任务文本、聊天记录永不外传。
任务话题分类只在本机浏览器内存中匹配关键词，用完即弃。

## 4. 架构与模块边界

### 4.1 whale-moe-core.js（纯逻辑，无 DOM/网络）

- 词库扩至约 500 条：
  - `LINES`：状态台词，每状态 4–6 条（约 70）
  - `DIALOGUE.daily`（约 110）、`work`（约 90）、`interact`（约 80）
  - `DIALOGUE.keyword`（约 60，含新梗关键词组）
  - `DIALOGUE.meme`（约 70，12 组：打工人/摸鱼/DDL/画饼/摆烂/发疯文学/立 flag/bug 玄学等）
  - `DIALOGUE.context`（约 30：code/write/research/bug/data/deploy/general）
  - `DIALOGUE.weather`（约 30：晴/雨/雪/雷/大风/降温/升温/高温/阴/雾）
  - `DIALOGUE.greet`（约 30：6 个时间桶 × 5+，每条带关心）
- 新增导出：
  - `pickDialogueAvoidRecent(bank, event, counter, rng, recent)`：防重复选取器，优先避开 `recent` 中最近 N 条；不破坏现有 `pickDialogue`
  - `greetBucket(hour)`：6 个时间桶 = 早上 6:00–8:59 / 上午 9:00–11:59 / 中午 12:00–13:59 / 下午 14:00–17:59 / 傍晚 18:00–22:59 / 深夜 23:00–5:59（深夜不主动问候，只被动回应）
  - `weatherText(code)`：Open-Meteo WMO weather_code → `{ emoji, label, kind }` 映射（kind: sunny/rain/snow/thunder/wind/hot/cold/cloudy/fog）
  - `classifyTask(text)`：本地关键词分类 → `code/write/research/bug/data/deploy/general`
  - 保留 `TEASE_CHANCE` 导出占位兼容，但状态机已不随机 teasing

### 4.2 dsh-whale-moe.js（presenter，DOM/网络/调度）

- `WeatherService`：
  - `city` / `apiKey` 存在 `whale-moe:weatherCity` / `whale-moe:weatherKey`
  - 缓存城市坐标与天气，天气数据 2 小时过期
  - 30–60 分钟刷新一次；失败退避 60 分钟；测试按钮独立实时请求
  - 不主动弹任何窗口，只在设置面板与气泡里呈现
- `IdleChatScheduler`：
  - 每 5–8 分钟（随机）评估一次，仅 `state === idle`、气泡空闲、宠物开启、非设置页时说话
  - 选句优先级：问候/天气变化 > 任务阶段与内容贴题 > 通用可爱/梗
  - 工作态不插嘴；错过顺延
- `TaskTopicProbe`：
  - 复用现有关键词扫描的时机（聊天文本变化时，本地）
  - 只匹配分类词表，产出 `context` 分类；不存文本
- 问候：
  - 打开应用/签到后若距上次问候 >3 小时，且不在 23:00–05:00 主动区间，问候一次
  - 23:00–05:00 只在用户互动/发言后回一句“早点睡”式关心
- 设置面板（`apply-theme.mjs` 注入 React 部分）：
  - “天气”区块：城市文本框、API Key 密码框、测试连接按钮
  - 测试结果状态（✅/❌ + 文案）常驻显示，不自动消失
  - 无城市 = 不请求任何天气接口

## 5. 数据流

1. 用户设置城市 → `WeatherService.save()` → 地理编码 → 缓存坐标
2. 定时器/问候触发 → `WeatherService.getWeather()` → core 的 `weatherText(code)` 选模板
3. `IdleChatScheduler` 组合优先级：问候 > 天气变化 > 任务分类/阶段 > 通用
4. `showLine()` 沿用现有气泡展示；气泡占用时丢弃或顺延，不打断现有动效

## 6. 失败与降级

- 网络失败：静默重试 1 次 → 退避 60 分钟
- 城市无效/无结果：面板显示“未找到城市”，不反复请求
- API Key 无效：自动退回无 key 请求；再失败静默
- 天气过期：不硬聊天气，退到通用句
- 所有天气功能失败都不得影响看板娘本体与工作态

## 7. 测试与验收

1. 单元测试：
   - 防重复选取器不连续重复
   - `greetBucket` 各边界（5:59/6:00/8:59/9:00/11:59/12:00/13:59/14:00/17:59/18:00/22:59/23:00）
   - WMO weather_code 映射覆盖常见码（0,1,2,3,45,48,51,61,63,65,71,73,75,80,81,82,95,96,99）
   - `classifyTask` 对 code/write/research/bug/data/deploy/general 样例
   - 词库总量 ≥ 480，各分组不低于设计下限
2. CDP：
   - 设置面板出现城市/API Key/测试按钮
   - 天气关闭时 `fetch` 计数为 0
   - 测试按钮：真实请求 Open-Meteo 成功或明确失败展示；用测试钩子可注入 mock
   - 主动闲聊计时器存在、间隔落在 5–8 分钟区间；测试钩子可快进
   - 问候不打扰区间（23:00–05:00）不主动说话
3. 回归：
   - 现有 CDP 58 项、motion QA、soak-work、37 项单元测试全部保持绿色
   - 工作态稳定规则不变：忙时不闲聊、不切姿势、信号保持逻辑不被改动
4. 人工验收：
   - 真机填“上海”，测试连接显示 ✅；问候/闲聊里出现带天气的关心句

## 8. 明确不做

- 不做主题换肤、衣柜
- 不做多城市/天气卡片独立 UI
- 不新增脚本文件、不引入 npm 依赖
- 不让天气/闲聊在工作态抢话或切换姿势
- 不碰政治、歧视、争议梗
