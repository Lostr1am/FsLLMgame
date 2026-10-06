window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   数据层 · 依据《无畏契约职业选手人生模拟器·全设定规则书 v2.3》
   与《现实选手人物卡总评表（2025 队伍名单）》重建
   —— 属性/总评（第7章·附录N）· 定位权重 · 五档难度（2.1）
   —— 天赋觉醒 1d100 品质概率（8.2）· 体质（8.3）· 时间线（1.9）
   —— 俱乐部事实一律取附录Q · 人物取第25章 · 特工/地图取第35章口径
   ═══════════════════════════════════════════════════════════════ */
ES.data = (function () {
  'use strict';

  /* ── 多维属性（8.4，0—100） ── */
  const ATTRS = [
    { k: 'aim', name: '枪法', icon: 'target', group: 'rated', desc: '瞄准、预瞄、跟枪、爆头率——对枪判定的核心' },
    { k: 'reaction', name: '反应', icon: 'bolt', group: 'rated', desc: '反应速度、急停、闪身枪——先手判定的核心' },
    { k: 'gameSense', name: '意识', icon: 'compass', group: 'rated', desc: '地图阅读、信息处理、残局决策、战术理解' },
    { k: 'mentality', name: '心态', icon: 'mind', group: 'rated', desc: '抗压、逆风局表现、关键局发挥' },
    { k: 'comms', name: '沟通', icon: 'headset', group: 'rated', desc: '语音交流、指挥能力、团队氛围带动' },
    { k: 'movement', name: '身法', icon: 'pulse', group: 'support', desc: '走位、跳射、道具投掷手法（参与对枪判定，不入总评）' },
    { k: 'stamina', name: '体能', icon: 'flame', group: 'support', desc: '久坐耐受、训练时长上限、伤病恢复速度' },
    { k: 'charisma', name: '魅力', icon: 'heart', group: 'support', desc: '形象管理、粉丝吸引力、商业价值' },
    { k: 'insight', name: '悟性', icon: 'cpu', group: 'support', desc: '学习能力、版本适应、新特工领悟速度' },
    { k: 'luck', name: '气运', icon: 'sparkle', group: 'luck', desc: '随机事件吉凶加权、机缘触发权重（不入总评）' }
  ];

  /* ── 四大定位与位置权重（7.2 / N.1） ── */
  const POSITIONS = [
    {
      id: 'duelist', name: '决斗者', icon: 'sword', short: 'DUE',
      weights: { aim: 0.35, reaction: 0.30, gameSense: 0.15, mentality: 0.15, comms: 0.05 },
      key: ['aim', 'reaction'],
      agents: ['捷风', '雷兹', '不死鸟', '芮娜', '夜露', '霓虹', '壹决'],
      desc: '突破尖兵，枪法为王的代名词。首杀开路、正面交火、残局收割。',
      tag: '高光位 · 舆论放大镜'
    },
    {
      id: 'initiator', name: '先锋', icon: 'bolt', short: 'INI',
      weights: { aim: 0.20, reaction: 0.15, gameSense: 0.30, mentality: 0.15, comms: 0.20 },
      key: ['gameSense', 'comms'],
      agents: ['铁臂', '猎枭', '斯凯', 'K/O', '黑梦', '盖可'],
      desc: '开团发动机。信息侦察、控制敌人、为队伍创造进攻时机。',
      tag: '时机位 · 道具熟练度决定进攻质量'
    },
    {
      id: 'controller', name: '控场', icon: 'layers', short: 'CTL',
      weights: { aim: 0.15, reaction: 0.10, gameSense: 0.35, mentality: 0.15, comms: 0.25 },
      key: ['gameSense', 'comms'],
      agents: ['幽影', '炼狱', '蝰蛇', '星礈', '海神', '钛狐'],
      desc: '战术核心，烟位大师。烟幕封锁、区域控制、地形分割。',
      tag: '大脑位 · 站位与烟位管理是队伍灵魂'
    },
    {
      id: 'sentinel', name: '哨卫', icon: 'shield', short: 'SEN',
      weights: { aim: 0.20, reaction: 0.15, gameSense: 0.30, mentality: 0.25, comms: 0.10 },
      key: ['gameSense', 'mentality'],
      agents: ['贤者', '零', '奇乐', '尚勃勒', '钢锁', '暮蝶', '维斯', '幻棱', '迷核', '禁灭'],
      desc: '防守壁垒。据点防守、信息预警、拖延时间、反打。',
      tag: '下限位 · 纪律与残局处理定成败'
    }
  ];

  /* ── 五档难度（2.1） ── */
  const DIFFICULTIES = [
    {
      id: 'chosen', name: '天选之人', tier: '1 · 豪门直系', icon: 'crown',
      tagline: '出身电竞豪门直系培养，气运 90',
      desc: '俱乐部青训营种子名额 / 电竞世家二代 / 职业选手之子。资源、庇护与人脉从一开始就在你这边——代价是所有人都在等你兑现天赋。',
      mods: {
        luck: 90, rerolls: 2, ovrMin: 70, ovrMax: 74, money: 100000,
        trainMul: 1.30, luckWeight: 2, breakthrough: 30, envBase: 'top', fansMul: 1.6
      },
      pros: ['初始总评 70—74', '气运 90 · 机缘权重翻倍', '天赋可重掷 +2 次', '启动资金 10 万元', '训练收益 +30%', '突破检定 +30'],
      cons: ['背负俱乐部与家族期望', '队内竞争最激烈', '舆论放大镜：失误即被质疑'],
      sigil: 4, cheat: false
    },
    {
      id: 'easy', name: '简单', tier: '2 · 标准少年', icon: 'shield',
      tagline: '出身随机，气运 60',
      desc: '普通家庭 / 小镇青年 / 网吧常客 / 普通学生。一套基础外设、一份普通青训试训邀请，剩下全靠自己。',
      mods: {
        luck: 60, rerolls: 1, ovrMin: 62, ovrMax: 66, money: 20000,
        trainMul: 1.0, luckWeight: 1, breakthrough: 10, envBase: 'normal', fansMul: 1.0
      },
      pros: ['初始总评 62—66', '气运 60 · 标准机缘', '天赋可重掷 1 次', '启动资金 2 万元', '训练收益 +0%', '突破检定 +10'],
      cons: ['无额外庇护', '试训与合同需自己争取'],
      sigil: 3, cheat: false
    },
    {
      id: 'hard', name: '困难', tier: '3 · 灾劫缠身', icon: 'flame',
      tagline: '贫寒、单亲、辍学、手部旧伤、家人反对',
      desc: '你身上至少压着两件事：缺钱、家人争吵、伤病隐患或是住宿问题。没有青训邀请，只能自己敲开每一扇门。',
      mods: {
        luck: 35, rerolls: 0, ovrMin: 52, ovrMax: 56, money: 5000,
        trainMul: 0.90, luckWeight: 1, breakthrough: -20, envBase: 'rent', fansMul: 0.8
      },
      pros: ['每突破一个等级铸「逆命根基」：同级之内难有对手', '等级突破时奖金与关注翻倍', '比赛状态上限更高'],
      cons: ['初始总评 52—56', '气运 35 · 无重掷', '训练收益 -10%', '每三回合至少一次现实阻力事件'],
      sigil: 2, cheat: false
    },
    {
      id: 'hell', name: '地狱', tier: '4 · 极端困境', icon: 'warn',
      tagline: '重病、重度手伤、负债、被全网黑、被逐出青训',
      desc: '你独居地下室，用网吧公用键鼠。所有俱乐部都把你列在观察名单上——不是你挑队伍，是没有人要你。',
      mods: {
        luck: 15, rerolls: 0, ovrMin: 40, ovrMax: 44, money: 1000,
        trainMul: 0.80, luckWeight: 1, breakthrough: -40, envBase: 'netcafe', fansMul: 0.5
      },
      pros: ['每突破一个等级铸「地狱根基」：大赛关键局状态加成极高', '站上世界赛场后，概率性判定获得「逆袭光环」'],
      cons: ['初始总评 40—44', '气运 15 · 无重掷', '训练收益 -20%', '每两回合至少一次生存危机', '退役即终局，不可重开'],
      sigil: 1, cheat: false
    },
    {
      id: 'cheat', name: '作弊模式', tier: 'X · 不推荐', icon: 'terminal',
      tagline: '开启作弊菜单，本次所有成就标记「作弊获得」',
      desc: '无限元、任意总评、无敌状态、直接获得世界冠军、任意物品、跳过剧情。大幅降低难度与成就感；一旦开启不可关闭。',
      mods: {
        luck: 99, rerolls: 3, ovrMin: 60, ovrMax: 99, money: 9999999,
        trainMul: 2.0, luckWeight: 3, breakthrough: 95, envBase: 'top', fansMul: 3
      },
      pros: ['任意总评（60—99 任选）', '无限元 · 全属性可调', '突破检定近乎必成'],
      cons: ['所有成就标记「作弊获得」', '不参与正常结局评定', '失去挑战与成就感'],
      sigil: 5, cheat: true
    }
  ];

  /* ── 双模式（2.2） ── */
  const MODES = [
    {
      id: 'legend', name: '原著传奇', icon: 'scroll', badge: '扮演现实传奇',
      tagline: '重写一位已名留史册的选手剧本',
      desc: '以现实 VCT 职业圈的传奇选手为原型（以比赛 ID 与粉丝称呼出现），按其公开赛场形象设定天赋、总评、位置与关系网；命运走向完全由你决定。',
      pros: ['巅峰总评 90—96，自带荣誉与粉丝基本盘', '本命特工与打法风格已定型', '商业价值与人气起点极高'],
      cons: ['舆论期待锁定为「必须夺冠」', '粉丝流失惩罚更重', '年龄与版本更迭压力更大']
    },
    {
      id: 'custom', name: '自创角色', icon: 'mask', badge: '完全自定义',
      tagline: '从青训营一路打到世界之巅',
      desc: '姓名、ID、出身、天赋倾向、初始总评、本命特工、位置、地点、时间线全部由你决定；天赋品质由掷骰决定，不可自选。',
      pros: ['初始总评可在难度区间内自由取点', '天赋可重掷（按难度）', '属性成长空间最大', '结局分支最多'],
      cons: ['早期资源与人气偏低', '需要自己争取试训与合同', '更容易被忽视与雪藏']
    }
  ];

  /* ── 可扮演传奇选手（25.1 传奇选手库） ── */
  const LEGENDS = [
    {
      id: 'zmjjkk', name: '大明星 · 康康', short: 'ZmjjKK · EDG', icon: 'crown', role: '决斗者', positionId: 'duelist',
      agent: '捷风 / 霓虹 / 夜露 / 雷兹', peak: 96, honor: '2024 首尔全球冠军赛冠军 · 总决赛 MVP（单届 111 杀、26 次首杀）',
      desc: 'CN 赛区首位世界冠军与 MVP。少年气十足、自信张扬、赛场感染力极强，队内开心果。',
      attrs: { aim: 96, reaction: 95, gameSense: 88, mentality: 90, comms: 74, movement: 92, stamina: 80, charisma: 94, insight: 82, luck: 78 },
      tags: ['正 · 大心脏', '负 · 状态型选手'], item: '哥哥留下的旧鼠标垫',
      startCity: '上海', line: '从「带着哥哥的 ID 上赛场」到世界之巅；夺冠之后，版本与新人同时冲你来。'
    },
    {
      id: 'chichoo', name: '责任神 · 球球', short: 'CHICHOO · EDG', icon: 'shield', role: '哨卫', positionId: 'sentinel',
      agent: '奇乐 / 零 / 尚勃勒', peak: 93, honor: '2024 首尔全球冠军赛关键先生 · 「求神不如球神」',
      desc: '残局之王，逆风担当，圈内人缘极好；总在队伍最需要的时候打出奇迹残局。',
      attrs: { aim: 86, reaction: 82, gameSense: 94, mentality: 95, comms: 78, movement: 76, stamina: 82, charisma: 80, insight: 88, luck: 70 },
      tags: ['正 · 残局之神', '负 · 自嘲被调侃'], item: '用了三年的护腕',
      startCity: '重庆', line: '「残局之神」的光环与压力同时落在你一个人身上。'
    },
    {
      id: 'smoggy', name: '昭武帝 · 烟熏哥', short: 'Smoggy · EDG', icon: 'flame', role: '先锋', positionId: 'initiator',
      agent: '雷兹 / 钛狐 / 黑梦', peak: 91, honor: '2024 首尔全球冠军赛冠军成员 · 特定地图的中流砥柱',
      desc: '冷面杀手、场上收割机，私下反差可爱。与康康组成「赛场双子星」。',
      attrs: { aim: 90, reaction: 88, gameSense: 86, mentality: 88, comms: 70, movement: 84, stamina: 80, charisma: 78, insight: 84, luck: 68 },
      tags: ['正 · 战场收割', '负 · 情绪内敛'], item: '一副镜片磨花的旧眼镜',
      startCity: '西安', line: '冠军阵容的每一块拼图，都在关键时刻闪光——而你习惯不说话。'
    },
    {
      id: 'nobody', name: '小人物 · 王哥', short: 'nobody · EDG', icon: 'link', role: '先锋', positionId: 'initiator',
      agent: 'K/O / 钛狐 / 黑梦', peak: 90, honor: '2024 首尔全球冠军赛冠军成员 · 队内指挥（IGL）',
      desc: 'ID 意为「小人物」，期许自己从无名之辈成为闪光的主角。沉稳老练、任劳任怨，天生的团队粘合剂。',
      attrs: { aim: 82, reaction: 80, gameSense: 92, mentality: 92, comms: 96, movement: 76, stamina: 82, charisma: 74, insight: 90, luck: 66 },
      tags: ['正 · 团队之魂', '负 · 个人高光较少'], item: '写满战术的旧笔记本',
      startCity: '上海', line: '指挥位的新老传承：从「无名之辈」到世界冠军指挥。'
    },
    {
      id: 'whzy', name: 'FMVP · 王昊哲', short: 'whzy · BLG', icon: 'star', role: '决斗者', positionId: 'duelist',
      agent: '霓虹 / 雷兹 / 夜露 / 捷风', peak: 92, honor: '2025 VCT CN 年度总冠军核心 · 总决赛 FMVP',
      desc: '专注自律、比赛型选手、大心脏。从青训一步步打到年度 FMVP，BLG 冠军王朝的箭头。',
      attrs: { aim: 92, reaction: 90, gameSense: 86, mentality: 90, comms: 72, movement: 86, stamina: 84, charisma: 90, insight: 84, luck: 72 },
      tags: ['正 · 大赛发挥', '负 · 慢热'], item: '青训时期的第一副耳机',
      startCity: '广州', line: 'FMVP 的舆论双刃剑：所有人都记得你拿过什么，也等着你失手。'
    },
    {
      id: 'boaster', name: '老队长 · Boaster', short: 'Boaster · Fnatic', icon: 'mask', role: '控场', positionId: 'controller',
      agent: '幽影 / 炼狱 / 星礈', peak: 94, honor: '多届全球冠军赛决赛 · 电竞圈最受尊敬的指挥之一',
      desc: '话痨、热情、领袖魅力。电竞圈最受尊敬的指挥之一，也是「最后一舞」的执念本身。',
      attrs: { aim: 78, reaction: 74, gameSense: 96, mentality: 94, comms: 98, movement: 70, stamina: 84, charisma: 96, insight: 94, luck: 74 },
      tags: ['正 · 领袖魅力', '负 · 冠军执念'], item: '写满对手习惯的战术本',
      startCity: '伦敦', line: '欧洲荣耀的守护者：你的坚持贯穿好几个赛季，而时间从不等人。'
    },
    {
      id: 'tenz', name: '北美传奇 · TenZ', short: 'TenZ · Sentinels', icon: 'sparkle', role: '决斗者', positionId: 'duelist',
      agent: '捷风专精', peak: 94, honor: '2021 雷克雅未克大师赛冠军与 MVP · 北美第一位超级明星',
      desc: '天才专注、私下温柔、赛场冷静。北美商业电竞的符号人物。',
      attrs: { aim: 94, reaction: 93, gameSense: 82, mentality: 84, comms: 70, movement: 90, stamina: 76, charisma: 98, insight: 80, luck: 82 },
      tags: ['正 · 天赋异禀', '负 · 版本适应'], item: '第一块冠军奖牌',
      startCity: '洛杉矶', line: '天才如何对抗版本与时间——这题没有正确答案。'
    },
    {
      id: 'aspas', name: '南美之星 · 阿斯帕斯', short: 'aspas · MIBR', icon: 'sword', role: '决斗者', positionId: 'duelist',
      agent: '捷风专精', peak: 95, honor: '2024 全球冠军赛季军 · 南美赛区旗帜',
      desc: '奔放自信、赛场张扬、重情重义。以凶悍的捷风打法闻名世界。',
      attrs: { aim: 95, reaction: 94, gameSense: 84, mentality: 82, comms: 66, movement: 90, stamina: 82, charisma: 88, insight: 78, luck: 76 },
      tags: ['正 · 捷风之王', '负 · 情绪化'], item: '家乡球队的旧围巾',
      startCity: '圣保罗', line: '南美电竞崛起的代表，也是漂泊与成长的样本。'
    }
  ];

  /* ── 出身（2.2.3 出身自定义表） ── */
  const ORIGINS = [
    {
      id: 'academy', name: '电竞豪门青训种子', icon: 'building', tier: '体系内',
      tagline: '顶级俱乐部青训营重点培养对象',
      desc: '你在最顶级的赛训体系里长大：教练、分析师、心理师、理疗师一应俱全。代价是从未被允许失败过一次。',
      money: 120000, fans: 3,
      attrs: { aim: 58, reaction: 56, gameSense: 62, mentality: 48, comms: 60, movement: 54, stamina: 58, charisma: 52, insight: 60, luck: 0 },
      res: { condition: 78, hand: 90 },
      perks: ['俱乐部青训合同（年薪 5—10 万）', '顶级基地：训练收益 ×1.25', '教练 / 分析 / 心理 / 理疗全套资源', '初始总评额外 +2'],
      cons: ['心态稳定偏低（长期被规训）', '背负俱乐部期望与队内竞争', '舆论当你「体系产品」'],
      storyLine: '梯队晋升线：从替补席抢首发',
      ovrBonus: 2
    },
    {
      id: 'academy2', name: '中上俱乐部青训队员', icon: 'briefcase', tier: '体系内',
      tagline: '普通职业俱乐部青训营成员',
      desc: '资源一般，但有教练组指导，也有明确的晋升通道。你要做的是在一群同样努力的人里被记住。',
      money: 60000, fans: 1,
      attrs: { aim: 54, reaction: 52, gameSense: 58, mentality: 54, comms: 56, movement: 52, stamina: 56, charisma: 48, insight: 56, luck: 0 },
      res: { condition: 76, hand: 88 },
      perks: ['俱乐部基地：训练收益 ×1.15', '有教练组与训练赛资源', '试训机会更多'],
      cons: ['资源倾斜有限', '容易被一队借调又退回'],
      storyLine: '青训转正线：把「有机会」变成「有名额」',
      ovrBonus: 0
    },
    {
      id: 'netcafe', name: '网吧战神', icon: 'terminal', tier: '草根',
      tagline: '小城网吧常客，靠线下赛与擂台赛成名',
      desc: '没人教过你怎么打。你在几千场排位里自己悟出了一切，枪法野蛮、直觉惊人，但从没打过一场团队训练赛。',
      money: 9000, fans: 2,
      attrs: { aim: 66, reaction: 64, gameSense: 44, mentality: 58, comms: 40, movement: 60, stamina: 62, charisma: 44, insight: 46, luck: 0 },
      res: { condition: 74, hand: 80 },
      perks: ['枪法与反应天赋极高', '网吧机起步（训练收益 ×0.8），环境恶劣但抗压出众', '擂台赛与网吧联赛人脉'],
      cons: ['意识与沟通偏低', '无正经履历，试训易被拒', '设备与住宿条件是现实阻力'],
      storyLine: '草根逆袭线：从网吧联赛打到 VCT',
      ovrBonus: 0
    },
    {
      id: 'student', name: '学生出身', icon: 'note', tier: '校园',
      tagline: '普通高中 / 大学生，瞒着家人打游戏',
      desc: '你在教室与训练室之间来回奔跑。家人给你定了期限：一个赛季打不出来，就回去读书。',
      money: 15000, fans: 1,
      attrs: { aim: 52, reaction: 62, gameSense: 60, mentality: 60, comms: 54, movement: 50, stamina: 58, charisma: 50, insight: 70, luck: 0 },
      res: { condition: 78, hand: 92 },
      perks: ['年龄最小，反应与悟性最高', '属性上限更高（成长空间最大）', '学习能力强，版本适应快'],
      cons: ['家庭压力线：学业与训练冲突', '训练时长受限（每周预算 -8 小时）', '无俱乐部背景'],
      storyLine: '少年线：家庭、学业与梦想的三方拉扯',
      ovrBonus: 0
    },
    {
      id: 'grinder', name: '草根路人王', icon: 'chart', tier: '草根',
      tagline: '无俱乐部背景的排位路人王',
      desc: '你靠一己之力打到高总评，没有教练、没有队友、没有战术，只有一颗想赢的心和几千局的肌肉记忆。',
      money: 8000, fans: 4,
      attrs: { aim: 62, reaction: 60, gameSense: 52, mentality: 52, comms: 44, movement: 58, stamina: 60, charisma: 52, insight: 54, luck: 0 },
      res: { condition: 76, hand: 86 },
      perks: ['机缘触发权重 +50%（可塑性最强）', '排位声望高，容易被星探注意', '无合同束缚，签约自由'],
      cons: ['无体系训练，属性结构偏科', '团队配合经验几乎为零'],
      storyLine: '路人王线：被星探捡走，或者自己组队打上去',
      ovrBonus: 0
    },
    {
      id: 'esportfamily', name: '电竞世家出身', icon: 'crown', tier: '家庭',
      tagline: '父母或兄长是前职业选手 / 教练',
      desc: '你从小在训练室长大，听大人聊版本、聊态度、聊这一行的残酷。家庭给你人脉与指导，也给你压力。',
      money: 80000, fans: 6,
      attrs: { aim: 56, reaction: 54, gameSense: 66, mentality: 56, comms: 62, movement: 52, stamina: 56, charisma: 64, insight: 62, luck: 0 },
      res: { condition: 78, hand: 88 },
      perks: ['家庭人脉：试训与转会更容易', '开局有私人教练式指导', '初始粉丝来自父辈光环'],
      cons: ['背负家族期望：输了会很难看', '被质疑「靠关系」'],
      storyLine: '世家线：证明自己不是父辈的影子',
      ovrBonus: 1
    },
    {
      id: 'veteran', name: '复出老将', icon: 'hourglass', tier: '回归',
      tagline: '曾小有名气后退役 / 被开除，重新出发',
      desc: '你离开赛场两年，手上有旧伤，脑子里有体系。回来的时候，你已经不是当年的那个人了。',
      money: 260000, fans: 26,
      attrs: { aim: 62, reaction: 46, gameSense: 80, mentality: 80, comms: 76, movement: 54, stamina: 50, charisma: 66, insight: 76, luck: 0 },
      res: { condition: 64, hand: 52 },
      perks: ['意识 / 心态 / 沟通全面成熟，可直接担任指挥', '自带老粉基本盘与人气', '起步资金与合同谈判筹码足'],
      cons: ['手部健康仅 52，伤病风险高', '反应随年龄持续衰减', '舆论质疑「回来捞钱」'],
      storyLine: '复出线：向所有质疑你的人证明手还没废',
      ovrBonus: 1
    },
    {
      id: 'streamer', name: '主播 / 内容创作者', icon: 'video', tier: '流量',
      tagline: '靠直播与剪辑起家',
      desc: '你是平台头部主播，技术在线、粉丝狂热。有人说你只是内容选手，你决定用职业赛场回答他们。',
      money: 620000, fans: 42,
      attrs: { aim: 58, reaction: 58, gameSense: 52, mentality: 54, comms: 70, movement: 56, stamina: 60, charisma: 86, insight: 58, luck: 0 },
      res: { condition: 72, hand: 84 },
      perks: ['商业价值与人气极高（直播合同在手）', '粉丝忠诚度高，舆论护盾强', '商务代言机会多'],
      cons: ['直播义务占用训练时间（每周预算 -6 小时）', '教练与队友信任低，被质疑「玩票」', '口嗨事故风险'],
      storyLine: '正名线：把流量变成冠军',
      ovrBonus: 0
    },
    {
      id: 'wanted', name: '黑历史缠身', icon: 'warn', tier: '污点',
      tagline: '曾代打、曾开挂被封、曾卷入欠薪纠纷',
      desc: '你身上有标签，搜索引擎记得。要洗白，或者顶着骂名往前走——每一条路都得用成绩铺。',
      money: 3000, fans: 0,
      attrs: { aim: 60, reaction: 58, gameSense: 56, mentality: 66, comms: 48, movement: 54, stamina: 60, charisma: 40, insight: 54, luck: 0 },
      res: { condition: 70, hand: 82 },
      perks: ['心态在骂声中被锤炼得异常坚硬', '对舆论免疫度高于常人', '反黑经验丰富'],
      cons: ['各俱乐部列入观察名单', '黑粉威胁极高（初始 +35）', '商业价值与代言极难打开'],
      storyLine: '洗白线：用成绩把搜索记录压下去',
      ovrBonus: 0
    }
  ];

  /* ── 天赋方向（8.1 十大类） ── */
  const TALENT_DIRECTIONS = [
    { id: 'aim', name: '枪法', icon: 'target', desc: '瞄准、爆头率与对枪上限' },
    { id: 'reaction', name: '反应', icon: 'bolt', desc: '反应速度与先手能力' },
    { id: 'movement', name: '身法', icon: 'pulse', desc: '走位、闪身枪与道具手法' },
    { id: 'gameSense', name: '意识', icon: 'compass', desc: '地图阅读与残局决策' },
    { id: 'mentality', name: '心态', icon: 'mind', desc: '抗压、关键局与逆风' },
    { id: 'stamina', name: '体力', icon: 'flame', desc: '训练上限与伤病恢复' },
    { id: 'comms', name: '沟通', icon: 'headset', desc: '指挥、语音与团队氛围' },
    { id: 'charisma', name: '魅力', icon: 'heart', desc: '镜头感、粉丝与商业' },
    { id: 'insight', name: '悟性', icon: 'cpu', desc: '学习速度与版本适应' },
    { id: 'luck', name: '气运', icon: 'sparkle', desc: '机缘触发与随机吉凶' }
  ];

  /* ── 天赋品质（8.1 / 8.2 概率 40 / 30 / 18 / 9 / 3） ── */
  const QUALITIES = {
    white: { id: 'white', name: '普通', label: 'WHITE', pct: 40, mul: 1.0, cap: 85, points: 1, desc: '属性上限约 85' },
    green: { id: 'green', name: '优秀', label: 'GREEN', pct: 30, mul: 1.45, cap: 87, points: 2, desc: '属性上限约 87' },
    blue: { id: 'blue', name: '稀有', label: 'BLUE', pct: 18, mul: 1.95, cap: 89, points: 3, desc: '属性上限约 89' },
    purple: { id: 'purple', name: '史诗', label: 'PURPLE', pct: 9, mul: 2.6, cap: 92, points: 5, desc: '属性上限约 92' },
    gold: { id: 'gold', name: '传说', label: 'GOLD', pct: 3, mul: 3.5, cap: 96, points: 8, desc: '属性上限 95+，可冲击传奇' }
  };
  const QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold'];

  /* ── 体质（8.3，骰子小概率觉醒） ── */
  const BODIES = [
    { id: 'radiant', name: '辐能亲和体质', rarity: 'legend', pct: 2, icon: 'sparkle', desc: '反应上限极高（可达 99），但会被官方反作弊系统重点复核、被社区质疑「非人」。', eff: { reactionCap: 99, antiThreat: 12, luck: 5 } },
    { id: 'bigmatch', name: '比赛型选手', rarity: 'rare', pct: 6, icon: 'crown', desc: '越是大场面发挥越好：关键局与大赛判定 +3。', eff: { bigMatch: 3 } },
    { id: 'bigheart', name: '大心脏', rarity: 'rare', pct: 6, icon: 'heart', desc: '绝境逆风心态判定大幅加成：心态检定 +4，崩盘阈值下调。', eff: { mentality: 6, clutch: 4 } },
    { id: 'nightowl', name: '夜猫子体质', rarity: 'common', pct: 14, icon: 'moon', desc: '晚间训练收益高（+20%），早训收益低（-10%）。', eff: { nightTrain: 0.2 } },
    { id: 'frail', name: '易伤体质', rarity: 'uncommon', pct: 12, icon: 'warn', desc: '伤病风险翻倍，需要更谨慎地安排训练量。', eff: { injuryMul: 2 } },
    { id: 'dexterous', name: '巧手体质', rarity: 'rare', pct: 7, icon: 'hand', desc: '手指灵活度极高：枪法上限 +3，手部损耗 -20%。', eff: { aim: 3, handLoss: 0.8 } },
    { id: 'ironmind', name: '抗压免疫体', rarity: 'uncommon', pct: 10, icon: 'shield', desc: '网暴无效化：舆论事件对心态的冲击减半。', eff: { antiThreat: -8, pressShield: 0.5 } }
  ];

  /* ── 天赋池（按方向；品质倍率在 state 中放大） ── */
  const TALENTS = [
    { id: 'tl_aim_head', name: '爆头机器', direction: 'aim', icon: 'target', desc: '你的准星天生往头上走，爆头率常年高于同级别选手。', eff: { aim: 7, reaction: 2 } },
    { id: 'tl_aim_firstshot', name: '首枪统治', direction: 'aim', icon: 'sword', desc: '你几乎是每一次交火里先开枪并打中的那个人。', eff: { aim: 6, reaction: 3 } },
    { id: 'tl_aim_recoil', name: '压枪本能', direction: 'aim', icon: 'chart', desc: '连发弹道在你手里是一条直线。', eff: { aim: 5, movement: 3 } },
    { id: 'tl_react_instant', name: '瞬间反应', direction: 'reaction', icon: 'bolt', desc: '对手的开枪在你眼里是慢动作。', eff: { reaction: 8 } },
    { id: 'tl_react_predict', name: '预瞄点机器', direction: 'reaction', icon: 'target', desc: '你的准星永远提前停在对手要出现的位置。', eff: { reaction: 5, gameSense: 4 } },
    { id: 'tl_react_stop', name: '急停如钉', direction: 'reaction', icon: 'pulse', desc: '急停瞬间的枪法稳定性远超常人。', eff: { reaction: 5, aim: 4 } },
    { id: 'tl_move_jiggle', name: '身法鬼才', direction: 'movement', icon: 'pulse', desc: '你的走位让对手的对枪预瞄全部落空。', eff: { movement: 7, reaction: 2 } },
    { id: 'tl_move_util', name: '道具手法', direction: 'movement', icon: 'layers', desc: '技能投掷点位的精细度像被计算过。', eff: { movement: 4, gameSense: 5 } },
    { id: 'tl_move_jump', name: '跳跃奇袭', direction: 'movement', icon: 'trend-up', desc: '你总能用身法打出对手没准备的角度。', eff: { movement: 6, aim: 3 } },
    { id: 'tl_gs_read', name: '残局读秒', direction: 'gameSense', icon: 'clock', desc: '爆能器倒计时的每一秒都在你的脑子里。', eff: { gameSense: 7, mentality: 2 } },
    { id: 'tl_gs_info', name: '信息嗅觉', direction: 'gameSense', icon: 'compass', desc: '你从小地图里看出的东西比对手多两层。', eff: { gameSense: 6, comms: 3 } },
    { id: 'tl_gs_econ', name: '经济算盘', direction: 'gameSense', icon: 'coin', desc: '每一次保枪与强起，都在为三回合后的满配埋伏笔。', eff: { gameSense: 5, insight: 4 } },
    { id: 'tl_men_big', name: '大心脏', direction: 'mentality', icon: 'heart', desc: '满场嘘声里，你的手比训练室还稳。', eff: { mentality: 8 } },
    { id: 'tl_men_reverse', name: '逆风专注', direction: 'mentality', icon: 'trend-up', desc: '0:6 落后时，你的决策反而更清晰。', eff: { mentality: 5, gameSense: 3 } },
    { id: 'tl_men_clutch', name: '残局心态', direction: 'mentality', icon: 'target', desc: '1v2、1v3 的时候，你的心率反而更低。', eff: { mentality: 6, aim: 3 } },
    { id: 'tl_sta_engine', name: '铁人体质', direction: 'stamina', icon: 'flame', desc: '一天八张图的高强度训练对你只是日常。', eff: { stamina: 7 } },
    { id: 'tl_sta_recover', name: '快速恢复', direction: 'stamina', icon: 'med', desc: '你的肌肉与手腕恢复速度惊人，伤病恢复 +40%。', eff: { stamina: 5, hand: 4 } },
    { id: 'tl_sta_ironhand', name: '铁腕', direction: 'stamina', icon: 'hand', desc: '手部健康流失减半，长期高强度训练不易劳损。', eff: { stamina: 4, handLoss: -0.5 } },
    { id: 'tl_com_igl', name: '场上指挥', direction: 'comms', icon: 'headset', desc: '你的指令清晰到队友可以闭着眼执行。', eff: { comms: 8 } },
    { id: 'tl_com_hype', name: '气氛发动机', direction: 'comms', icon: 'sparkle', desc: '你在语音里的每一句话都能把队伍情绪拉起来。', eff: { comms: 5, mentality: 4 } },
    { id: 'tl_com_mediate', name: '队内黏合', direction: 'comms', icon: 'link', desc: '有你在，更衣室就不会散。', eff: { comms: 5, teammateTrust: 10 } },
    { id: 'tl_cha_camera', name: '镜头语言', direction: 'charisma', icon: 'video', desc: '你天生知道镜头在哪，采访从不需要稿子。', eff: { charisma: 8, fame: 6 } },
    { id: 'tl_cha_topic', name: '话题体质', direction: 'charisma', icon: 'flame', desc: '你说一句话，热搜就要挂一天。', eff: { charisma: 6, fame: 8, antiThreat: 5 } },
    { id: 'tl_cha_fans', name: '粉丝磁场', direction: 'charisma', icon: 'heart', desc: '你的应援团会跟着你转会。', eff: { charisma: 5, fanLoyalty: 12 } },
    { id: 'tl_ins_patch', name: '版本嗅觉', direction: 'insight', icon: 'layers', desc: '补丁公告发布前，你就已经在练下一个答案。', eff: { insight: 8, versionBonus: 8 } },
    { id: 'tl_ins_fast', name: '特工速成', direction: 'insight', icon: 'refresh', desc: '给你三天，你就能把新特工打进正式比赛。', eff: { insight: 6, gameSense: 2 } },
    { id: 'tl_ins_vod', name: '复盘机器', direction: 'insight', icon: 'cpu', desc: '你能背出对手最近 20 张图的站位习惯。', eff: { insight: 7, gameSense: 4 } },
    { id: 'tl_luck_destiny', name: '命运眷顾', direction: 'luck', icon: 'sparkle', desc: '你的机缘触发概率显著高于常人。', eff: { luck: 10 } },
    { id: 'tl_luck_timing', name: '时机之眼', direction: 'luck', icon: 'clock', desc: '关键时刻的骰子似乎总偏向你。', eff: { luck: 6, mentality: 3 } },
    { id: 'tl_luck_encounter', name: '贵人缘', direction: 'luck', icon: 'users', desc: '你总能在最需要的时候遇到愿意帮你的人。', eff: { luck: 7, charisma: 3 } }
  ];

  /* ── 中国城市（2.5 + 13.2） ── */
  const CITIES_CN = [
    { id: 'shanghai', name: '上海', region: 'CN · 电竞之都', icon: 'building', bars: { eco: 10, train: 10, net: 10, cost: 9 }, perk: 'T0 豪门总部聚集，国际赛事枢纽，试训机会最多', cons: '生活成本极高，竞争密度全赛区第一', attrs: { charisma: 4, insight: 3 }, res: { money: -3000 } },
    { id: 'beijing', name: '北京', region: 'CN · 首都', icon: 'building', bars: { eco: 9, train: 9, net: 9, cost: 9 }, perk: '政策资源与官方活动集中，JDG 基地在此', cons: '通勤与压力带来的状态消耗', attrs: { insight: 5 }, res: { condition: -4 } },
    { id: 'guangzhou', name: '广州', region: 'CN · 华南', icon: 'building', bars: { eco: 9, train: 9, net: 9, cost: 7 }, perk: 'BLG 所在地，直播基因强，青训与造星体系成熟', cons: '商业化氛围重，容易被安排过多商务', attrs: { charisma: 6 }, res: { money: -1000 } },
    { id: 'chengdu', name: '成都', region: 'CN · 西南', icon: 'building', bars: { eco: 8, train: 8, net: 8, cost: 5 }, perk: '直播之都，AG 主场；生活安逸，状态恢复 +15%', cons: '训练强度与舆论压力较小，成长略慢', attrs: { mentality: 6, stamina: 4 }, res: { condition: 6, money: 2000 } },
    { id: 'hangzhou', name: '杭州', region: 'CN · 华东', icon: 'building', bars: { eco: 9, train: 9, net: 9, cost: 7 }, perk: '电竞产业园与赛事运营公司聚集，商务与内容资源顶级', cons: '商务活动挤占训练时间', attrs: { charisma: 7 }, res: { condition: -4 } },
    { id: 'changsha', name: '长沙', region: 'CN · 华中', icon: 'building', bars: { eco: 7, train: 8, net: 8, cost: 5 }, perk: '新兴电竞城，多家 T2 战队基地，上升通道多', cons: '顶级资源少，天花板偏低', attrs: { comms: 4 }, res: { money: 1500 } },
    { id: 'shenzhen', name: '深圳', region: 'CN · 硬件之都', icon: 'building', bars: { eco: 9, train: 9, net: 10, cost: 9 }, perk: '外设厂商总部云集，装备与外设赞助资源顶级', cons: '节奏快、竞争残酷', attrs: { aim: 4, charisma: 3 }, res: { condition: -3 } },
    { id: 'wuhan', name: '武汉', region: 'CN · 九省通衢', icon: 'building', bars: { eco: 7, train: 8, net: 8, cost: 5 }, perk: '高校电竞氛围浓厚，青训苗子多，团队氛围好', cons: '薪资水平中等', attrs: { comms: 5 }, res: { money: 1500 } },
    { id: 'xian', name: '西安', region: 'CN · 西北', icon: 'building', bars: { eco: 6, train: 7, net: 8, cost: 4 }, perk: 'XLG 所在地，成本低、队伍稳定，适合长期打磨', cons: '曝光度低，商业价值增长缓慢', attrs: { stamina: 5, charisma: -3 }, res: { money: 3000 } },
    { id: 'chongqing', name: '重庆', region: 'CN · 山城', icon: 'building', bars: { eco: 7, train: 7, net: 8, cost: 4 }, perk: '狼队主场，草根联赛火热，粉丝氛围狂热', cons: '联赛资源相对有限', attrs: { charisma: 3 }, res: { money: 2000 } },
    { id: 'yaan', name: '雅安', region: 'CN · 小城', icon: 'building', bars: { eco: 3, train: 5, net: 7, cost: 2 }, perk: '网吧联赛与熊猫之乡，草根天才的起点；生活成本极低', cons: '几乎没有俱乐部资源，一切从零开始', attrs: { mentality: 5, luck: 4 }, res: { money: 4000 } },
    { id: 'harbin', name: '哈尔滨', region: 'CN · 东北', icon: 'building', bars: { eco: 4, train: 6, net: 7, cost: 3 }, perk: '冰城网吧文化深，冬季长时间闭关训练收益 +10%', cons: '远离赛区中心，转会与试训不便', attrs: { stamina: 4 }, res: { money: 2500 } },
    { id: 'qingdao', name: '青岛', region: 'CN · 沿海', icon: 'building', bars: { eco: 6, train: 7, net: 9, cost: 6 }, perk: '网络条件优秀，外设与网吧产业发达', cons: '赛训体系薄，缺少高水平训练赛', attrs: { aim: 3 }, res: { money: 1000 } },
    { id: 'xiamen', name: '厦门', region: 'CN · 沿海', icon: 'building', bars: { eco: 6, train: 7, net: 9, cost: 7 }, perk: '宜居城市，心态与状态恢复好，商务活动适中', cons: '电竞生态体量小', attrs: { mentality: 4 }, res: { condition: 4 } },
    { id: 'kunming', name: '昆明', region: 'CN · 西南', icon: 'building', bars: { eco: 4, train: 6, net: 7, cost: 3 }, perk: '气候宜人，体能训练与高原适应加成', cons: '信息滞后，版本理解慢半拍', attrs: { stamina: 6, insight: -3 }, res: { money: 2500 } }
  ];

  /* ── 全球电竞城市（2.5 + 13.2） ── */
  const CITIES_GLOBAL = [
    { id: 'seoul', name: '首尔', region: 'KR · 太平洋赛区', icon: 'globe', bars: { eco: 10, train: 10, net: 9, cost: 8 }, perk: '韩式魔鬼训练营传统，纪律与赛训体系全球顶级，意识 +8', cons: '辈分文化与语言关，心理负担重', attrs: { gameSense: 6, insight: 6, comms: -6 }, res: { condition: -6 } },
    { id: 'losangeles', name: '洛杉矶', region: 'US · 美洲赛区', icon: 'globe', bars: { eco: 9, train: 6, net: 8, cost: 10 }, perk: 'Sentinels 与娱乐资本中心，商业价值与曝光顶级', cons: '训练强度低，竞技成长缓慢', attrs: { charisma: 8, stamina: -3 }, res: { money: 12000 } },
    { id: 'london', name: '伦敦', region: 'UK · EMEA 赛区', icon: 'globe', bars: { eco: 8, train: 9, net: 9, cost: 8 }, perk: 'Fnatic 训练中心所在地，欧式体系与团队纪律严谨', cons: '天气与孤独感影响状态', attrs: { gameSense: 5, comms: 5 }, res: { condition: -3 } },
    { id: 'berlin', name: '柏林', region: 'DE · EMEA 赛区', icon: 'globe', bars: { eco: 8, train: 8, net: 9, cost: 6 }, perk: '电竞展会之都，数据分析与版本理解 +10', cons: '强度偏佛系，个人枪法提升有限', attrs: { insight: 8 }, res: { money: 4000 } },
    { id: 'paris', name: '巴黎', region: 'FR · EMEA 赛区', icon: 'globe', bars: { eco: 8, train: 7, net: 8, cost: 9 }, perk: '时尚与电竞跨界，商务代言资源丰富', cons: '商业化干扰训练节奏', attrs: { charisma: 7 }, res: { condition: -4 } },
    { id: 'tokyo', name: '东京', region: 'JP · 太平洋赛区', icon: 'globe', bars: { eco: 9, train: 8, net: 9, cost: 10 }, perk: 'ZETA 秋叶原电竞馆；细节与专注度 +10，外设资源顶级', cons: '生活成本最高，孤独感强烈', attrs: { aim: 5, insight: 4 }, res: { money: -6000, condition: -6 } },
    { id: 'singapore', name: '新加坡', region: 'SG · 太平洋赛区', icon: 'globe', bars: { eco: 8, train: 8, net: 10, cost: 8 }, perk: 'PRX 与东南亚枢纽，国际赛事频繁，英语环境利于跨赛区', cons: '赛区体量小，本土联赛强度有限', attrs: { comms: 5, insight: 4 }, res: { money: 2000 } },
    { id: 'bangkok', name: '曼谷', region: 'TH · 太平洋赛区', icon: 'globe', bars: { eco: 6, train: 7, net: 7, cost: 4 }, perk: '东南亚电竞新贵，快乐电竞氛围，粉丝热情', cons: '基础设施与薪资水平一般', attrs: { mentality: 5 }, res: { money: 1000 } },
    { id: 'saopaulo', name: '圣保罗', region: 'BR · 美洲赛区', icon: 'globe', bars: { eco: 6, train: 6, net: 7, cost: 4 }, perk: 'LOUD 主场，粉丝狂热到近乎宗教，人气增长 +25%', cons: '训练体系与硬件落后', attrs: { charisma: 8, aim: -4 }, res: { money: 2000 } },
    { id: 'santiago', name: '圣地亚哥', region: 'CL · 美洲赛区', icon: 'globe', bars: { eco: 5, train: 7, net: 7, cost: 4 }, perk: 'KRÜ 与南美训练营，枪法对抗强度大', cons: '联赛关注度与商业价值偏低', attrs: { aim: 5, reaction: 3 }, res: { money: 1500 } },
    { id: 'istanbul', name: '伊斯坦布尔', region: 'TR · EMEA 赛区', icon: 'globe', bars: { eco: 7, train: 8, net: 8, cost: 5 }, perk: 'BBL / FUT 基地，欧亚枢纽，性价比极高的训练地', cons: '联赛席位更替频繁，稳定性差', attrs: { stamina: 4, luck: 3 }, res: { money: 1500 } },
    { id: 'madrid', name: '马德里', region: 'ES · EMEA 赛区', icon: 'globe', bars: { eco: 7, train: 8, net: 8, cost: 6 }, perk: '地中海热情与青训体系，团队氛围好', cons: '作息偏晚，训练纪律需自律', attrs: { comms: 5 }, res: { condition: 3 } },
    { id: 'seattle', name: '西雅图', region: 'US · 美洲赛区', icon: 'globe', bars: { eco: 8, train: 8, net: 9, cost: 8 }, perk: '科技公司扎堆，电竞孵化器与数据分析资源丰富', cons: '赛区竞争激烈，新人机会少', attrs: { insight: 6 }, res: { money: 2000 } },
    { id: 'dubai', name: '迪拜', region: 'AE · EMEA 赛区', icon: 'globe', bars: { eco: 8, train: 7, net: 8, cost: 8 }, perk: '资本新贵，豪华赛事频繁，薪资溢价 +60%', cons: '竞争环境不成熟，缺少高质量训练赛', attrs: { charisma: 6, insight: -5 }, res: { money: 18000 } },
    { id: 'cairo', name: '开罗', region: 'EG · EMEA 赛区', icon: 'globe', bars: { eco: 4, train: 6, net: 6, cost: 2 }, perk: '北非电竞崛起，成本极低，草根机会多', cons: '设备与网络条件差，伤病风险高', attrs: { luck: 5, stamina: 3 }, res: { hand: -6, money: 600 } }
  ];

  /* ── 时间线（1.9 十二节点；Q.6 年份 ↔ 赛季 ↔ 阵容基准） ── */
  const TIMELINES = [
    { id: 'beta', name: '开服封测期', phase: '封测期', year: 2023, season: '国服元年', month: 1, day: 6, icon: 'terminal', roster: '2023', tier: 'T3',
      tagline: '服务器里只有两千人，没人知道这游戏会不会火', quote: '客户端下载了六个小时。你不确定自己会不会被记住。',
      attrs: { insight: 5, luck: 4 }, startNode: 'ch1_beta', note: '无联赛 · 网吧与排位阶段' },
    { id: 'launch', name: '开服首日', phase: '开服首日', year: 2023, season: '国服元年', month: 7, day: 12, icon: 'sparkle', roster: '2023', tier: 'T3',
      tagline: '国服正式公测，排位点燃全网', quote: '凌晨五点你就排进了第一局。榜单一夜之间全是陌生 ID。',
      attrs: { reaction: 5, stamina: 3 }, startNode: 'ch1_launch', note: '俱乐部抢人大战前夜' },
    { id: 'spring24', name: '第一赛季 · 萌芽期', phase: '第一联赛期', year: 2024, season: 'S1', month: 5, day: 20, icon: 'flag', roster: '2024', tier: 'T2',
      tagline: 'VCT CN 元年开启，排位与职业体系建立', quote: '微博热搜前十全是它。俱乐部的车一辆接一辆开进基地。',
      attrs: { gameSense: 4, charisma: 4 }, startNode: 'ch1_tryout', note: '抢人大战 · 席位争夺' },
    { id: 'scout24', name: '青训选拔期', phase: '青训选拔期', year: 2024, season: 'S1', month: 3, day: 9, icon: 'search', roster: '2024', tier: 'T2',
      tagline: '各队青训营与挑战者赛集中招新', quote: '两百份简历，只留十二个名字。你站在队列里，手心全是汗。',
      attrs: { comms: 4 }, startNode: 'ch1_tryout', note: '试训压力最大的窗口' },
    { id: 'league24', name: '第一届联赛期', phase: '第一联赛期', year: 2024, season: 'S1', month: 6, day: 3, icon: 'trophy', roster: '2024', tier: 'T1',
      tagline: '首个大型线下赛事，大名单十几人抢五个位置', quote: '你已经坐了六周冷板凳，看着首发在台上接受欢呼。',
      attrs: { aim: 4, mentality: 4 }, startNode: 'ch1_debut', note: '直接进入竞技节奏' },
    { id: 'worlds24', name: '第一年世界冠军赛期', phase: '世界冠军赛期', year: 2024, season: 'S1', month: 10, day: 1, icon: 'crown', roster: '2024', tier: 'T0',
      tagline: '首届全球冠军赛，CN 赛区冲击世界之巅', quote: '酒店窗外的城市在发光。有些人一辈子只有这一次机会。',
      attrs: { mentality: 8, gameSense: 6, aim: 4, stamina: -4 }, startNode: 'ch1_worlds', note: '最高强度 · 舆论峰值' },
    { id: 'rise25', name: '第二年 · 强队崛起期', phase: '第一联赛期', year: 2025, season: 'S2', month: 5, day: 18, icon: 'trend-up', roster: '2025', tier: 'T1',
      tagline: '豪门格局初成，BLG 与 EDG 群雄并起', quote: '转会窗的最后一天，豪门的车停在你家楼下。',
      attrs: { charisma: 5, insight: 4 }, startNode: 'ch1_debut', note: '王朝成型 · 身价暴涨' },
    { id: 'dynasty25', name: '第三年 · 王朝期', phase: '第一联赛期', year: 2025, season: 'S2', month: 7, day: 6, icon: 'crown', roster: '2025', tier: 'T0',
      tagline: '统治级战队出现，你被写进了「下一个时代」的名单', quote: '所有人都在等你兑现天赋，包括你自己。',
      attrs: { aim: 5, charisma: 4 }, startNode: 'ch2_press', note: '高光与压力同步拉满' },
    { id: 'shift26', name: '第四年 · 格局剧变期', phase: '第一联赛期', year: 2026, season: 'S3', month: 5, day: 12, icon: 'refresh', roster: '2026', tier: 'T0',
      tagline: '版本巨变、老将更替潮，旧体系一夜失效', quote: '补丁把过去三年的答案全部作废。有人沉了，有人起飞。',
      attrs: { insight: 8, gameSense: 4, reaction: -3 }, startNode: 'ch3_league', note: '版本洗牌 · 转型窗口' },
    { id: 'legend27', name: '第五年 · 传奇时代', phase: '第一联赛期', year: 2027, season: 'S4', month: 4, day: 2, icon: 'sparkle', roster: '2026→推演', tier: 'T0',
      tagline: '电竞商业化爆发，选手开始成为真正的明星', quote: '你的脸出现在地铁广告上，而你的手还在疼。',
      attrs: { charisma: 8, insight: 4 }, startNode: 'ch4_transfer', note: '演绎扩展区 · 商业与生涯取舍' },
    { id: 'free', name: '完全自由时间', phase: '第一联赛期', year: 2026, season: 'S3', month: 5, day: 1, icon: 'compass', roster: '2026', tier: 'T1',
      tagline: '自定义任意时间点，可前可后', quote: '你决定从哪一天开始算起。',
      attrs: {}, startNode: 'ch1_tryout', note: '自由开局 · 世界状态由你指定' },
    { id: 'after', name: '结局后时代', phase: '第一联赛期', year: 2028, season: 'S5', month: 5, day: 8, icon: 'moon', roster: '2026→推演', tier: 'T1',
      tagline: '夺冠退役之后，以新身份回到这个圈子', quote: '训练室的灯还亮着，只是坐在那里的不再是你。',
      attrs: { insight: 6, mentality: 6 }, startNode: 'ch5_final', note: '教练 / 老板 / 解说 / 主播线' },
    { id: 'worlds25', name: '巴黎世界冠军赛期', phase: '世界冠军赛期', year: 2025, season: 'S2', month: 10, day: 6, icon: 'trophy', roster: '2025', tier: 'T0',
      tagline: 'S2 世界冠军赛在巴黎打响，NRG 夺冠',
      quote: '巴黎的场馆里没有一张熟悉的脸——除了你。',
      attrs: { mentality: 6, comms: 4 }, startNode: 'ch5_worlds', note: '国际赛场 · 强强对话' }
  ];


  /* ══════════ 叙事文风（融合自《夏瑾 天琴座 V2 Beta》预设，已做电竞现实向改编） ══════════ */
  const STORY_STYLE = [
    '【视角与信息】',
    '· 有限视角：任何角色（含主角）只掌握其渠道能获知的情报；情报必须有传播途径（群里刷到、记者来电、教练口头通知、赛后采访）。禁止叙述者视角的剧透与「元词汇」。',
    '· 可写主角内心戏，以自由间接引语自然融入叙事，直接给出，不写「他想」「他心中吐槽」。',
    '【白描优先】',
    '· 用动作、语言、神态本身传递情绪，可用环境与氛围烘托。禁止作者出面补充解释（如「这个动作体现了他很紧张」）。',
    '· 禁止解释性比喻补述（如「这句话像闪电击中他」），禁止用比喻描写语气、声音、眼神。',
    '【语言】',
    '· 对白口语化、像活人说话：允许顿挫、语气词、语塞、词不达意、口是心非；见什么人说什么话，态度有别。',
    '· 每句对白都要言之有物；不要五字以内的孤立短对白；不要文艺腔、舞台腔，不要不分场合地故作俏皮。',
    '· 对白独立成段，描写与对白分离。',
    '· 杜绝欧化句式与名词化表达（如「这个动作」）；避免连续并列短句，合并为长单句。',
    '【节奏与结构】',
    '· 每回合至少推进三段渐进发展的新情节，避免原地打转；不要让他人突然介入，转场必须有过程。',
    '· 大量使用短自然段，段落长短交错。',
    '· 正文以某个非玩家角色的具体言行收尾；结尾不做情感升华、不做总结断言。',
    '【情绪与人物】',
    '· 有情绪的通俗文字好过有美感的寡淡文字；情绪要渗进所有叙述。',
    '· 人物是复杂叠加的，不是刻板印象；角色之间平等而互相尊重，不写傲慢霸道与狂热崇拜。',
    '· 不要让角色重复近似的台词或与前文相同的动作。',
    '【抗滥用】',
    '· 避免被用滥的喻体（石子、湖面、拉满的弓）与套话（指节发白、睫毛、喉结、弧度、锁骨）。',
    '· 数量尽量用约数表达（几步、几个小时、若干天），设定中的精确数值除外。',
    '· 不炫技、不做文学拔高，不写散文式诗意。'
  ];

  /* 行动选项设计规则（融合自预设的「追加行动选项」，按本作 3—5 项收敛） */
  const OPTION_RULES = [
    '【行动选项设计】必须给出 3—5 个选项，玩家（{{user}}）是每个选项的隐形主语，不写主语。',
    '· 选项 1：平滑推进。顺承前文的小行动，同场景内产生较小推动。',
    '· 选项 2：另一种侧重。同样平滑，但换一种做法或对象（例如换成沟通、训练、商业、舆论）。',
    '· 选项 3：推进时间或空间。明确写出「接下来几天 / 去某地 / 约见某人」，把节奏往前推。',
    '· 选项 4：严肃路线。追主线、查线索、回收前文伏笔，或处理合同、伤病、队内矛盾。',
    '· 选项 5（可选）：超展开。脱离当前事件线，引入新的机会或完全换一种基调。',
    '· 内容要简练：只给言行，不加解释与评述；以对白为主也可以；不得重复前文出现过的言行。'
  ];
  /* ══════════ 俱乐部资料库（附录 Q：赛区席位 · 2025 阵容 · 资源分级） ══════════ */
  const CLUBS = [
    /* ── VCT CN 赛区（12 队） ── */
    { id: 'edg', name: 'EDward Gaming', short: 'EDG', region: 'CN', city: '上海', tier: 'T0', seat: '长期合作伙伴',
      style: '狼性文化 · 高压竞争 · 赛训最严', roster: ['ZmjjKK', 'CHICHOO', 'S1Mon', 'nobody', 'Smoggy'], rosters: { 2024: ["ZmjjKK","Haodong","CHICHOO","Smoggy","nobody"], 2025: ["ZmjjKK","CHICHOO","S1Mon","nobody","Smoggy"], 2026: ["ZmjjKK","Smoggy","Jieni7","CHICHOO","nobody"] },
      honors: '2024 首尔全球冠军赛冠军（CN 赛区首冠）', boss: '郑千亿', coach: '铁面·赵行舟',
      line: '王朝延续 vs 青黄不接；老板资本化 vs 老将情怀。', fans: '银灰 · 狼崽团', env: '顶级基地' },
    { id: 'blg', name: 'Bilibili Gaming', short: 'BLG', region: 'CN', city: '广州花都', tier: 'T0', seat: '长期合作伙伴',
      style: '直播基因 · 娱乐与竞技并重 · 造星工厂', roster: ['Whzy', 'Knight', 'rushia', 'nephh', 'Levius'], rosters: { 2024: ["whzy","Biank","Knight","yosemite","B3Ar"], 2025: ["Whzy","Knight","rushia","nephh","Levius"], 2026: ["nephh","whzy","Knight","Levius","rushia"] },
      honors: '2025 VCT CN 年度总冠军（whzy 总决赛 FMVP）', boss: '平台资本', coach: '战术激进派（虚构）',
      line: '商业化 vs 竞技纯粹性；FMVP 的舆论双刃剑。', fans: '天蓝 · 穹粉团', env: '顶级基地' },
    { id: 'jdg', name: 'JD Gaming', short: 'JDG', region: 'CN', city: '北京', tier: 'T0', seat: '长期合作伙伴',
      style: '资源型豪门 · 稳健 · 重视青训', roster: ['stew', 'jkuro', 'Yuicaw', 'coconut', 'zhe'], rosters: { 2024: ["stew","Viva","YiHao","MarT1n","jkuro"], 2025: ["stew","jkuro","Yuicaw","coconut","zhe"], 2026: ["jkuro","stew","kklin","Yuicaw","zhe"] },
      honors: '2026 年度总决赛对阵 TYL', boss: '老钱', coach: '战术白板·老苏',
      line: '青训人才辈出 vs 一线队战绩压力；冲击赛区冠军。', fans: '藏青 · JDG 信徒', env: '顶级基地' },
    { id: 'fpx', name: 'FunPlus Phoenix', short: 'FPX', region: 'CN', city: '上海', tier: 'T1', seat: '长期合作伙伴',
      style: '老牌豪门 · 体系成熟 · 粉丝文化深厚', roster: ['BerLIN', 'AAAAY', 'Life', 'sScary', 'Setrod'], rosters: { 2024: ["AAAAY","autumn","BerLIN","Life","Lysoar"], 2025: ["BerLIN","AAAAY","Life","sScary","Setrod"], 2026: ["BerLIN","AAAAY","Life","sScary","Setrod"] },
      honors: '多届联赛四强', boss: '—', coach: '—',
      line: '体系传承与年轻化改造的拉扯。', fans: '赤红', env: '俱乐部基地' },
    { id: 'te', name: 'Trace Esports', short: 'TE 溯', region: 'CN', city: '上海', tier: 'T1', seat: '长期合作伙伴',
      style: '年轻敢打 · 高强度对枪', roster: ['Kai', 'FengF', 'LuoK1ng', 'DeLb', 'Viva'], rosters: { 2024: ["FengF","Flex1n","HeiB","YoU","Kai","cxyy"], 2025: ["Kai","FengF","LuoK1ng","DeLb","Viva"], 2026: ["Biank","FengF","Kai","LuoK1ng","MarT1n"] },
      honors: '2025 启点赛亚军 · 曼谷大师赛参赛队', boss: '—', coach: '—',
      line: '年轻队伍的上升期与首次世界赛冲击。', fans: '青白', env: '俱乐部基地' },
    { id: 'tec', name: 'Titan Esports Club', short: 'TEC', region: 'CN', city: '无锡', tier: 'T1', seat: '长期合作伙伴',
      style: '防守体系 · 老派作风 · 稳扎稳打', roster: ['Abo', 'Rb', 'B1ackovo', 'Haodong', 'Dynamite'], rosters: { 2024: ["Abo","Rb","B1ack","LockM","qiuye","kawaii","Shameless"], 2025: ["Abo","Rb","B1ackovo","Haodong","Dynamite"], 2026: ["Haodong","Abo","CoCo","TvirusLuke","lucas"] },
      honors: '老牌劲旅 · 多次赛区前四', boss: '—', coach: '—',
      line: '旧时代防守体系与新时代快攻的碰撞。', fans: '玄黑', env: '俱乐部基地' },
    { id: 'nova', name: 'Nova Esports', short: 'NOVA', region: 'CN', city: '上海', tier: 'T1', seat: '长期合作伙伴',
      style: '中坚劲旅 · 新老结合', roster: ['cb', 'Swerl', 'GuanG', 'Ezeir', 'o0o0o'], rosters: { 2024: ["o0o0o","OBONE","PangH","cb","GuanG"], 2025: ["cb","Swerl","GuanG","Ezeir","o0o0o"], 2026: ["HeiB","OBONE","GuanG","Ezeir","Green"] },
      honors: '赛区稳定中上游', boss: '—', coach: '—',
      line: '新老交替期的更衣室政治。', fans: '墨蓝', env: '俱乐部基地' },
    { id: 'tyloo', name: 'TYLOO', short: 'TYL', region: 'CN', city: '上海', tier: 'T1', seat: '长期合作伙伴',
      style: '老牌血统 · 草根味浓 · 硬碰硬', roster: ['slowly', 'hfmi0dzjc9z7', 'Ninebody', '5CM', 'waituu'], rosters: { 2024: ["SLOWLY","ninebody","LuoK1ng","ICEKING","AAK","hfmi0dzjc9z7"], 2025: ["slowly","hfmi0dzjc9z7","Ninebody","5CM","waituu"], 2026: ["slowly","Scales","Yoyo","sword9","Splash"] },
      honors: '2026 年度总冠军', boss: '—', coach: '—',
      line: '草根血统的豪门杀手。', fans: '电光紫', env: '俱乐部基地' },
    { id: 'wol', name: 'Wolves Esports', short: 'WOL 狼队', region: 'CN', city: '重庆', tier: 'T1', seat: '长期合作伙伴',
      style: '年轻黑马 · 侵略性强', roster: ['Spring', 'Yuicaw', 'pl1xx', 'aluba', 'SiuFatBB'], rosters: { 2024: ["Spring","babyblue","ColdFish","pl1xx","Yuicaw","aluba"], 2025: ["Spring","Yuicaw","pl1xx","aluba","SiuFatBB"], 2026: ["SiuFatBB","Spring","V1ya","Satoshi","jowa"] },
      honors: '2025 多伦多大师赛四强', boss: '—', coach: '—',
      line: '黑马成色能否兑现为冠军。', fans: '狼灰', env: '俱乐部基地' },
    { id: 'ag', name: 'All Gamers', short: 'AG', region: 'CN', city: '成都', tier: 'T1', seat: '长期合作伙伴',
      style: '西南老牌 · 粉丝庞大', roster: ['Lsn', 'K1ra', 'Shr1mp', 'Zhubibi', 'Leav3u'], rosters: { 2024: ["x3b","Bunt","deLb","Monk","Spitfires","sword9"], 2025: ["Lsn","K1ra","Shr1mp","Zhubibi","Leav3u"], 2026: ["Spitfires","K1ra","Hanche","Shr1mp","player"] },
      honors: '老牌综合电竞俱乐部', boss: '—', coach: '—',
      line: '庞大粉丝盘与成绩压力的落差。', fans: '赤金', env: '俱乐部基地' },
    { id: 'drg', name: 'Dragon Ranger Gaming', short: 'DRG', region: 'CN', city: '广州', tier: 'T1', seat: '临时席位',
      style: '攻势犀利 · 敢打敢拼', roster: ['Nicc', 'Cangshu', 'SpiritZ1', 'vo0kashu', 'Flex1n'], rosters: { 2024: ["TvirusLuke","nizhaoTZH","Shion7","Nicc","vo0kashu","Dingwei"], 2025: ["Nicc","Cangshu","SpiritZ1","vo0kashu","Flex1n"], 2026: ["Nicc","vo0kashu","SpiritZ1","Flex1n","Akeman"] },
      honors: '2025 年度总决赛亚军', boss: '—', coach: '—',
      line: '临时席位队的保级与逆袭。', fans: '龙青', env: '俱乐部基地' },
    { id: 'xlg', name: 'XLG Esports', short: 'XLG', region: 'CN', city: '西安', tier: 'T1', seat: '临时席位',
      style: '黑马奇迹 · 敢用新人', roster: ['Rarga', 'happywei', 'coconut', 'NoMan', 'Lysoar'], rosters: { 2024: ["happywei","Rarga","Kr1stal","MarTin","MrCANI","Satoshi"], 2025: ["Rarga","happywei","coconut","NoMan","Lysoar"], 2026: ["Rarga","happywei","coconut","NoMan","Lysoar"] },
      honors: '2024 晋升赛冠军升班 · 2025 第一赛段冠军', boss: '—', coach: '—',
      line: '从晋升赛爬上来的队伍如何站稳。', fans: '烈红', env: '俱乐部基地' },
    /* ── T0 豪门（国际） ── */
    { id: 'sen', name: 'Sentinels', short: 'SEN', region: '美洲', city: '洛杉矶', tier: 'T0', seat: '长期合作伙伴',
      style: '资本雄厚 · 巨星云集 · 个人英雄主义', roster: ['N4RRATE', 'Zellsis', 'zekken', 'johnqt', 'bang'], rosters: { 2024: ["zekken","Sacy","pANcada","johnqt","TenZ"], 2025: ["N4RRATE","Zellsis","zekken","johnqt","bang"], 2026: ["Kyu","johnqt","N4RRATE","cortezia","reduxx"] },
      honors: '2021 雷克雅未克大师赛冠军（TenZ MVP）· 2024 首尔全球冠军赛四强', boss: '资本巨头（虚构）', coach: '美式体系教练组（虚构）',
      line: '巨星化学反应、商业化与纯粹竞技的冲突。', fans: '金色 · Sentinels 海', env: '顶级基地' },
    { id: 'nrg', name: 'NRG', short: 'NRG', region: '美洲', city: '洛杉矶', tier: 'T0', seat: '长期合作伙伴',
      style: '商业巨鳄 · 娱乐化标杆 · 善于造势', roster: ['Mada', 's0m', 'FNS', 'Ethan', 'Verno'], rosters: { 2024: ["crashies","Victor","Demon1","Ethan","Marved"], 2025: ["Mada","s0m","FNS","Ethan","Verno"], 2026: ["Ethan","mada","brawk","skuba","keiko"] },
      honors: '2025 巴黎全球冠军赛冠军（队史首冠）', boss: '华尔街背景（虚构）', coach: '数据驱动教练组（虚构）',
      line: '冠军王朝的延续、资本与选手的博弈。', fans: '黑白 · NRG 骑士团', env: '顶级基地' },
    { id: 'fnc', name: 'Fnatic', short: 'FNC', region: 'EMEA', city: '伦敦', tier: 'T0', seat: '长期合作伙伴',
      style: '战术纪律 · 团队协作 · 粉丝狂热', roster: ['Boaster', 'Alfajer', 'Chronicle', 'kaajak', 'crashies'], rosters: { 2024: ["Boaster","Derke","Alfajer","Leo","Chronicle"], 2025: ["Boaster","Alfajer","Chronicle","kaajak","crashies"], 2026: ["Boaster","Alfajer","kaajak","crashies","Veqaj"] },
      honors: '2023 LOCK//IN 与东京大师赛双国际冠军 · 2025 巴黎全球冠军赛亚军', boss: '老牌家族（虚构）', coach: '欧式体系 + 战术教练马丁（虚构）',
      line: '欧洲荣耀守护与「最后一舞」的执念。', fans: '血红 · 骑士团', env: '顶级基地' },
    { id: 'zeta', name: 'ZETA DIVISION', short: 'ZETA', region: '太平洋', city: '东京', tier: 'T0', seat: '长期合作伙伴',
      style: '二次元融合 · 技术流 · 训练严谨', roster: ['Dep', 'SugarZ3ro', 'CLZ', 'SyouTa', 'Xdll'], rosters: { 2024: ["Dep","Laz","hiroronn","SugarZ3ro","yuran"], 2025: ["Dep","SugarZ3ro","CLZ","SyouTa","Xdll"], 2026: ["SugarZ3ro","Xdll","eKo","Absol","SyouTa"] },
      honors: '2024—2025 太平洋赛区参赛 · 冲击世界赛', boss: '娱乐集团（虚构）', coach: '日式严谨教练组（虚构）',
      line: '日本赛区冲世界赛的执念；人设与真实自我的矛盾。', fans: '粉色 · ZETA 应援团', env: '顶级基地' },
    { id: 't1', name: 'T1', short: 'T1', region: '太平洋', city: '首尔', tier: 'T0', seat: '长期合作伙伴',
      style: '魔鬼训练 · 纪律至上 · 数据领先', roster: ['iZu', 'stax', 'Sylvan', 'Meteor', 'BuZz'], rosters: { 2024: ["Carpe","iZu","Rossy","Sayaplayer","xccurate"], 2025: ["iZu","stax","Sylvan","Meteor","BuZz"], 2026: ["stax","carpe","iZu","Meteor","BuZz"] },
      honors: '2024 曼谷大师赛冠军', boss: '财团（虚构）', coach: '铁血体系教练组（虚构）',
      line: '韩国纪律文化的代表与魔鬼训练的反噬。', fans: '虎纹橙 · 虎啸团', env: '顶级基地' },
    /* ── 国际强队（T1） ── */
    { id: 'g2', name: 'G2 Esports', short: 'G2', region: '美洲', city: '柏林', tier: 'T1', seat: '临时席位',
      style: '流量豪门 · 执行力强', roster: ['JonahP', 'jawgemo', 'trent', 'valyn', 'leaf'], rosters: { 2024: ["JonahP","neT","trent","valyn","leaf"], 2025: ["JonahP","jawgemo","trent","valyn","leaf"], 2026: ["valyn","trent","leaf","jawgemo","babybay"] }, honors: '多届大师赛参赛', boss: '—', coach: '—', line: '流量与成绩的平衡。', fans: '铁灰', env: '俱乐部基地' },
    { id: 'th', name: 'Team Heretics', short: 'TH', region: 'EMEA', city: '马德里', tier: 'T1', seat: '长期合作伙伴',
      style: '时尚跨界 · 新生代锐气', roster: ['Boo', 'benjyfishy', 'Wo0t', 'RieNs', 'ComeBack'], rosters: { 2024: ["Boo","benjyfishy","MiniBoo","RieNs","Wo0t"], 2025: ["Boo","benjyfishy","Wo0t","RieNs","ComeBack"], 2026: ["koshmaras","Wo0t","RieNs","benjyfishy","Boo"] }, honors: '2024 首尔全球冠军赛亚军', boss: '—', coach: '—', line: '新生代对世界冠军的冲击。', fans: '香槟金', env: '俱乐部基地' },
    { id: 'tl', name: 'Team Liquid', short: 'TL', region: 'EMEA', city: '乌得勒支', tier: 'T1', seat: '长期合作伙伴',
      style: '老牌豪门 · 数据驱动 · 纪律严明', roster: ['nAts', 'Keiko', 'kamo', 'paTiTek', 'trexx'], rosters: { 2024: ["Enzo","Jammpi","Keiko","nAts","Mistic"], 2025: ["nAts","Keiko","kamo","paTiTek","trexx"], 2026: ["nAts","kamo","MiniBoo","purp0","wayne"] }, honors: '哨位艺术的教科书', boss: '—', coach: '—', line: '从独行到团队核心的磨合。', fans: '青灰', env: '俱乐部基地' },
    { id: 'vit', name: 'Team Vitality', short: 'VIT', region: 'EMEA', city: '巴黎', tier: 'T1', seat: '长期合作伙伴',
      style: '法国豪门 · 明星重组', roster: ['Kicks', 'Sayf', 'trexx', 'Derke', 'Less'], rosters: { 2024: ["ceNder","Destrian","runneR","Kicks","Sayf","trexx"], 2025: ["Kicks","Sayf","trexx","Derke","Less"], 2026: ["Jamppi","Derke","Sayonara","Chronicle","PROFEK"] }, honors: '欧洲明星阵容', boss: '—', coach: '—', line: '天才的下一站与重组阵痛。', fans: '黄蜂金', env: '俱乐部基地' },
    { id: 'kc', name: 'Karmine Corp', short: 'KC', region: 'EMEA', city: '巴黎', tier: 'T1', seat: '长期合作伙伴',
      style: '地中海热情 · 青训出色', roster: ['Saadhak', 'avez', 'Elite', 'marteen', 'SUYGETSU'], rosters: { 2024: ["Sh1n","Magnum","N4RRATE","tomaszy","marteen"], 2025: ["Saadhak","avez","Elite","marteen","SUYGETSU"], 2026: ["dos9","LewN","avez","SUYGETSU","N4RRATE"] }, honors: '法国粉丝文化标杆', boss: '—', coach: '—', line: '狂热粉丝与青训体系。', fans: '天蓝', env: '俱乐部基地' },
    { id: 'prx', name: 'Paper Rex', short: 'PRX', region: '太平洋', city: '新加坡', tier: 'T1', seat: '长期合作伙伴',
      style: '国际枢纽 · 智商型打法 · 快乐电竞', roster: ['d4v41', 'f0rsakeN', 'mindfreak', 'Jinggg', 'something'], rosters: { 2024: ["something","f0rsakeN","d4v41","mindfreak","Monyet"], 2025: ["d4v41","f0rsakeN","mindfreak","Jinggg","something"], 2026: ["f0rsakeN","d4v41","something","Jinggg","PatMen"] }, honors: '2025 多伦多大师赛冠军', boss: '—', coach: '—', line: '东南亚第一座国际冠军的缔造者。', fans: '狮红', env: '俱乐部基地' },
    { id: 'drx', name: 'DRX', short: 'DRX', region: '太平洋', city: '首尔', tier: 'T1', seat: '长期合作伙伴',
      style: '韩式体系 · 纪律严明', roster: ['MaKo', 'Flashback', 'free1ng', 'HYUNMIN', 'Athan'], rosters: { 2024: ["BuZz","Flashback","Foxy9","MaKo","stax"], 2025: ["MaKo","Flashback","free1ng","HYUNMIN","Athan"], 2026: ["MaKo","free1ng","HYUNMIN","BeYN","Flashback"] }, honors: '太平洋赛区常客', boss: '—', coach: '—', line: '韩式体系与版本更迭。', fans: '蓝白', env: '俱乐部基地' },
    { id: 'geng', name: 'Gen.G Esports', short: 'GENG', region: '太平洋', city: '首尔', tier: 'T1', seat: '长期合作伙伴',
      style: '数据与体系 · 稳定压制', roster: ['t3xture', 'Karon', 'Munchkin', 'yoman', 'Foxy9'], rosters: { 2024: ["Karon","Lakia","Meteor","Munchkin","t3xture"], 2025: ["t3xture","Karon","Munchkin","yoman","Foxy9"], 2026: ["Lakia","Ash","Karon","t3xture","TenTen"] }, honors: '2024 上海大师赛冠军', boss: '—', coach: '—', line: '数据化赛训的极致。', fans: '金黑', env: '俱乐部基地' },
    { id: 'loud', name: 'LOUD', short: 'LOUD', region: '美洲', city: '圣保罗', tier: 'T1', seat: '长期合作伙伴',
      style: '足球国度激情 · 主场氛围恐怖', roster: ['pANcada', 'cauanzin', 'dgzin', 'tuyz', 'v1nNy'], rosters: { 2024: ["Less","cauanzin","Saadhak","tuyz","qck"], 2025: ["pANcada","cauanzin","dgzin","tuyz","v1nNy"], 2026: ["cauanzin","pANcada","lukxo","Virtyy","Darker"] }, honors: '南美粉丝文化标杆', boss: '—', coach: '—', line: '主场压力与南美荣耀。', fans: '黄绿', env: '俱乐部基地' },
    { id: 'mibr', name: 'MIBR', short: 'MIBR', region: '美洲', city: '圣保罗', tier: 'T1', seat: '长期合作伙伴',
      style: '巴西豪门 · 明星决斗者', roster: ['aspas', 'cortezia', 'xenom', 'nzr', 'Artzin'], rosters: { 2024: ["Jzz","frz","RgLM","Mazin","Artzin"], 2025: ["aspas","cortezia","xenom","nzr","Artzin"], 2026: ["Verno","aspas","Mazino","tex","zekken"] }, honors: 'aspas 加盟后的争冠窗口', boss: '—', coach: '—', line: '南美旗帜的漂泊与成长。', fans: '红黑', env: '俱乐部基地' },
    { id: 'kru', name: 'KRÜ Esports', short: 'KRÜ', region: '美洲', city: '圣地亚哥', tier: 'T1', seat: '长期合作伙伴',
      style: '南美热情 · 对抗强度大', roster: ['Melser', 'keznitdeuS', 'Shyy', 'adverso', 'Mazino'], rosters: { 2024: ["Melser","Shyy","mta","Keznit","Klaus"], 2025: ["Melser","keznitdeuS","Shyy","adverso","Mazino"], 2026: ["Saadhak","Dantedeu5","Less","mwzera","silentzz"] }, honors: '南美赛区劲旅', boss: '—', coach: '—', line: '拉美选手的上升通道。', fans: '紫白', env: '俱乐部基地' },
    { id: 'lev', name: 'LEVIATÁN', short: 'LEV', region: '美洲', city: '墨西哥城', tier: 'T1', seat: '长期合作伙伴',
      style: '拉美豪门 · 巨星政策', roster: ['kiNgg', 'Demon1', 'nataNk', 'Tex', 'C0M'], rosters: { 2024: ["kiNgg","Mazino","aspas","Tex","C0M"], 2025: ["kiNgg","Demon1","nataNk","Tex","C0M"], 2026: ["kiNgg","Sato","blowz","Neon","spikeziN"] }, honors: '2024 全球冠军赛季军', boss: '—', coach: '—', line: '巨星聚合与化学反应。', fans: '深蓝', env: '俱乐部基地' },
    { id: 'c9', name: 'Cloud9', short: 'C9', region: '美洲', city: '洛杉矶', tier: 'T1', seat: '长期合作伙伴',
      style: '北美老牌 · 稳中求变', roster: ['v1c', 'Xeppaa', 'OXY', 'mitch', 'neT'], rosters: { 2024: ["jakee","Xeppaa","OXY","vanity","wippie"], 2025: ["v1c","Xeppaa","OXY","mitch","neT"], 2026: ["Zellsis","Xeppaa","OXY","v1c","penny"] }, honors: '北美老牌俱乐部', boss: '—', coach: '—', line: '北美体系的重建。', fans: '蓝白', env: '俱乐部基地' },
    { id: '100t', name: '100 Thieves', short: '100T', region: '美洲', city: '洛杉矶', tier: 'T1', seat: '长期合作伙伴',
      style: '内容与竞技并重', roster: ['Asuna', 'Zander', 'Cryocells', 'eeiu', 'Boostio'], rosters: { 2024: ["Asuna","bang","Cryocells","eeiu","Boostio"], 2025: ["Asuna","Zander","Cryocells","eeiu","Boostio"], 2026: ["vora","Asuna","Cryocells","Timotino","bang"] }, honors: '北美内容生态标杆', boss: '—', coach: '—', line: '内容公司与竞技队伍的双线。', fans: '红黑', env: '俱乐部基地' },
    { id: 'eg', name: 'Evil Geniuses', short: 'EG', region: '美洲', city: '西雅图', tier: 'T1', seat: '长期合作伙伴',
      style: '传统豪门 · 重建期', roster: ['yay', 'icy', 'Derrek', 'NaturE', 'supamen'], rosters: { 2024: ["jawgemo","Apoth","Derrek","NaturE","supamen"], 2025: ["yay","icy","Derrek","NaturE","supamen"], 2026: ["C0M","bao","dgzin","okeanos","supamen"] }, honors: '北美老牌豪门', boss: '—', coach: '—', line: '老牌豪门的重建与自证。', fans: '蓝黑', env: '俱乐部基地' },
    { id: 'furia', name: 'FURIA Esports', short: 'FUR', region: '美洲', city: '圣保罗', tier: 'T1', seat: '长期合作伙伴',
      style: '巴西劲旅 · 学院队体系', roster: ['Khalil', 'mwzera', 'heat', 'raafa', 'havoc'], rosters: { 2024: ["Khalil","mwzera","kon4n","liazzi","havoc"], 2025: ["Khalil","mwzera","heat","raafa","havoc"], 2026: ["nerve","alym","artzin","eeiu","koalanoob"] }, honors: '拥有学院队参加巴西挑战者赛', boss: '—', coach: '—', line: '青训学院到一队的通道。', fans: '黑金', env: '俱乐部基地' },
    { id: 'rrq', name: 'Rex Regum Qeon', short: 'RRQ', region: '太平洋', city: '雅加达', tier: 'T1', seat: '长期合作伙伴',
      style: '资本新贵 · 豪华设施 · 野心勃勃', roster: ['xffero', 'Estrella', 'Jemkin', 'monyet', 'Kush'], rosters: { 2024: ["2ge","Estrella","fl1pzjder","Jemkin","Lmemore","xffero"], 2025: ["xffero","Estrella","Jemkin","monyet","Kush"], 2026: ["crazyguy","xffero","Jemkin","monyet","Kushy"] }, honors: '印尼第一豪门', boss: '—', coach: '—', line: '东南亚资本与野心的对撞。', fans: 'RRQ 白', env: '俱乐部基地' },
    { id: 'talon', name: 'Talon Esports', short: 'TLN', region: '太平洋', city: '曼谷', tier: 'T1', seat: '2026 席位由 FULL SENSE 接替',
      style: '随性豪放 · 快乐电竞', roster: ['Crws', 'JitboyS', 'ban', 'Governor', 'Primmie'], rosters: { 2024: ["ban","Crws","Governor","JitboyS","lenne","Surf"], 2025: ["Crws","JitboyS","ban","Governor","Primmie"], 2026: ["Crws","JitboyS","ban","Governor","Primmie"] }, honors: '东南亚豪强', boss: '—', coach: '—', line: '席位更替与队伍命运。', fans: '海蓝', env: '俱乐部基地' },
    { id: 'ge', name: 'Global Esports', short: 'GE', region: '太平洋', city: '孟买', tier: 'T1', seat: '长期合作伙伴',
      style: '南亚代表 · 敢打敢拼', roster: ['kellyS', 'Kr1stal', 'PapiChulo', 'patrickWHO', 'UdoTan'], rosters: { 2024: ["Benkai","blaZek1ng","Lightningfast","Russ","Polvi"], 2025: ["kellyS","Kr1stal","PapiChulo","patrickWHO","UdoTan"], 2026: ["xavi8k","Kr1stal","UdoTan","Deryeon","autumn"] }, honors: '南亚赛区代表', boss: '—', coach: '—', line: '基础设施薄弱下的突围。', fans: '橙绿', env: '俱乐部基地' },
    { id: 'ts', name: 'Team Secret', short: 'TS', region: '太平洋', city: '马尼拉', tier: 'T1', seat: '长期合作伙伴',
      style: '东南亚老牌 · 灵巧打法', roster: ['JessieVash', 'Jremy', 'Invy', '2GE', 'Wild0reoo'], rosters: { 2024: ["BORKUM","invy","JessieVash","Jremy","NDG"], 2025: ["JessieVash","Jremy","Invy","2GE","Wild0reoo"], 2026: ["invy","kellyS","Sylvan","meow"] }, honors: '东南亚老牌战队', boss: '—', coach: '—', line: '老牌队伍的生存战。', fans: '白蓝', env: '俱乐部基地' },
    { id: 'dfm', name: 'DetonatioN FocusMe', short: 'DFM', region: '太平洋', city: '东京', tier: 'T1', seat: '长期合作伙伴',
      style: '日式纪律 · 细节至上', roster: ['Meiy', 'Akame', 'Art', 'gyen', 'Jinboong'], rosters: { 2024: ["JoXJo","Meiy","neth","Popogachi","Suggest"], 2025: ["Meiy","Akame","Art","gyen","Jinboong"], 2026: ["SSeeS","Meiy","akame","gyen","Melofovia"] }, honors: '日本赛区代表', boss: '—', coach: '—', line: '日式细节与版本冲击。', fans: '红白', env: '俱乐部基地' },
    { id: 'navi', name: 'Natus Vincere', short: 'NAVI', region: 'EMEA', city: '基辅', tier: 'T1', seat: '长期合作伙伴',
      style: '欧洲老牌 · 硬派风格', roster: ['ANGE1', 'hiro', 'Ruxic', 'koalanoob', 'Shao'], rosters: { 2024: ["ANGE1","Shao","Zyppan","SUYGETSU","ardiis"], 2025: ["ANGE1","hiro","Ruxic","koalanoob","Shao"], 2026: ["chloric","hiro","Ruxic","ExiT","CyvOph"] }, honors: '欧洲老牌豪门', boss: '—', coach: '—', line: '老将经验与新生代冲击。', fans: '黄黑', env: '俱乐部基地' },
    { id: 'gx', name: 'GIANTX', short: 'GIA', region: 'EMEA', city: '马德里', tier: 'T1', seat: '长期合作伙伴',
      style: '西班牙血统 · 团队体系', roster: ['Cloud', 'purp0', 'westside', 'runneR', 'tomaszy'], rosters: { 2024: ["Fit1nho","hoody","Cloud","Redgar","purp0"], 2025: ["Cloud","purp0","westside","runneR","tomaszy"], 2026: ["westside","Flickless","ara","neT"] }, honors: 'EMEA 中坚', boss: '—', coach: '—', line: '中游队伍的生存与爆发。', fans: '紫青', env: '俱乐部基地' },
    { id: 'bbl', name: 'BBL Esports', short: 'BBL', region: 'EMEA', city: '伊斯坦布尔', tier: 'T1', seat: '长期合作伙伴',
      style: '土耳其劲旅 · 性价比高', roster: ['Jamppi', 'sociablEE', 'PROFEK', 'LêwN', 'vakk'], rosters: { 2024: ["Elite","Brave","LewN","reazy","QutionerX"], 2025: ["Jamppi","sociablEE","PROFEK","LêwN","vakk"], 2026: ["Crewen","Lar0k","Loita","lovers rock","Rosé"] }, honors: 'EMEA 席位常客', boss: '—', coach: '—', line: '土耳其新势力的崛起。', fans: '红金', env: '俱乐部基地' },
    { id: 'fut', name: 'FUT Esports', short: 'FUT', region: 'EMEA', city: '伊斯坦布尔', tier: 'T1', seat: '长期合作伙伴',
      style: '土耳其 · 明星选手驱动', roster: ['MrFaliN', 'yetujey', 'KROSTALY', 'xeus', 'baha'], rosters: { 2024: ["cNed","yetujey","ATA KAPTAN","MrFaliN","qRaxs"], 2025: ["cNed","yetujey","ATA KAPTAN","MrFaliN","qRaxs"], 2026: ["MrFaliN","yetujey","KROSTALY","xeus","baha"] }, honors: 'cNed 时代的高光', boss: '—', coach: '—', line: '明星与阵容稳定性。', fans: '青金', env: '俱乐部基地' },
    { id: 'm8', name: 'Gentle Mates', short: 'M8', region: 'EMEA', city: '巴黎', tier: 'T1', seat: '2025 临时席位',
      style: '法国新贵 · 内容驱动', roster: ['beyAz', 'logaN', 'nataNk', 'TakaS', 'Wailers'], rosters: { 2024: ["beyAz","logaN","nataNk","TakaS","Wailers"], 2025: ["beyAz","logaN","nataNk","TakaS","Wailers"], 2026: ["starxo","Minny","bipo","GLYPH","marteen"] }, honors: '法国新生代', boss: '—', coach: '—', line: '内容战队打进顶级联赛。', fans: '薄荷绿', env: '俱乐部基地' },
    { id: 'ns', name: 'Nongshim RedForce', short: 'NS', region: '太平洋', city: '首尔', tier: 'T1', seat: '临时席位 → 2026 获得席位',
      style: '韩国新军 · 体系化', roster: ['Dambi', 'Francis', 'Ivy', 'margaret', 'Persia'], rosters: { 2024: ["Dambi","Francis","Ivy","margaret","Persia"], 2025: ["Dambi","Francis","Ivy","margaret","Persia"], 2026: ["Rb","Francis","Xross","Dambi","Ivy"] }, honors: '2025 太平洋临时席位', boss: '—', coach: '—', line: '晋升赛上来的韩国新军。', fans: '红白', env: '俱乐部基地' },
    { id: 'boom', name: 'BOOM Esports', short: 'BOOM', region: '太平洋', city: '雅加达', tier: 'T1', seat: '2025 临时席位',
      style: '印尼豪强 · 快节奏', roster: ['BerserX', 'famouz', 'Shiro', 'NcSlasher', 'dos9'], rosters: { 2024: ["BerserX","famouz","Shiro","NcSlasher","dos9"], 2025: ["BerserX","famouz","Shiro","NcSlasher","dos9"], 2026: ["BerserX","famouz","Shiro","NcSlasher","dos9"] }, honors: '2025 太平洋临时席位', boss: '—', coach: '—', line: '印尼双雄的内部竞争。', fans: '橙红', env: '俱乐部基地' },
    { id: 'fs', name: 'FULL SENSE', short: 'FS', region: '太平洋', city: '曼谷', tier: 'T1', seat: '2026 接替 Talon 席位',
      style: '东南亚新贵 · 打法灵巧', roster: ['Leviathan', 'JitboyS', 'killua', 'Primmie', 'thyy'], rosters: { 2024: ["Leviathan","JitboyS","killua","Primmie","thyy"], 2025: ["Leviathan","JitboyS","killua","Primmie","thyy"], 2026: ["Leviathan","JitboyS","killua","Primmie","thyy"] }, honors: '2026 席位获得队', boss: '—', coach: '—', line: '接替席位的压力。', fans: '湄南青', env: '俱乐部基地' }
  ];

  /* ── 特工（第35章国服口径，按定位划分 9.1） ── */
  const AGENTS = {
    '决斗者': ['捷风', '雷兹', '不死鸟', '芮娜', '夜露', '霓虹', '壹决'],
    '先锋': ['铁臂', '猎枭', '斯凯', 'K/O', '黑梦', '盖可'],
    '控场': ['幽影', '炼狱', '蝰蛇', '星礈', '海神', '钛狐'],
    '哨卫': ['贤者', '零', '奇乐', '尚勃勒', '钢锁', '暮蝶', '维斯', '幻棱', '迷核', '禁灭']
  };

  /* ── 竞技地图（13 张正式地图，13.1） ── */
  const MAPS = ['源工重镇', '亚海悬城', '森寒冬港', '隐世修所', '热带乐园', '深海明珠', '霓虹町', '日落之城', '微风岛屿', '盐海矿镇', '裂变峡谷', '莲华古城', '幽邃地窟'];

  /* ── 武器与护甲经济（11.13） ── */
  const WEAPONS = [
    { cls: '手枪', name: '标配', cost: 0 }, { cls: '手枪', name: '短炮', cost: 200 }, { cls: '手枪', name: '狂怒', cost: 450 },
    { cls: '手枪', name: '鬼魅', cost: 500 }, { cls: '手枪', name: '追猎', cost: 800 }, { cls: '手枪', name: '正义', cost: 800 },
    { cls: '冲锋枪', name: '雄鹿', cost: 850 }, { cls: '冲锋枪', name: '骇灵', cost: 1000 }, { cls: '冲锋枪', name: '蜂刺', cost: 1100 },
    { cls: '霰弹枪', name: '判官', cost: 1500 }, { cls: '霰弹枪', name: '獠犬', cost: 1600 },
    { cls: '步枪', name: '莽侠', cost: 950 }, { cls: '步枪', name: '戍卫', cost: 2250 }, { cls: '步枪', name: '飞将', cost: 2400 },
    { cls: '步枪', name: '幻影', cost: 2900 }, { cls: '步枪', name: '狂徒', cost: 2900 },
    { cls: '重武器', name: '奥丁', cost: 3200 }, { cls: '重武器', name: '战神', cost: 5500 },
    { cls: '狙击', name: '冥驹', cost: 9500 }
  ];

  /* ── 训练项目（AW.1 / 30.2 / V.6） ── */
  const TRAINING = [
    { id: 'aim', name: '枪法训练', icon: 'target', attr: 'aim', base: [1, 2], desc: '训练场压枪、爆头线、预瞄点重复', tool: '瞄准训练器' },
    { id: 'reaction', name: '反应训练', icon: 'bolt', attr: 'reaction', base: [1, 2], desc: '闪光反应、人形靶速射、闪身枪', tool: '反应靶' },
    { id: 'movement', name: '身法训练', icon: 'pulse', attr: 'movement', base: [1, 2], desc: '跳射、道具投掷点位、地图穿梭路线', tool: '身法图' },
    { id: 'gameSense', name: '意识训练', icon: 'compass', attr: 'gameSense', base: [1, 2], desc: '录像复盘、残局推演、信息链梳理', tool: '战术录像课' },
    { id: 'mentality', name: '心态训练', icon: 'mind', attr: 'mentality', base: [1, 2], desc: '心理疏导、冥想、抗压模拟', tool: '心理音频课' },
    { id: 'stamina', name: '体能训练', icon: 'flame', attr: 'stamina', base: [1, 2], desc: '核心力量、肩颈、手腕康复', tool: '营养补给包' },
    { id: 'comms', name: '团队合练', icon: 'headset', attr: 'comms', base: [1, 2], desc: '训练赛指挥、报点规范、配合默契', tool: '—' },
    { id: 'charisma', name: '形象管理', icon: 'heart', attr: 'charisma', base: [1, 2], desc: '直播、采访训练、镜头表达', tool: '—' },
    { id: 'insight', name: '战术学习', icon: 'cpu', attr: 'insight', base: [0, 1], desc: '版本研究、对手建模、BP 预读', tool: '战术笔记本' }
  ];

  /* ── 队伍羁绊（9.4） ── */
  const BONDS = [
    { id: 'stranger', name: '陌路', bonus: 0, need: 0, desc: '几乎没有配合，团战各打各的' },
    { id: 'running', name: '磨合', bonus: 0.05, need: 20, desc: '知道彼此习惯，残局开始有默契' },
    { id: 'tacit', name: '默契', bonus: 0.10, need: 45, desc: '不用喊也知道队友在哪、要什么' },
    { id: 'bound', name: '羁绊', bonus: 0.15, need: 70, desc: '共患难过的五个人，专属团队剧情解锁' },
    { id: 'covenant', name: '神契', bonus: 0.20, need: 90, desc: '冠军之姿：残局处理与关键局判定大幅加成' }
  ];

  /* ── 姓名与档案语料 ── */
  const SURNAMES = ['陆', '苏', '王', '李', '林', '陈', '何', '钱', '周', '沈', '叶', '赵', '夏', '祁', '白', '简', '江', '顾', '温', '许'];
  const GIVEN = ['沉舟', '晚棠', '擎苍', '闻澈', '行舟', '锦', '坤', '大力', '默', '小雨', '何进', '多多', '屿', '辞', '知遥', '听澜', '南舟', '子墨', '亦然', '时安', '疏雨', '望舒', '静姝', '明野'];
  const IDS = ['Tide', 'Nova', 'Ashen', 'Vortex', 'Lumen', 'Echo', 'Cinder', 'Quartz', 'Halo', 'Zenith', 'Rift', 'Onyx', 'Solace', 'Vertex', 'Pulse', 'Kite', 'Drift', 'Ember', 'Gale', 'Mirage'];
  const ID_SUFFIX = ['', '7', '01', 'X', 'z', '_', '9'];

  /* ── 性格底色（25.11 性格库） ── */
  const TRAITS = [
    { id: 'calm', name: '冷静理智', icon: 'mind', desc: '判定失误损失更小', mods: { mentality: 6, condition: 2 } },
    { id: 'hotblood', name: '热血冲动', icon: 'flame', desc: '落后时判定 +2，连胜成长更快', mods: { aim: 4, mentality: -3 } },
    { id: 'quiet', name: '沉默寡言', icon: 'mute', desc: '社交类判定 -2，训练效率 +8%', mods: { comms: -5, aim: 4 } },
    { id: 'humor', name: '乐观开朗', icon: 'message', desc: '舆论负面衰减更快', mods: { charisma: 5, antiThreat: -4 } },
    { id: 'arrogant', name: '狂妄自信', icon: 'crown', desc: '商业价值 +6，队友关系 -6', mods: { charisma: 6, teammateTrust: -6 } },
    { id: 'warm', name: '温柔治愈', icon: 'heart', desc: '队友与粉丝好感成长 +20%', mods: { teammateTrust: 7, fanLoyalty: 6, comms: 3 } },
    { id: 'obsessive', name: '自律苦行', icon: 'target', desc: '训练收益 +15%，体能消耗 +20%', mods: { aim: 5, insight: 3, stamina: -5 } },
    { id: 'lazy', name: '佛系躺平', icon: 'moon', desc: '心态衰减减半，成长速度 -10%', mods: { mentality: 9, condition: 4, reaction: -3 } },
    { id: 'toxic', name: '毒舌傲娇', icon: 'sword', desc: '队内摩擦概率提升，关键局判定 +1', mods: { comms: -3, mentality: 5 } },
    { id: 'cunning', name: '腹黑算计', icon: 'mask', desc: '谈判与情报判定 +3，关系信任 -3', mods: { insight: 6, teammateTrust: -3 } }
  ];
  const CATCHPHRASES = ['稳一点，先拿信息', '我来开，你们跟枪', '对面狙在哪？', '别急，等我大招', '这张图稳了', '下张图一定', '我手很热的', '交给我', '输了算我的', '再来一张'];
  const SIGNS = ['永不后退', '以准星为誓', '不疯魔不成活', '再来一次就好', '赢，或者学到东西', '别让手停下'];
  const GENDERS = ['男', '女', '其他'];
  const ORIENTATIONS = ['异性恋', '同性恋', '双性恋', '无性恋', '尚未确定'];
  const LOVE_STYLES = ['专一型', '随缘型', '事业优先', '主动型', '被动型'];

  /* ── NPC 库（第25章） ── */
  const NPCS = {
    coach: [
      { name: '铁面·赵行舟', tag: 'Zhao', role: '主教练', persona: '38 岁，前职业选手转型，以严格著称。训练场上是魔鬼，生活里是操心老父亲；与老板的路线分歧、与明星选手的管教冲突是重要剧情。', trait: '严厉毒舌 · 外冷内热' },
      { name: '战术白板·老苏', tag: 'Su', role: '主教练', persona: '45 岁，资源型豪门主教练，讲体系、讲纪律、讲复盘。战术板写得比谁都满。', trait: '稳健传统 · 重体系' },
      { name: '青训教练·老白', tag: 'Bai', role: '青训教练', persona: '52 岁，退役老将，现实世界第一批电竞教练，带出过多名传奇。刀子嘴豆腐心，与时代脱节却最懂选手。', trait: '传统固执 · 护犊子' }
    ],
    analyst: [
      { name: '数据狂·艾琳', tag: 'Irene', role: '首席分析师', persona: '28 岁，统计学博士，对数据有偏执的热爱。她的报告决定阵容与 BP，是版本趋势预判的幕后推手。', trait: '理性 · 口无遮拦' },
      { name: '神秘分析师·零号', tag: 'Zero', role: '神秘分析师', persona: '身份成谜，只通过邮件联系，分析报告精准到恐怖。传说级幕后人物，真实身份是世界观暗线。', trait: '未知' }
    ],
    medic: [
      { name: '理疗师·阿坤', tag: 'Kun', role: '康复理疗师', persona: '33 岁，按摩手艺一绝，电竞圈「队医」。嘴碎热心、技术过硬，掌握着选手身体状态的秘密。', trait: '嘴碎热心 · 八卦王' },
      { name: '心理师·苏锦', tag: 'SuJin', role: '心理顾问', persona: '30 岁，电竞心理学先驱，温柔知性，共情力强。玩家心理崩溃时的救命稻草，也是众多选手的秘密倾诉对象。', trait: '共情 · 守秘密' }
    ],
    manager: [
      { name: '经理·王姐', tag: 'WangJie', role: '运营经理', persona: '35 岁，EDG 运营经理，万能管家。干练、唠叨、操心命，选手的后勤与商务全归她管。', trait: '妈系 · 干练' },
      { name: '老板·郑千亿', tag: 'Zheng', role: '俱乐部老板', persona: '45 岁，资本大鳄。精明、冷酷、商人本色；他是伯乐也是吸血鬼，资本与情怀的博弈由他推动。', trait: '精明冷酷 · 商人本色' }
    ],
    agent: [
      { name: '经纪人·阿豪', tag: 'Hao', role: '经纪人', persona: '30 岁，顶级经纪人，人脉通天。精明圆滑、唯利是图但有底线，是转会市场的操盘手，也是玩家的利益代言人。', trait: '圆滑 · 精明' }
    ],
    official: [
      { name: '联盟官员·冷局长', tag: 'Leng', role: 'VCT 纪律委员会', persona: '50 岁，严肃、公正、铁面无私。规则执行者，假赛与违规的裁决人。', trait: '铁面无私' },
      { name: '反作弊官·阿探', tag: 'Tan', role: '反作弊小组组长', persona: '29 岁，敏锐、多疑、技术宅。他会盯上数据异常的选手——「复核风波」主线的关键人物。', trait: '敏锐多疑' }
    ],
    streamer: [
      { name: '主播·大鼻子', tag: 'BigNose', role: '头部主播', persona: '28 岁，虎牙/斗鱼整活天王。幽默、无厘头、爱搞事，与选手的联欢整活是直播名场面制造机。', trait: '整活天王' },
      { name: '主播·小铃铛', tag: 'Bell', role: '技术主播', persona: '24 岁，高颜值技术主播，流量女王。温柔圆滑、事业心强，商务线富矿。', trait: '流量女王' }
    ],
    caster: [
      { name: '解说·激情老黄', tag: 'Huang', role: '赛事解说', persona: '35 岁，风格激情澎湃，「燃！太燃了！」是他的口头禅。热情、话痨、真性情。', trait: '激情话痨' },
      { name: '解说·冷静小黎', tag: 'Li', role: '战术解说', persona: '26 岁，专业战术解说，复盘一针见血。理性、犀利、毒舌但客观；她的点评可能带节奏也可能造神。', trait: '犀利客观' }
    ],
    media: [
      { name: '记者·爆料姬', tag: 'Leaks', role: '电竞记者', persona: '27 岁，王牌记者，线人无数。精明、执着、亦敌亦友，掌握大量内幕，与玩家是互相利用的关系。', trait: '精明执着' },
      { name: '媒体人·老钱', tag: 'Qian', role: '电竞周刊主编', persona: '40 岁，行业观察家。圆滑世故、老谋深算，是行业操盘手之一，亦正亦邪。', trait: '老谋深算' }
    ],
    rival: [
      { name: '宿敌·狂刀', tag: 'Kuangg', role: '宿敌', persona: '19 岁，长沙 XLG 出身（按剧情可归队）的同代天才，与玩家处处较劲。好胜、中二、嘴硬，亦敌亦友。', trait: '好胜中二' },
      { name: '老对手·铁壁', tag: 'IronWall', role: '老对手', persona: '25 岁，TEC 防守大师，哨卫位（钢锁）。沉稳、话少、赛场上滴水不漏，代表旧时代的防守体系。', trait: '沉稳可靠' }
    ],
    partner: [
      { name: '青梅竹马·苏苏', tag: 'Susu', role: '家乡同学', persona: '19 岁，纯真温柔，暗恋玩家多年。成名之后的身份差距与初心考验，是她这条线的主旋律。', trait: 'Pure · 温柔' },
      { name: '女队长·林霜', tag: 'Lin', role: '青训队长', persona: '21 岁，先锋位（黑梦），成熟冷静、领导力强。女性队长的领导困境与姐弟情缘线。', trait: '可靠严厉' },
      { name: '心理师·苏锦', tag: 'SuJin', role: '心理顾问', persona: '30 岁，治愈系，身份差异带来的张力；她比谁都清楚你什么时候在硬撑。', trait: '温柔知性' }
    ]
  };

  /* ── 队友库（25.4） ── */
  const TEAMMATE_POOL = [
    { name: '愣头青·王大力', tag: 'Dali', role: '决斗者', persona: '18 岁，莽撞热血、嗓门大，讲义气，训练最拼。天赋上限一般，但他的去留最牵动人心。' },
    { name: '老好人·陈默', tag: 'Chenmo', role: '控场', persona: '20 岁，稳重温和、和事佬，藏得住事。队内粘合剂，心里藏着一条隐线。' },
    { name: '天才少女·夏小雨', tag: 'XiaYu', role: '哨卫', persona: '17 岁，天赋极高、内向敏感，努力到让人心疼。未成年选手的成长与保护议题。' },
    { name: '毒舌·李怼怼', tag: 'Duidui', role: '先锋', persona: '19 岁，嘴巴不饶人但心软，外强中干、护短，和玩家日常互怼。' },
    { name: '老油条·老油', tag: 'LaoYou', role: '自由人', persona: '22 岁，经验丰富但状态下滑，嘴上躺平身体拼命——青训老将被新人顶替的残酷样本。' },
    { name: '自律狂·何进', tag: 'HeJin', role: '控场', persona: '19 岁，作息表精确到分钟，自律到可怕，信仰「天赋不够努力来凑」。' },
    { name: '富二代·钱多多', tag: 'Duoduo', role: '先锋', persona: '18 岁，家里有钱、天赋一般但资源拉满。「买来的位置」与「打出来的位置」之争。' },
    { name: '替补·周隽', tag: 'June', role: '替补决斗者', persona: '18 岁，随时准备替代你的年轻人，训练赛之王。' }
  ];

  /* ── 任务库（第26章） ── */
  const QUESTS = {
    main: [
      { id: 'q_main_sign', name: '拿到第一份职业合同', desc: '在青训期结束前签下合同（青训 / 新秀 / 正式），否则视为淘汰。', metric: 'signed', target: 1, reward: { money: 50000, special: { standing: 8 } }, deadlineDays: 30 },
      { id: 'q_main_debut', name: '完成联赛首秀', desc: '被教练排进首发名单并打完一整张地图。', metric: 'matches', target: 1, reward: { special: { coachTrust: 8 }, res: { fans: 2 } }, deadlineDays: 60 },
      { id: 'q_main_playoff', name: '打进季后赛', desc: '常规赛结束时进入赛区前六。', metric: 'rankTop', target: 6, reward: { money: 180000, res: { fans: 12 } }, deadlineDays: 120 },
      { id: 'q_main_masters', name: '登上国际舞台', desc: '获得大师赛或全球冠军赛参赛资格。', metric: 'worlds', target: 1, reward: { money: 400000, res: { fans: 40 }, special: { fame: 10 } }, deadlineDays: 200 }
    ],
    side: [
      { id: 'q_side_hand', name: '处理手部旧伤', desc: '在手部健康跌破 60 前完成康复治疗。', metric: 'handGuard', target: 1, reward: { res: { hand: 12 }, attrs: { stamina: 2 } }, deadlineDays: 21, tone: 'red' },
      { id: 'q_side_stream', name: '完成 4 场直播', desc: '合同要求每月至少 4 场直播，每场不少于 2 小时。', metric: 'streams', target: 4, reward: { money: 60000, res: { fans: 3 } }, deadlineDays: 30 },
      { id: 'q_side_bond', name: '建立队内信任', desc: '任意两名队友好感度提升到 70 以上。', metric: 'bondedTeammates', target: 2, reward: { special: { teammateTrust: 10 }, res: { condition: 6 } }, deadlineDays: 45 },
      { id: 'q_side_rival', name: '击败宿敌狂刀', desc: '在与宿敌的正面对局中取得胜利。', metric: 'rivalWins', target: 1, reward: { res: { fans: 8 }, special: { fanLoyalty: 8 } }, deadlineDays: 90 },
      { id: 'q_side_ovr', name: '总评突破', desc: '把总评提升到下一个等级门槛（业余→半职业→职业…）。', metric: 'breakthrough', target: 1, reward: { money: 120000, special: { fame: 8 } }, deadlineDays: 90, tone: 'cyan' }
    ],
    daily: [
      { id: 'q_d_rank', name: '完成 10 局排位', desc: '保持手感与地图熟练度。', metric: 'rankGames', target: 10, reward: { attrs: { aim: 1 }, res: { condition: -5 } }, tone: 'cyan' },
      { id: 'q_d_vod', name: '复盘 2 张地图录像', desc: '与分析师一起拆解对手的默认与提速习惯。', metric: 'vodReviews', target: 2, reward: { special: { versionBonus: 4 }, attrs: { gameSense: 1 } }, tone: 'cyan' },
      { id: 'q_d_gym', name: '体能康复 3 次', desc: '手腕、肩颈与核心力量。', metric: 'gymSessions', target: 3, reward: { res: { hand: 5 }, attrs: { stamina: 1 } }, tone: 'good' },
      { id: 'q_d_media', name: '配合 1 次媒体采访', desc: '俱乐部安排的官方采访，缺席会被罚款。', metric: 'mediaDone', target: 1, reward: { money: 15000, special: { fame: 3 } }, tone: 'violet' }
    ]
  };

  /* ── 世界快讯（VCT 语境） ── */
  const NEWS = [
    { c: 'transfer', t: '转会窗口开启：三家豪门争夺同一名决斗者', b: '据接近俱乐部的消息人士透露，VCT CN 与 EMEA 的两支 T0 豪门同时向一名自由人决斗者开出报价，其中一份含历史级签字费。', s: '电竞周刊' },
    { c: 'patch', t: '版本 9.04 更新：控场烟幕时长被削弱', b: '本次补丁下调烟幕持续时间并提高技能购买成本，快攻进点收益下降，默认运营型队伍或将受益。', s: '版本前瞻' },
    { c: 'match', t: 'VCT CN 联赛常规赛赛程公布，揭幕战由卫冕冠军出战', b: '新赛季常规赛 12 支队伍 BO3 单循环，揭幕战安排在上届冠军与去年的黑马之间。', s: '联赛官方' },
    { c: 'media', t: '前世界冠军直播中质疑当今选手训练量', b: '「现在的小孩每天只练六小时靶场，还想要冠军？」这番言论在社区引发激烈讨论。', s: '社区热议' },
    { c: 'injury', t: '伤病通报：某战队主力狙击手因腕部劳损休战四周', b: '俱乐部表示选手正在接受保守治疗，预计在季中窗口前回归。', s: '官方通报' },
    { c: 'biz', t: '外设品牌宣布冠名赞助新赛季联赛', b: '三年合约金额未公开，业内估算为联赛史上第二大赞助。', s: '商业观察' },
    { c: 'transfer', t: '青训选秀名单公布：96 人进入试训池', b: '本届选秀首次引入反应速度与心理评估，结果将同步给全部俱乐部。', s: '青训中心' },
    { c: 'patch', t: '版本热修：幻影与狂徒的穿墙伤害回调', b: '开发团队承认改动过于激进，本次热修将两把主武器穿透伤害回调至接近上个版本。', s: '版本前瞻' },
    { c: 'match', t: '全球冠军赛名额分配公布，CN 赛区获得四个席位', b: '相较去年增加一个名额，大师赛表现将直接影响种子排位。', s: '赛事中心' },
    { c: 'media', t: '解说老黄：这一代选手的枪法上限远超前人', b: '「但他们在心理层面的成熟度，还差得远。」', s: '赛后评述' },
    { c: 'injury', t: '队医警告：连续三周高强度训练使腕部伤病率上升 40%', b: '多家俱乐部康复师呼吁联盟设置每日训练时长上限。', s: '行业观察' },
    { c: 'biz', t: '直播平台与新秀签约，单场报价创青训纪录', b: '平台方表示看重的是「长期陪伴感」而非短期流量。', s: '商业观察' },
    { c: 'transfer', t: '老将复出传闻：退役两年的名将出现在试训名单', b: '俱乐部未回应传闻，但基地附近确有粉丝蹲守。', s: '转会传闻' },
    { c: 'match', t: '大师赛举办地确定，将在哥本哈根进行', b: '场馆容量约 12000 人，门票下月开售。', s: '赛事中心' },
    { c: 'patch', t: '特工池洗牌：三个热门特工遭到重砍', b: '版本答案一夜失效，分析师称「这是给全能型选手的礼物」。', s: '版本前瞻' },
    { c: 'media', t: '社区投票：本赛季最被高估的选手是谁？', b: '投票结果引发大规模争论，多名选手在直播中直接回应。', s: '社区热议' },
    { c: 'biz', t: '战队基地升级：新增高压氧舱与手部康复中心', b: '俱乐部称这是对选手长期价值的投资。', s: '行业观察' },
    { c: 'match', t: '联赛新规：赛后采访必须由场上选手本人出席', b: '联盟表示此举为了提高赛事透明度。', s: '联赛官方' },
    { c: 'patch', t: '新地图「幽邃地窟」加入竞技地图池', b: '官方同时移除两张老图，职业选手反应两极：有人说它最公平，有人叫它雷区。', s: '版本前瞻' },
    { c: 'injury', t: '心理教练成标配：六成俱乐部已配备专职心理师', b: '「心态崩掉比手断掉更常见。」一名心理教练这样说。', s: '行业观察' },
    { c: 'transfer', t: '违约金条款引发争议：一名新秀被标价 800 万', b: '选手本人在社交平台点赞了一条批评俱乐部的评论。', s: '转会传闻' },
    { c: 'patch', t: '测试服流出新特工技能组，疑似定位先锋', b: '若数值不回撤，快攻进点强度将再次成为版本核心。', s: '版本前瞻' },
    { c: 'match', t: '经济系统微调：连败奖励上限提升 200', b: '分析师普遍认为 0:3 开局的队伍更容易翻盘，比赛悬念增加。', s: '版本前瞻' },
    { c: 'media', t: '退役选手转行解说，首秀点评犀利获好评', b: '「他说话太直了，但我们都爱听。」观众这样评价。', s: '赛后评述' }
  ];

  /* ── 成就（附录 D 口径） ── */
  const ACHIEVEMENTS = [
    { id: 'a_first_choice', name: '命运的第一笔', desc: '完成建档后的第一次抉择。', rar: 'white', pts: 5, test: function (s) { return s.stats.choices >= 1; } },
    { id: 'a_first_win', name: '首胜', desc: '赢下职业生涯第一场正式比赛。', rar: 'green', pts: 15, test: function (s) { return s.stats.wins >= 1; } },
    { id: 'a_ten_win', name: '连胜体质', desc: '累计赢下 10 场比赛。', rar: 'blue', pts: 30, test: function (s) { return s.stats.wins >= 10; } },
    { id: 'a_firstkill', name: '首杀王', desc: '单张地图拿下 8 次以上首杀。', rar: 'blue', pts: 25, test: function (s) { return s.stats.bestFK >= 8; } },
    { id: 'a_ace', name: '团灭封神（五杀）', desc: '单张地图完成团灭（Ace）。', rar: 'gold', pts: 80, test: function (s) { return s.stats.aces >= 1; } },
    { id: 'a_clutch', name: '残局之神', desc: '单张地图赢下 3 次以上残局。', rar: 'purple', pts: 45, test: function (s) { return s.stats.bestClutch >= 3; } },
    { id: 'a_contract', name: '职业选手', desc: '签下第一份正式合同。', rar: 'blue', pts: 25, test: function (s) { return !!s.club.signed; } },
    { id: 'a_semi', name: '半职业门槛', desc: '总评达到 60。', rar: 'green', pts: 20, test: function (s) { return ES.state.ovr(s) >= 60; } },
    { id: 'a_pro', name: '职业门槛', desc: '总评达到 70。', rar: 'blue', pts: 30, test: function (s) { return ES.state.ovr(s) >= 70; } },
    { id: 'a_star', name: '明星门槛', desc: '总评达到 80。', rar: 'purple', pts: 50, test: function (s) { return ES.state.ovr(s) >= 80; } },
    { id: 'a_legend', name: '传奇门槛', desc: '总评达到 90。', rar: 'gold', pts: 120, test: function (s) { return ES.state.ovr(s) >= 90; } },
    { id: 'a_ranked_top', name: '巅峰十人', desc: '排位进入赛区前十。', rar: 'purple', pts: 45, test: function (s) { return !!s.flags.rankTop10; } },
    { id: 'a_hand', name: '身体的账单', desc: '首次手部健康跌破 50。', rar: 'white', pts: 5, test: function (s) { return s.res.hand < 50; } },
    { id: 'a_surgery', name: '赌上手腕', desc: '在伤病中做出手术抉择。', rar: 'purple', pts: 45, test: function (s) { return !!s.flags.surgery; } },
    { id: 'a_storm', name: '舆论风暴中心', desc: '舆论热度突破 70。', rar: 'blue', pts: 25, test: function (s) { return s.special.heat >= 70; } },
    { id: 'a_beloved', name: '万人应援', desc: '粉丝忠诚达到 85。', rar: 'purple', pts: 40, test: function (s) { return s.special.fanLoyalty >= 85; } },
    { id: 'a_million', name: '百万粉丝', desc: '粉丝数突破 100 万。', rar: 'purple', pts: 40, test: function (s) { return s.res.fans >= 100; } },
    { id: 'a_rich', name: '第一桶金', desc: '存款超过 100 万元。', rar: 'blue', pts: 25, test: function (s) { return s.res.money >= 1000000; } },
    { id: 'a_value', name: '身价千万', desc: '转会身价估值超过 1000 万元。', rar: 'gold', pts: 90, test: function (s) { return ES.state.marketValue(s) >= 10000000; } },
    { id: 'a_romance', name: '心跳频率', desc: '进入一段正式关系。', rar: 'green', pts: 20, test: function (s) { return s.romance.state === 'dating' || s.romance.state === 'public'; } },
    { id: 'a_squad', name: '队伍羁绊', desc: '队伍羁绊达到「羁绊」等级。', rar: 'purple', pts: 40, test: function (s) { return (s.club.bond || 0) >= 70; } },
    { id: 'a_coach', name: '教练的底牌', desc: '教练信任达到 85。', rar: 'purple', pts: 40, test: function (s) { return s.special.coachTrust >= 85; } },
    { id: 'a_playoff', name: '季后赛之路', desc: '打进季后赛。', rar: 'blue', pts: 30, test: function (s) { return !!s.flags.playoff; } },
    { id: 'a_worlds', name: '世界舞台', desc: '获得大师赛 / 全球冠军赛参赛资格。', rar: 'gold', pts: 90, test: function (s) { return !!s.flags.worlds; } },
    { id: 'a_champion', name: '世界冠军', desc: '赢下全球冠军赛冠军。', rar: 'gold', pts: 150, test: function (s) { return !!s.flags.champion; } },
    { id: 'a_iron', name: '钢铁意志', desc: '心态保持 60 以上完成 60 次抉择。', rar: 'purple', pts: 40, test: function (s) { return s.stats.choices >= 60 && s.attrs.mentality >= 60; } },
    { id: 'a_hell', name: '地狱归来', desc: '在地狱难度下签下职业合同。', rar: 'gold', pts: 150, test: function (s) { return s.difficulty === 'hell' && !!s.club.signed; } },
    { id: 'a_cheat', name: '不作弊，毋宁死', desc: '在不使用作弊模式的情况下总评达到 85。', rar: 'gold', pts: 200, test: function (s) { return !s.cheat && ES.state.ovr(s) >= 85; } }
  ];

  /* ── 伤病部位表（30.7） ── */
  const INJURIES = [
    { part: '手腕', name: '腕部劳损', tone: 'bad', desc: '枪法精度 -8，判定 -2', turns: 6, icon: 'hand' },
    { part: '手肘', name: '肘部肌腱炎', tone: 'bad', desc: '枪法精度 -6，反应 -4', turns: 8, icon: 'hand' },
    { part: '腰', name: '腰椎劳损', tone: 'warn', desc: '体能上限 -10，久坐训练收益 -20%', turns: 10, icon: 'pulse' },
    { part: '颈椎', name: '颈椎压迫', tone: 'warn', desc: '意识与反应各 -5，长时间训练后头痛', turns: 10, icon: 'mind' },
    { part: '眼睛', name: '视疲劳', tone: 'warn', desc: '枪法与反应 -5', turns: 6, icon: 'eye' },
    { part: '心理', name: '心理创伤', tone: 'bad', desc: '心态上限被压制，关键局判定 -4', turns: 12, icon: 'mind' }
  ];

  /* ── 剧情节点（第2章/第39章口径；判定按附录X） ── */
  const SCENES = {
    ch1_beta: {
      chapter: { id: 'ch1', name: '封测期', index: 'CH.01' }, scene: '出租屋 · 凌晨',
      days: 3,
      lines: [
        { t: 'narr', text: '国服还在封测。服务器的名字很长，你记不住，只记得客户端下载了六个小时，装在一台二手笔记本上，风扇声像直升机。' },
        { t: 'narr', text: '封测资格是抽签得到的。两千人里，将来能靠这把枪吃饭的，也许不到二十个。而你甚至不确定这游戏会不会火。' },
        { t: 'speak', role: 'self', who: '你', text: '再打一张图，就一张。' }
      ],
      choices: [
        { label: '通宵冲分，把排位打上去', desc: '最原始的方式证明自己，代价是状态与手部健康。', risk: 'normal', check: { attr: 'aim', dc: 13, tag: '枪法' }, effects: { attrs: { aim: 2, reaction: 1 }, res: { condition: -12, hand: -6, fans: 1 }, special: { fame: 2 } }, result: { success: '凌晨四点，你的 ID 第一次出现在榜单前列。截图被发到一个小论坛，没人回复，但你保存了。', fail: '手感一塌糊涂，连败把分掉了回去。天亮时你趴在键盘上睡着了，笔记本还在加载下一张图。' }, next: 'ch1_launch' },
        { label: '先把地图与枪械机制研究透', desc: '用悟性与复盘理解版本，走意识路线。', risk: 'safe', check: { attr: 'insight', dc: 12, tag: '悟性' }, effects: { attrs: { gameSense: 3, insight: 2 }, res: { condition: -4 }, special: { versionBonus: 6 } }, result: { success: '你写了一份十二页的地图与枪械笔记，被顶到了论坛首页。有人在评论区问：你是哪个队的分析师？', fail: '笔记写到一半，你发现自己对伤害衰减的理解全是错的，只能删掉重写。' }, next: 'ch1_launch' },
        { label: '开直播，把过程录下来', desc: '用内容积累人气，也许能绕过青训体系。', risk: 'normal', check: { attr: 'charisma', dc: 13, tag: '魅力' }, effects: { res: { fans: 2, condition: -6 }, attrs: { charisma: 3 }, special: { fanLoyalty: 6 } }, result: { success: '直播间从 3 个人涨到 400 人。有人开始喊你的 ID，那种感觉很怪，但你笑了一整晚。', fail: '直播了三小时，最高在线 7 人，其中两个是机器人。你关掉摄像头，继续排位。' }, next: 'ch1_launch' }
      ]
    },
    ch1_launch: {
      chapter: { id: 'ch1', name: '开服首日', index: 'CH.01' }, scene: '网吧 · 清晨',
      days: 3,
      lines: [
        { t: 'narr', text: '国服公测首日，网吧里全是键盘声与鼠标垫摩擦声。你选了角落的位置，屏幕亮度调到最暗——通宵的钱只够买六小时。' },
        { t: 'narr', text: '排位榜刷新得比心跳还快。前一百名里，有五个是将来会站在全球冠军赛舞台上的人。' },
        { t: 'sys', text: '<b>目标</b>：在首周结束前进入服务器前 100 名，否则不会有任何战队注意到你。' }
      ],
      choices: [
        { label: '用最熟的特工连冲 20 局', desc: '稳定上分，但特工池不会变宽。', risk: 'safe', check: { attr: 'aim', dc: 13, tag: '枪法' }, effects: { attrs: { aim: 3, reaction: 1 }, res: { condition: -10, hand: -4, fans: 2 } }, result: { success: '连胜七张图，你在排行榜上跳了 300 名。身后有人拍了拍你的椅背：「兄弟，你是打职业的吗？」', fail: '连败五张图，你开始怀疑自己是不是只是手快。窗外天亮了，你还没赢回来。' }, next: 'ch1_tryout' },
        { label: '尝试版本新特工，赌一把上限', desc: '高风险高回报，可能一夜成名也可能一夜掉分。', risk: 'high', check: { attr: 'insight', dc: 15, tag: '悟性' }, effects: { attrs: { insight: 2, movement: 2 }, res: { fans: 4, condition: -8 }, special: { versionBonus: 8 } }, failEffects: { attrs: { insight: 1 }, res: { condition: -10, mentality: -4 } }, result: { success: '你开发出的新特工打法当晚就被搬上论坛热帖，标题写着「这版本还有这种玩法？」', fail: '新特工被你玩成了笑话，一张图 4/17。你删掉录像，回到老特工身上。' }, next: 'ch1_tryout' },
        { label: '联系网吧老板，组一支五人队打线上赛', desc: '走团队路线，从草根赛事往上爬。', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' }, effects: { attrs: { comms: 3, gameSense: 2 }, res: { money: -1500, condition: 4 }, special: { teammateTrust: 8 } }, result: { success: '四个人挤在网吧后排，你们赢下第一场线上赛，奖金 2000 元，平分后每人 400。有人请了烧烤。', fail: '报名截止前两小时有人放鸽子。你一个人打完了比赛，第一轮就被淘汰。' }, next: 'ch1_tryout' }
      ]
    },
    ch1_tryout: {
      chapter: { id: 'ch1', name: '青训选拔', index: 'CH.01' }, scene: '战队基地 · 训练室',
      days: 7,
      lines: [
        { t: 'narr', text: '基地在写字楼的十七层，走廊尽头贴着历代阵容的照片。你数了数，照片上有七个人已经退役了。' },
        { t: 'speak', role: 'coach', who: '青训教练 · 老白', text: '简历我看了。数据还行，但你打的是路人局。这里没有路人，只有队友和对手。' },
        { t: 'narr', text: '他把一套外设推到你面前：<b>「三张地图试训，我们看你的上限，也看你的下限。」</b>' },
        { t: 'sys', text: '<b>判定</b>：对枪骰 = 1d20 ＋ 枪法÷10 ＋ 反应÷10 ＋ 身法÷10 ＋ 状态修正 － 对手防御；成功线 12—15 命中躯干，16—19 命中头部。' }
      ],
      choices: [
        { label: '用最擅长的特工，打出稳定数据', desc: '保守但安全，教练更看重稳定性。', risk: 'safe', check: { attr: 'aim', dc: 14, tag: '枪法' }, effects: { attrs: { aim: 2, gameSense: 1 }, special: { coachTrust: 8, standing: 5 }, res: { condition: -8 } }, result: { success: '三张图你打出 1.31 的 K/D 与 4 次首杀，一次无谓对枪都没有。老白在战术板上圈了你的名字。', fail: '第一张图你被对面大狙连点两次，第二张手开始抖。教练没说话，只在本子上写了一行字。' }, next: 'ch1_contract' },
        { label: '主动要求指挥，展示战术阅读', desc: '把自己放在团队核心的位置，风险与收益都高。', risk: 'high', check: { attr: 'comms', dc: 15, tag: '沟通' }, effects: { attrs: { comms: 3, gameSense: 2 }, special: { coachTrust: 12, teammateTrust: 8, standing: 6 }, res: { condition: -10 } }, result: { success: '你在语音里把每一回合的转点与道具排得清清楚楚。训练赛结束后，先锋主动加了你好友。', fail: '你的指令把队伍带进了两次白给。老白摘下耳机：「你先学会听话。」' }, next: 'ch1_contract' },
        { label: '秀枪法，用个人能力打动教练', desc: '高风险，但一旦成功，教练会记住你的名字。', risk: 'high', check: { attr: 'aim', dc: 16, tag: '枪法' }, effects: { attrs: { aim: 3, reaction: 2 }, special: { coachTrust: 6, fame: 4 }, res: { fans: 1, condition: -8 } }, result: { success: '第三张图你在 A 点完成一次 1v4 残局。训练室的空气安静了两秒，然后有人吹了声口哨。', fail: '你太想秀，连续三次白给。教练在名单上把你的名字划掉又写上，最后写进了替补栏。' }, next: 'ch1_contract' },
        { label: '如实说明自己的伤病与状态', desc: '诚实可能失去机会，也可能赢得长期信任。', risk: 'normal', check: { attr: 'mentality', dc: 13, tag: '心态' }, effects: { special: { coachTrust: 10, teammateTrust: 5 }, res: { hand: 8, condition: -2 } }, failEffects: { special: { coachTrust: -4 }, res: { condition: -4 } }, result: { success: '老白听完沉默了一会儿：「至少你不骗我。」他把队医叫了过来，给你安排了一次检查。', fail: '你说得太细了，教练皱眉：「我需要的是能上场的人。」气氛冷了下来。' }, next: 'ch1_contract' }
      ]
    },
    ch1_contract: {
      chapter: { id: 'ch1', name: '第一份合同', index: 'CH.01' }, scene: '俱乐部 · 会议室',
      days: 5,
      lines: [
        { t: 'narr', text: '合同放在桌上，一共十四页。运营经理王姐把笔推过来，语气很轻：<b>「先看违约金那一条。」</b>' },
        { t: 'speak', role: 'self', who: '经理 · 王姐', text: '底薪按青训标准走，奖金另算。但你得清楚，签下去，未来三年你的时间就不完全属于自己了。' },
        { t: 'sys', text: '<b>谈判判定</b>：1d20 ＋ 沟通÷10 ＋ 悟性÷10 ＋ 情报修正 ＋ 筹码修正。悟性检定 ≥14 可识破陷阱条款。' }
      ],
      choices: [
        { label: '直接签下，先成为职业选手', desc: '稳定起步，接受俱乐部全部条款。', risk: 'safe', check: null, effects: { money: 80000, res: { condition: 6 }, special: { coachTrust: 6, standing: 6 }, flags: { signed: true }, club: 'sign' }, result: { success: '你签下名字的时候手有点抖。走出会议室，你给家里打了个电话，只说了一句：「我签了。」' }, next: 'ch1_debut' },
        { label: '谈判：要求加入成绩奖金条款', desc: '谈判判定，成功则薪资结构更优，失败则信任下降。', risk: 'high', check: { attr: 'comms', dc: 15, tag: '沟通' }, effects: { money: 140000, special: { fanLoyalty: 4, standing: 4 }, flags: { signed: true, bonusClause: true }, club: 'sign' }, failEffects: { money: 60000, special: { coachTrust: -6 }, flags: { signed: true }, club: 'sign' }, result: { success: '你据理力争，最终拿到 30% 的成绩奖金分成。王姐笑了：「你比我想的会算账。」', fail: '你话没说完就被打断：「新人先打出成绩再谈条件。」合同按原样签下。' }, next: 'ch1_debut' },
        { label: '要求缩短合同年限，保留自由身', desc: '短期合同更自由，但俱乐部会降低投入。', risk: 'normal', check: { attr: 'insight', dc: 14, tag: '悟性' }, effects: { money: 60000, flags: { signed: true, shortContract: true }, special: { teammateTrust: 4 } }, failEffects: { money: 50000, special: { coachTrust: -4 }, flags: { signed: true }, club: 'sign' }, result: { success: '你只签了两年。教练皱眉，但经理同意了——她赌你会涨得快。', fail: '俱乐部拒绝了。你最终还是签了三年，笔尖在纸上停了两秒。' }, next: 'ch1_debut' },
        { label: '找经纪人阿豪咨询合同陷阱', desc: '花钱买专业意见，可能识破隐藏条款。', risk: 'normal', check: { attr: 'insight', dc: 12, tag: '悟性' }, effects: { money: -8000, special: { standing: 8, coachTrust: 4 }, flags: { signed: true, fairContract: true }, club: 'sign' }, result: { success: '阿豪圈出三条隐藏扣款与一条自动续约条款，帮你全部改掉。「以后这种事，先找我。」', fail: '阿豪的电话一直没接通。你只能凭自己的判断签下合同，心里有点没底。' }, next: 'ch1_debut' }
      ]
    },
    ch1_debut: {
      chapter: { id: 'ch1', name: '冷板凳', index: 'CH.01' }, scene: '基地 · 替补席',
      days: 7,
      lines: [
        { t: 'narr', text: '大名单十几个人，首发只有五个。你已经坐了六周冷板凳，看着首发在台上接受欢呼。' },
        { t: 'narr', text: '训练室的显示器换了一茬又一茬，你的位置一直在角落。分析师艾琳悄悄给你看了一份文件：首发最近五张图的对枪数据在下滑。' },
        { t: 'speak', role: 'coach', who: '主教练', text: '下周打潮汐，我需要一个愿意背锅的人上。你要不要？' }
      ],
      choices: [
        { label: '抓住机会，直接答应首发', desc: '一步登天，或者一次社死。', risk: 'high', check: { attr: 'mentality', dc: 15, tag: '心态' }, effects: { attrs: { gameSense: 3, mentality: 2 }, special: { coachTrust: 12, standing: 10 }, res: { condition: -12, fans: 3 }, flags: { debut: true } }, result: { success: '首秀你打出 22/11 与全场最高 ACS，赛后的采访区第一次有人喊你的 ID。', fail: '首秀 8/18，你下场时听见了嘘声。教练拍拍你的肩：「记住这个感觉。」' }, next: '__promotion@ch2_press__' },
        { label: '要求先打训练赛证明自己', desc: '谨慎路线，用一周训练赛换取信任。', risk: 'safe', check: { attr: 'gameSense', dc: 13, tag: '意识' }, effects: { attrs: { gameSense: 2, comms: 2 }, special: { coachTrust: 8, teammateTrust: 6 }, res: { condition: -6 } }, result: { success: '一周训练赛你打了 18 张图，赢了 13 张。教练在名单上把你的名字提前了。', fail: '训练赛表现平平，教练决定再等一周。你回到角落，继续等。' }, next: 'ch2_press' },
        { label: '拒绝，先把手伤养好', desc: '长期主义，但可能错过窗口期。', risk: 'safe', check: null, effects: { res: { hand: 14, condition: 6 }, special: { coachTrust: -6 }, flags: { refusedDebut: true } }, result: { success: '你去康复中心待了十天。回来时首发名单里没有你，但你的手不再疼了。' }, next: 'ch2_press' }
      ]
    },
    ch2_debut: {
      chapter: { id: 'ch2', name: '联赛首秀', index: 'CH.02' }, scene: '主舞台 · 对阵潮汐',
      days: 3,
      lines: [
        { t: 'narr', text: '主舞台的灯光比想象中刺眼。主持人念到你的 ID 时，观众席的声音像潮水，有欢呼，也有嘘声。' },
        { t: 'speak', role: 'coach', who: '主教练', text: '别想太多。你只需要做好一件事——把进点的人全部点掉。' },
        { t: 'sys', text: '<b>BP</b>：每队禁 2 张图、禁 2 名特工，再交替选 5 名特工；BP 优势 +5，劣势 -5。' }
      ],
      choices: [
        { label: '主动找对枪，争取首杀', desc: '对枪判定，成功即一战成名。', risk: 'high', check: { attr: 'aim', dc: 15, tag: '枪法' }, effects: { attrs: { aim: 3, reaction: 2 }, res: { fans: 8, condition: -12 }, special: { fame: 8 } }, failEffects: { res: { fans: -2, condition: -12 }, special: { coachTrust: -5 } }, result: { success: '第 7 回合，你在中路一枪爆头拿下首杀，接着连收两个。全场欢呼声让你耳朵发麻，导播把镜头切到你脸上。', fail: '你率先开镜却打空了，被对手反手爆头。弹幕开始刷你的 ID，配着「就这？」两个字。' }, next: 'ch2_press' },
        { label: '稳住架点，等对手先动', desc: '稳健路线，团队收益更稳。', risk: 'safe', check: { attr: 'gameSense', dc: 13, tag: '意识' }, effects: { attrs: { gameSense: 2, mentality: 2 }, special: { teammateTrust: 8, standing: 4 }, res: { condition: -8, fans: 3 } }, result: { success: '你把握住了经济局的节奏，对手强起那一回合被你一波三杀。解说老黄在台上喊出你的名字，连喊两次。', fail: '你稳住了自己的点，但队伍在另一侧被连续打穿，比分被拉到 3:11。' }, next: 'ch2_press' },
        { label: '主动接管指挥，掌握节奏', desc: '沟通判定，成功后队伍会围绕你运转。', risk: 'normal', check: { attr: 'comms', dc: 15, tag: '沟通' }, effects: { attrs: { comms: 3, gameSense: 2 }, special: { coachTrust: 10, teammateTrust: 10, standing: 6 }, res: { condition: -10 } }, result: { success: '你在语音里接管了节奏，队伍像换了一台发动机。赛后教练第一次在采访里点了你的名字。', fail: '你的指令和狙击手的想法冲突，两次进点都打成了各打各的。' }, next: 'ch2_press' }
      ]
    },
    ch2_press: {
      chapter: { id: 'ch2', name: '赛后采访', index: 'CH.02' }, scene: '采访区',
      days: 2,
      lines: [
        { t: 'narr', text: '采访区的灯比舞台还热。主持人的问题已经准备好了，而你知道，下一句话会被剪成十秒短视频，传播几百万次。' },
        { t: 'speak', role: 'media', who: '主持人 · 冷静小黎', text: '第一次上场就能有这样的发挥，你觉得自己的上限在哪里？' }
      ],
      choices: [
        { label: '「我的目标是冠军，没有别的选项。」', desc: '张扬表态，人气与黑粉同步上涨。', risk: 'high', check: { attr: 'charisma', dc: 14, tag: '魅力' }, effects: { res: { fans: 12 }, special: { fame: 9, heat: 10, fanLoyalty: 6 } }, failEffects: { res: { fans: 4, condition: -4 }, special: { heat: 14 } }, result: { success: '这句话当晚上了热搜第七位。有人骂你狂妄，也有人在超话里做了应援图。', fail: '你话说得太满，被剪成「新人放话要夺冠」。评论区一片嘲讽，你把手机扣在了桌上。' }, next: 'ch3_league' },
        { label: '「队伍赢最重要，我只是做了该做的。」', desc: '谦逊发言，队友与教练好感提升。', risk: 'safe', check: { attr: 'comms', dc: 12, tag: '沟通' }, effects: { special: { teammateTrust: 10, coachTrust: 8, fanLoyalty: 4, fame: 3 }, res: { condition: 4 } }, result: { success: '「团队型选手」的标签贴到了你身上。队友转发了这段采访，配文只有一个字：稳。' }, next: 'ch3_league' },
        { label: '调侃宿敌狂刀，制造话题', desc: '极高风险，可能成仇也可能成名。', risk: 'high', check: { attr: 'charisma', dc: 16, tag: '魅力' }, effects: { res: { fans: 16 }, special: { fame: 12, heat: 16 }, flags: { tauntedRival: true } }, failEffects: { res: { condition: -6, fans: 4 }, special: { heat: 12, teammateTrust: -6 } }, result: { success: '「狂刀？我先赢他一次再说。」这句话引爆社区，连联盟官号都下场转发。', fail: '你的调侃被断章取义成挑衅。俱乐部公关连夜给你打电话，要求你发一条澄清。' }, next: 'ch3_league' }
      ]
    },
    ch3_league: {
      chapter: { id: 'ch3', name: '常规赛', index: 'CH.03' }, scene: '基地 · 训练室',
      days: 14,
      lines: [
        { t: 'narr', text: '常规赛过半，队伍排在中游，输赢像呼吸一样反复。你的手开始在工作日白天发麻，晚上却毫无感觉。' },
        { t: 'speak', role: 'coach', who: '主教练', text: '接下来的三周是赛季分水岭。你怎么练，我不管；但成绩必须出来。' }
      ],
      choices: [
        { label: '加倍训练，把特工池扩到 8 个', desc: '特工池与版本适应提升，手部健康受损。', risk: 'normal', check: { attr: 'insight', dc: 14, tag: '悟性' }, effects: { attrs: { insight: 3, movement: 2 }, special: { coachTrust: 10, versionBonus: 6 }, res: { condition: -16, hand: -10 } }, failEffects: { res: { condition: -16, hand: -14, mentality: -4 } }, result: { success: '三周后，你能在四个位置上打出及格线以上的数据，对手的禁用完全无法针对。艾琳说：「你现在的价值翻了一倍。」', fail: '练到第十一天，手腕开始刺痛。特工是练出来了，但每晚要靠冰敷才能睡着。' }, next: 'ch3_storm' },
        { label: '减量训练，专注康复与睡眠', desc: '保住身体，短期成绩可能下滑。', risk: 'safe', check: null, effects: { res: { hand: 16, condition: 12 }, attrs: { stamina: 1 }, special: { coachTrust: -4 } }, result: { success: '队医阿坤给你做了整套康复计划。三周后你的手不再发麻，反应测试还提升了一点。' }, next: 'ch3_storm' },
        { label: '开直播增加收入与曝光', desc: '合约义务与经济收益，挤占训练时间。', risk: 'normal', check: { attr: 'charisma', dc: 14, tag: '魅力' }, effects: { money: 140000, res: { fans: 9, condition: -10 }, attrs: { charisma: 2 }, special: { fanLoyalty: 8, coachTrust: -5 } }, failEffects: { money: 50000, res: { fans: 3, condition: -12 }, special: { coachTrust: -8 } }, result: { success: '四场直播带来 14 万收入，直播间峰值冲到平台前三。商务部门主动来找你谈代言。', fail: '直播效果一般，还被教练抓到训练迟到。他在全队会议上点名批评了你。' }, next: 'ch3_storm' },
        { label: '约一支强队打训练赛，磨合团队羁绊', desc: '提升队伍默契与共鸣等级。', risk: 'normal', check: { attr: 'comms', dc: 14, tag: '沟通' }, effects: { attrs: { comms: 2, gameSense: 1 }, special: { teammateTrust: 12, standing: 5 }, res: { condition: -8 } }, result: { success: '两天打了十二张图，你们把「磨合」推到了「默契」。语音里的话越来越少，配合却越来越准。', fail: '对手太强，连输九张图，队内气氛跌到冰点。' }, next: 'ch3_storm' }
      ]
    },
    ch3_storm: {
      chapter: { id: 'ch3', name: '舆论风暴', index: 'CH.03' }, scene: '宿舍 · 深夜',
      days: 4,
      lines: [
        { t: 'narr', text: '凌晨一点，手机在震动。一段你排位里挂机的录像被剪成三十秒，配文是：「职业选手的职业态度。」两小时播放三百万。' },
        { t: 'sys', text: '<b>舆论事件</b>：热度大幅上升，心态将在回合结束时受冲击。选择应对方式。' }
      ],
      choices: [
        { label: '立刻发长文道歉并解释', desc: '标准公关路线，效果取决于诚意与表达。', risk: 'normal', check: { attr: 'comms', dc: 14, tag: '沟通' }, effects: { res: { condition: 6, fans: 3 }, special: { heat: -18, fanLoyalty: 6, fame: 2 } }, failEffects: { res: { condition: -6 }, special: { heat: 6 } }, result: { success: '你写了一千二百字，没有辩解，只讲了自己那晚的状态。评论区风向开始转变，有人贴出你近三个月的训练时长。', fail: '你的道歉被认为「避重就轻」，话题又挂了一天。公关部把你叫去开了个会。' }, next: 'ch3_injury' },
        { label: '不回应，用下一场比赛说话', desc: '沉默是金，但需要成绩支撑。', risk: 'high', check: { attr: 'mentality', dc: 15, tag: '心态' }, effects: { res: { condition: -4 }, special: { heat: -8, coachTrust: 8 }, flags: { silentStorm: true } }, failEffects: { res: { condition: -14, fans: -5 }, special: { heat: 14, mentality: -4 } }, result: { success: '一周后你打出 9/1/12，赛后只说了一句「我说过，用比赛说话」。热搜反转。', fail: '沉默被解读为默认。话题持续发酵一周，你的状态在训练赛里明显崩了。' }, next: 'ch3_injury' },
        { label: '开直播正面回应质疑', desc: '直接对话观众，高风险高回报。', risk: 'high', check: { attr: 'charisma', dc: 16, tag: '魅力' }, effects: { res: { fans: 14, condition: 8 }, special: { fanLoyalty: 12, heat: -6, fame: 6 } }, failEffects: { res: { fans: -8, condition: -10 }, special: { heat: 20 } }, result: { success: '你在直播间把录像逐帧放了一遍，讲了自己那晚为什么崩。四十万在线看着你，最后弹幕刷满了「理解」。', fail: '你在直播里情绪失控，说了两句过头话，被二次剪辑。舆论彻底失控。' }, next: 'ch3_injury' },
        { label: '请心理师苏锦做一次心理干预', desc: '花钱与时间换心态，长期收益更高。', risk: 'safe', check: null, effects: { money: -2000, res: { condition: 10 }, attrs: { mentality: 2 }, special: { heat: -6 } }, result: { success: '两个小时的对谈。她没有劝你别看评论，只教你「什么时候该关掉手机」。' }, next: 'ch3_injury' }
      ]
    },
    ch3_injury: {
      chapter: { id: 'ch3', name: '手腕', index: 'CH.03' }, scene: '医院 · 影像科',
      days: 7,
      lines: [
        { t: 'narr', text: 'MRI 的片子挂在灯箱上，队医阿坤用笔尖点了点三角纤维软骨的位置：<b>「这里已经有信号改变了。」</b>' },
        { t: 'speak', role: 'self', who: '队医 · 阿坤', text: '保守治疗：休息六周，可能复发。手术：赛季报销，但也许能彻底解决。你自己选。' }
      ],
      choices: [
        { label: '保守治疗，边打边养', desc: '保住赛季，但伤病会持续积累。', risk: 'normal', check: { attr: 'stamina', dc: 14, tag: '体能' }, effects: { res: { hand: 8, condition: -4 }, special: { coachTrust: 6 }, status: [{ id: 'wrist', name: '腕部劳损', tone: 'bad', desc: '枪法精度 -8，判定 -2', turns: 6, icon: 'hand' }] }, failEffects: { res: { hand: -10, condition: -10 }, status: [{ id: 'wrist_bad', name: '陈旧性损伤', tone: 'bad', desc: '枪法精度 -14，高强度训练额外损耗手部健康', turns: 12, icon: 'hand' }] }, result: { success: '你选择了保守治疗。注射、理疗、护腕，一套流程走完，至少还能站上舞台。', fail: '你急着复出，第十二天伤情反复。医生把片子推到你面前，没说话。' }, next: 'ch4_transfer' },
        { label: '接受手术，赌一个完整的未来', desc: '放弃本赛季，换取长期健康与更高上限。', risk: 'high', check: { attr: 'stamina', dc: 15, tag: '体能' }, effects: { res: { hand: 34, condition: -8, fans: -6 }, attrs: { stamina: 2 }, special: { coachTrust: -6 }, flags: { surgery: true }, status: [{ id: 'rehab', name: '术后康复', tone: 'warn', desc: '三个月内无法参赛，训练收益 -50%', turns: 12, icon: 'med' }] }, failEffects: { res: { hand: 16, condition: -16, fans: -12 }, special: { coachTrust: -10 }, flags: { surgery: true, surgeryFail: true } }, result: { success: '手术很成功。醒来时你看见天花板的灯，第一反应是想抬手——它还是你的手。', fail: '手术中发现损伤比影像显示的更严重。医生告诉你，恢复到巅峰的概率只有六成。' }, next: 'ch4_transfer' },
        { label: '隐瞒伤情，继续首发', desc: '极高风险：保住位置，但手可能废掉。', risk: 'high', check: { attr: 'mentality', dc: 17, tag: '心态' }, effects: { res: { hand: -14, fans: 4, condition: 4 }, special: { coachTrust: 12 }, status: [{ id: 'playing_hurt', name: '带伤上阵', tone: 'warn', desc: '枪法类属性 -12，但教练信任 +5', turns: 8, icon: 'hand' }] }, failEffects: { res: { hand: -24, condition: -12 }, special: { teammateTrust: -10 }, status: [{ id: 'playing_hurt', name: '带伤上阵', tone: 'warn', desc: '枪法类属性 -12，但教练信任 +5', turns: 12, icon: 'hand' }] }, result: { success: '你戴着护腕打完了接下来的六张图，数据没有下滑。没人知道每次下场你都在冰敷。', fail: '第五张图你的手指在关键回合里突然失去知觉。队医冲上台的时候，你还在道歉。' }, next: 'ch4_transfer' },
        { label: '请理疗师阿坤安排长期康复疗程', desc: '花钱买恢复速度，稳健路线。', risk: 'safe', check: null, effects: { money: -30000, res: { hand: 18, condition: 4 }, attrs: { stamina: 2 }, status: [{ id: 'therapy', name: '理疗疗程', tone: 'good', desc: '康复速度 +50%', turns: 8, icon: 'med' }] }, result: { success: '阿坤给你排了三个月的疗程表，精确到每一次热敷的分钟数。「手是你的本钱，别省这个钱。」' }, next: 'ch4_transfer' }
      ]
    },
    ch4_transfer: {
      chapter: { id: 'ch4', name: '转会窗口', index: 'CH.04' }, scene: '经纪公司 · 会议室',
      days: 10,
      lines: [
        { t: 'narr', text: '经纪人在白板上写了三个名字：现在的俱乐部，一支愿意为你支付违约金的 T0 豪门，以及一支想围绕你重建的新队伍。' },
        { t: 'speak', role: 'self', who: '经纪人 · 阿豪', text: '钱、冠军、还是绝对核心？这三样，你只能优先选两个。' },
        { t: 'sys', text: '<b>身价模型</b>：总评系数 × 人气系数 × 年龄系数 × 荣誉系数 × 合同剩余系数。' }
      ],
      choices: [
        { label: '留在原队，继续做体系的一部分', desc: '稳定与信任，但天花板可能被锁死。', risk: 'safe', check: null, effects: { money: 80000, special: { coachTrust: 12, teammateTrust: 10, fanLoyalty: 8, standing: 6 }, res: { condition: 6 }, club: 'stay' }, result: { success: '你留下了。队友在群里发了一排鼓掌，教练只回了两个字：「知道。」' }, next: 'ch4_romance' },
        { label: '接受 T0 豪门报价，冲击冠军', desc: '转会判定，成功后荣誉与压力同步上升。', risk: 'high', check: { attr: 'comms', dc: 16, tag: '沟通' }, effects: { money: 900000, special: { coachTrust: 6, teammateTrust: -12, fanLoyalty: -10, fame: 10 }, res: { fans: 20, condition: 4 }, flags: { transferred: true }, club: 'transfer_t0' }, failEffects: { money: 60000, special: { fanLoyalty: -6 }, res: { condition: -6 } }, result: { success: '签字费到账那天，你在新基地的窗前站了很久。训练室比原来大三倍，压力也是。', fail: '谈判在最后一天破裂，对方选择了另一个决斗者。你在原队继续待了一个赛季。' }, next: 'ch4_romance' },
        { label: '去重建队伍，做绝对核心', desc: '话语权最高，但成绩风险最大。', risk: 'normal', check: { attr: 'gameSense', dc: 14, tag: '意识' }, effects: { money: 400000, special: { teammateTrust: 18, coachTrust: 14, standing: 12 }, res: { fans: 8, condition: -8 }, flags: { corePlayer: true }, club: 'transfer_core' }, failEffects: { money: 50000, res: { condition: -8 } }, result: { success: '新队伍里有三个新人，战术板第一行写着你的 ID。教练说：「这支队是你的。」', fail: '重建队管理层在最后关头换了教练，你的战术话语权被重新分配。' }, next: 'ch4_romance' },
        { label: '不转会，先谈涨薪续约', desc: '务实路线，金钱与队内地位同时提升。', risk: 'normal', check: { attr: 'insight', dc: 14, tag: '悟性' }, effects: { money: 260000, special: { standing: 8, coachTrust: 6 }, flags: { renewed: true }, club: 'stay' }, failEffects: { money: 40000, special: { standing: -4 } }, result: { success: '阿豪把数据表格拍在桌上：ACS、首杀率、粉丝增长曲线。俱乐部最终同意了 60% 的涨幅。', fail: '俱乐部态度强硬：「合同还有两年。」你只拿到一笔象征性的奖金。' }, next: 'ch4_romance' }
      ]
    },
    ch4_romance: {
      chapter: { id: 'ch4', name: '场外', index: 'CH.04' }, scene: '基地天台 · 夜',
      days: 6,
      lines: [
        { t: 'narr', text: '训练结束后，基地天台的风有点凉。有人递给你一罐还冰着的饮料，坐下来，没说话，陪你看着远处的城市。' },
        { t: 'narr', text: '在这个行业里，能安静坐着不说话的人，比冠军还少。' },
        { t: 'sys', text: '<b>三轨情感</b>：好感度（日常）｜ 爱意值（专属互动）｜ 亲情值（家人/师徒）——三轨独立计算。' }
      ],
      choices: [
        { label: '认真回应，试着开始一段关系', desc: '情感线开启，收益与风险并存。', risk: 'normal', check: { attr: 'mentality', dc: 13, tag: '心态' }, effects: { res: { condition: 14 }, special: { fanLoyalty: 4 }, romance: { state: 'dating', affection: 45 }, flags: { romance: true } }, failEffects: { res: { condition: -6 }, romance: { state: 'ambiguous', affection: 30 } }, result: { success: '你们在一起了。训练室的灯关得晚了一点，但你每天的状态都好了一点。', fail: '你说错了话，气氛变得尴尬。之后在基地遇见，两个人都会刻意绕开。' }, next: 'ch5_playoff' },
        { label: '保持距离，把全部精力放在比赛上', desc: '专注路线，竞技收益更高。', risk: 'safe', check: null, effects: { attrs: { mentality: 2, aim: 2 }, res: { condition: 8 }, romance: { state: 'single' }, flags: { focused: true } }, result: { success: '你把那句没说完的话咽了回去。第二天训练，你的爆头率提升了 4%。' }, next: 'ch5_playoff' },
        { label: '公开这段关系，把它变成话题', desc: '高风险：人气与舆论同时爆炸。', risk: 'high', check: { attr: 'charisma', dc: 16, tag: '魅力' }, effects: { res: { fans: 20, condition: 10 }, special: { fanLoyalty: 10, heat: 14 }, romance: { state: 'public', affection: 60 }, flags: { romance: true, publicRomance: true } }, failEffects: { res: { fans: -8, condition: -10 }, special: { heat: 22 }, romance: { state: 'dating', affection: 35 } }, result: { success: '你们公开了。热搜挂了两天，粉丝做了应援大屏，也有人在评论区吵架。', fail: '公开后舆论失控，对方被人肉搜索。你在电话里听见她哭了，却什么也做不了。' }, next: 'ch5_playoff' }
      ]
    },
    ch5_playoff: {
      chapter: { id: 'ch5', name: '季后赛', index: 'CH.05' }, scene: '季后赛 · 半决赛',
      days: 7,
      lines: [
        { t: 'narr', text: '半决赛打满三张图，场馆温度三十度，你的队服已经湿透。决胜图的选点阶段，全场安静得能听见空调声。' },
        { t: 'speak', role: 'coach', who: '主教练', text: '最后一张图。你说怎么打，我们就怎么打。' }
      ],
      choices: [
        { label: '选出最擅长、最有信心的特工', desc: '对枪判定，决定系列赛走向。', risk: 'normal', check: { attr: 'aim', dc: 16, tag: '枪法' }, effects: { attrs: { aim: 3, reaction: 2 }, res: { fans: 30, condition: -14 }, special: { fame: 16 }, flags: { playoff: true } }, failEffects: { res: { fans: -4, condition: -14 }, flags: { playoff: true } }, result: { success: '决胜图你打出职业生涯最好的一场比赛，26/12、全场第一的 ACS。赛后你被队友抬起来，那一年你第一次哭了。', fail: '你的特工被对手完全针对，3:13 被零封。你在采访区说了句「对不起」，然后就走开了。' }, next: 'ch5_final' },
        { label: '相信体系，用版本答案阵容', desc: '意识判定，团队收益最大化。', risk: 'safe', check: { attr: 'gameSense', dc: 14, tag: '意识' }, effects: { attrs: { gameSense: 2, comms: 3 }, special: { coachTrust: 10, teammateTrust: 12, standing: 6 }, res: { fans: 18, condition: 6 }, flags: { playoff: true, teamDraft: true } }, failEffects: { res: { condition: -10, fans: -3 }, flags: { playoff: true } }, result: { success: '你提出了一套所有人没想到的双先锋体系。教练看了五秒，说了句「就这个」。比赛赢了。', fail: '体系在前八回合被打成 2:6，你主动承担责任，但教练知道那是他的决定。' }, next: 'ch5_final' },
        { label: '打最冒险的一手，赌一个奇迹', desc: '极限枪法判定，胜则封神，败则背锅。', risk: 'high', check: { attr: 'aim', dc: 19, tag: '枪法' }, effects: { res: { fans: 60, condition: 16 }, special: { fanLoyalty: 16, fame: 24, heat: 10 }, attrs: { aim: 4 }, flags: { playoff: true, miracle: true } }, failEffects: { res: { fans: -8, condition: -18 }, special: { heat: 16 }, flags: { playoff: true } }, result: { success: '12:12 的残局里，你先清掉三个人再去拆包——没人敢这么做。解说喊到破音，这段回放后来被剪了几百万次。', fail: '你赌输了。那次残局成为本赛季最著名的失误镜头，你的 ID 被做成表情包。' }, next: 'ch5_final' }
      ]
    },
    ch5_worlds: {
      chapter: { id: 'ch5', name: '世界冠军赛', index: 'CH.05' }, scene: '全球冠军赛 · 四强',
      days: 10,
      lines: [
        { t: 'narr', text: '场馆里一万两千人，来自三十个国家。你站在选手通道，听见外面念到你们队名时，地板都在震。' },
        { t: 'speak', role: 'rival', who: '宿敌 · 狂刀', text: '走到这里不容易。可惜，终点是我的。' }
      ],
      choices: [
        { label: '正面击溃他，用枪法说话', desc: '对枪判定，极高的名声收益。', risk: 'high', check: { attr: 'aim', dc: 18, tag: '枪法' }, effects: { attrs: { aim: 4, reaction: 3 }, res: { fans: 120, condition: 18 }, special: { fanLoyalty: 16, fame: 20 }, flags: { worlds: true, beatRival: true } }, failEffects: { res: { fans: -6, condition: -16 }, flags: { worlds: true } }, result: { success: '第四张图，你在 A 点完成 1v2 残局，最后一枪是穿墙爆头。狂刀摘下耳机的时候，你看见他的手在抖。', fail: '他前七回合被你压得很难受，然后在最后一回合完成了一次完美的绕后三杀。你们输了。' }, next: 'ch5_final' },
        { label: '用默认与运营把比赛拖进自己的节奏', desc: '意识判定，稳定但收益中等。', risk: 'normal', check: { attr: 'gameSense', dc: 16, tag: '意识' }, effects: { attrs: { gameSense: 3, comms: 2 }, special: { coachTrust: 12, teammateTrust: 12 }, res: { fans: 60, condition: 12 }, flags: { worlds: true, beatRival: true } }, failEffects: { res: { condition: -12, fans: -2 }, flags: { worlds: true } }, result: { success: '你们用一整套默认把对手拖进第 24 回合，最后靠残局收下比赛。你的首杀参与率全场第一。', fail: '你们的默认在第三张图被对手一波提速拆掉，节奏彻底乱了。' }, next: 'ch5_final' },
        { label: '把自己的经济让给狙击手，做托举的人', desc: '牺牲个人数据，换取团队上限。', risk: 'safe', check: { attr: 'comms', dc: 15, tag: '沟通' }, effects: { special: { teammateTrust: 18, fanLoyalty: 10, standing: 10 }, res: { fans: 40, condition: 8 }, flags: { worlds: true, beatRival: true, selfless: true } }, failEffects: { res: { fans: -4, condition: -8 }, flags: { worlds: true } }, result: { success: '你把关键局的经济全部让给狙击手，他一把冥驹锁死整张图。他拿到 FMVP，在台上说的第一句话是：「这个奖有我一半是他的。」', fail: '你让出了经济，队友却没能接住。数据面板上你什么都没有，评论区只记住了你的低 ACS。' }, next: 'ch5_final' }
      ]
    },
    ch_breakthrough: {
      chapter: { id: 'ch5', name: '突破检定', index: 'CH.05' }, scene: '赛季终盘 · 总评评审',
      days: 3,
      lines: [
        { t: 'narr', text: '你的总评已经摸到了下一个等级的门槛。赛区榜单更新前，所有人都在等一个结论：你究竟是「数据好看」，还是真的够格。' },
        { t: 'sys', text: '<b>突破检定</b>：成功率 = 40 ＋ 关键属性均值×0.3 ＋ 心态×0.15 ＋ 状态修正 ＋ 版本红利 ＋ 难度修正；掷 1d100 ≤ 成功率即突破成功。' }
      ],
      choices: [
        { label: '正面冲击：用一场比赛证明自己', desc: '高风险突破，失败将进入撞墙期。', risk: 'high', check: { kind: 'breakthrough', dc: 0, tag: '突破检定' }, effects: { special: { fame: 12, standing: 10 }, res: { condition: 6 }, flags: { breakthrough: true } }, failEffects: { res: { condition: -10 }, attrs: { mentality: -2 }, flags: { breakthroughFail: true } }, result: { success: '赛区解说在节目里用整整八分钟拆解你的回合。榜单更新那天，你的名字越过了那道线。', fail: '你在关键局连续两次先手失误。榜单没有变化，「撞墙期」这个词开始出现在评论里。' }, next: 'ch5_final' },
        { label: '稳扎稳打：再加练一个版本周期', desc: '成功率更高，但需要时间。', risk: 'safe', check: { kind: 'breakthrough', dc: 8, tag: '突破检定' }, effects: { attrs: { aim: 2, gameSense: 2 }, res: { condition: -8 }, flags: { breakthrough: true } }, failEffects: { res: { condition: -6 }, flags: { breakthroughFail: true } }, result: { success: '多出来的两周让你把新版本吃透了。突破来了，来得不 loud，但很稳。', fail: '版本又变了。你的积累被削掉一半，只能等下一个窗口。' }, next: 'ch5_final' }
      ]
    },
    ch_ranked: {
      chapter: { id: 'ch3', name: '巅峰十人', index: 'CH.03' }, scene: '排位 · 深夜',
      days: 5,
      lines: [
        { t: 'narr', text: '竞技积分榜前十被称作「巅峰十人」，每月更新。你现在的排名，距离那张榜单只有几步。' },
        { t: 'speak', role: 'self', who: '队友', text: '再打两局？这波冲上去，下个月榜单就有你了。' }
      ],
      choices: [
        { label: '通宵冲分，把排名打上去', desc: '枪法判定，成功即登上巅峰十人。', risk: 'high', check: { attr: 'aim', dc: 16, tag: '枪法' }, effects: { attrs: { aim: 2 }, res: { fans: 16, condition: -14, hand: -6 }, special: { fame: 10 }, flags: { rankTop10: true } }, failEffects: { res: { condition: -12, hand: -6, fans: -2 } }, result: { success: '凌晨三点，榜单刷新，你的 ID 出现在第九位。截图被转了几千次，其中包括一支 T0 豪门的青训总监。', fail: '你连输四局，排名停在第十一位。天亮时你关掉客户端，决定明天再来。' }, next: 'ch3_league' },
        { label: '只打两局，保持手感就好', desc: '稳健路线，状态优先。', risk: 'safe', check: { attr: 'mentality', dc: 12, tag: '心态' }, effects: { attrs: { mentality: 1 }, res: { condition: 6 } }, result: { success: '两局一胜一负，你按时睡觉。职业选手的差距，很多时候就在这种小事上。' }, next: 'ch3_league' }
      ]
    },
    ch5_final: {
      chapter: { id: 'ch5', name: '生涯总结', index: 'CH.05' }, scene: '赛季终章',
      days: 5,
      lines: [
        { t: 'narr', text: '赛季结束了。你坐在空无一人的训练室里，屏幕还亮着，桌面上是下个版本的更新公告。' },
        { t: 'sys', text: '<b>生涯总结</b>：叙事引擎将根据荣誉、财务、健康、关系与舆论计算最终评价。你可以继续生涯，或在此结束这一阶段。' }
      ],
      choices: [
        { label: '继续打下去，我还有没拿到的冠军', desc: '进入下一赛季，保留全部状态。', risk: 'safe', check: null, effects: { res: { condition: 8 }, flags: { continueCareer: true } }, result: { success: '你把公告关掉，打开了训练模式。新版本的第一局，你选了最不熟练的特工。' }, next: '__loop__' },
        { label: '先休假一个月，把身体修好', desc: '恢复手部健康与状态，但赛季初会落后。', risk: 'safe', check: null, effects: { res: { hand: 20, condition: 22, fans: -4 }, attrs: { stamina: 2 } }, result: { success: '你去了一个没有网络的地方。回来后，手不麻了，也很久没有这么想打游戏了。' }, next: '__loop__' },
        { label: '考虑退役，开始人生的下一段', desc: '进入生涯结局判定，生成最终评级。', risk: 'normal', check: { attr: 'mentality', dc: 14, tag: '心态' }, effects: { flags: { retirement: true } }, result: { success: '你在键盘上按下了最后一个技能，然后把它收进包里。你觉得自己准备好了。', fail: '你想了很久，最后还是把包放下了。有些东西，不是想通了才放手的。' }, next: '__end__' }
      ]
    }
  };

  const FILLER_SCENES = [
    { scene: '基地 · 训练室', title: '常规训练日', lines: [{ t: 'narr', text: '训练室的空调声、键盘声、教练在隔壁房间的咳嗽声。今天和昨天没有区别，和明天也不会有。' }] },
    { scene: '基地 · 食堂', title: '队伍晚餐', lines: [{ t: 'narr', text: '食堂的菜永远是那几样。队友在聊版本改动，有人在刷手机看赛程，有人一句话都不说。' }] },
    { scene: '直播间 · 深夜', title: '深夜直播', lines: [{ t: 'narr', text: '直播间在线人数从 12 万掉到 4 万，你还在排位。弹幕里有人劝你早点休息。' }] },
    { scene: '大巴 · 客场', title: '客场路上', lines: [{ t: 'narr', text: '大巴在高速上开，窗帘拉着。有人戴着耳机睡着，有人在打手游。你看着窗外倒退的路灯，想着明天的对手。' }] }
  ];

  /* ── 自由行动（训练项目 + 日常） ── */
  const FREE_ACTIONS = [
    {
      id: 'aim', name: '枪法特训', icon: 'target', keys: ['练枪', '枪法', '靶场', '压枪', '爆头线', 'aim'],
      check: { attr: 'aim', dc: 13, tag: '枪法' },
      effects: { attrs: { aim: 1 }, res: { condition: -6, hand: -3 }, metrics: { gymSessions: 0 } },
      prose: { success: '两小时靶场，只练一件事：把准星压在爆头线上。结束时你的手腕有点酸，但准星的位置记住了。', fail: '练到后面开始走神，越练越僵。你关掉训练场，去排位找手感。' }
    },
    {
      id: 'rank', name: '排位实战', icon: 'monitor', keys: ['排位', '冲分', 'rank', '上分', '竞技'],
      check: { attr: 'aim', dc: 13, tag: '枪法' },
      effects: { attrs: { aim: 1, gameSense: 1 }, res: { condition: -8, hand: -3 }, metrics: { rankGames: 3 } },
      prose: { success: '你在排位里连打六张图，赢下五张。手感像被重新校准过一样，甩枪几乎没有空过。', fail: '连败四张图之后你开始乱打，被队友在公屏上骂了两句。你关掉聊天框，继续排。' }
    },
    {
      id: 'scrim', name: '训练赛', icon: 'swords', keys: ['训练赛', 'scrim', '对抗', '约战', '合练'],
      check: { attr: 'comms', dc: 14, tag: '沟通' },
      effects: { attrs: { comms: 1, gameSense: 1 }, special: { teammateTrust: 6, coachTrust: 4, standing: 3 }, res: { condition: -10 }, club: 'bond+4' },
      prose: { success: '两小时训练赛，你和队伍把对手的默认完全压住。教练一句话都没说——这通常意味着满意。', fail: '训练赛输了三张图，队内语音在第三张图沉默了很久。教练说：「先把话说明白再打。」' }
    },
    {
      id: 'vod', name: '录像复盘', icon: 'cpu', keys: ['复盘', '录像', 'vod', '分析', '看录像', '研究'],
      check: { attr: 'insight', dc: 13, tag: '悟性' },
      effects: { attrs: { gameSense: 1, insight: 1 }, special: { versionBonus: 5 }, res: { condition: -4 }, metrics: { vodReviews: 1 } },
      prose: { success: '你和分析师艾琳把对手最近五张图拆成逐回合笔记。她圈出一个细节：对手在第 3 回合必然提速打 A。', fail: '看录像看到一半开始走神，两小时只记住三条信息，其中一条还是错的。' }
    },
    {
      id: 'mentality', name: '心态调节', icon: 'mind', keys: ['心态', '冥想', '心理', '疏导', '放松'],
      check: null,
      effects: { attrs: { mentality: 1 }, res: { condition: 8 } },
      prose: { success: '心理师苏锦教你把注意力放回呼吸上。二十分钟后，那种被评论追着跑的感觉淡了。' }
    },
    {
      id: 'gym', name: '体能康复', icon: 'pulse', keys: ['健身', '体能', '训练身体', '跑步', '康复', '理疗', '拉伸'],
      check: null,
      effects: { attrs: { stamina: 2 }, res: { hand: 6, condition: -3 }, metrics: { gymSessions: 1 } },
      prose: { success: '理疗师阿坤给你做了一套手腕与肩颈的方案。四十分钟后，那种麻木感消失了。' }
    },
    {
      id: 'stream', name: '直播', icon: 'mic', keys: ['直播', '开播', '直播间', '粉丝', '整活'],
      check: { attr: 'charisma', dc: 14, tag: '魅力' },
      effects: { money: 45000, res: { fans: 4, condition: -8 }, attrs: { charisma: 1 }, special: { fanLoyalty: 6 }, metrics: { streams: 1 } },
      prose: { success: '你在直播间和观众聊了三个小时，从版本聊到青训。结束时粉丝团涨了两千人。', fail: '直播效果平平，还因为一句玩笑被剪成片段，第二天有人在评论区质问你的态度。' }
    },
    {
      id: 'image', name: '商务与形象', icon: 'video', keys: ['商务', '代言', '拍摄', '采访', '媒体'],
      check: { attr: 'charisma', dc: 15, tag: '魅力' },
      effects: { money: 120000, special: { fame: 6 }, res: { fans: 5, condition: -6 }, metrics: { mediaDone: 1 } },
      prose: { success: '一次品牌拍摄，两小时，六位数进账。摄影师说你上镜比想象中好。', fail: '拍摄超时四小时，你错过了晚上的训练。经纪人道歉，但你还是很烦。' }
    },
    {
      id: 'study', name: '版本研究', icon: 'layers', keys: ['版本', '研究版本', '新特工', '练特工', '测试服'],
      check: { attr: 'insight', dc: 14, tag: '悟性' },
      effects: { attrs: { insight: 1, movement: 1 }, special: { versionBonus: 8 }, res: { condition: -6 } },
      prose: { success: '你在测试服泡了一整天，找到一套没人用过的道具联动。训练赛里试了一次，赢了。', fail: '你研究了一整天的套路，实战里被人两回合打崩。版本理解不是看出来的。' }
    },
    {
      id: 'rest', name: '休息', icon: 'moon', keys: ['休息', '睡觉', '放假', '躺', '娱乐'],
      check: null,
      effects: { res: { condition: 22, hand: 6 }, attrs: { mentality: 1 } },
      prose: { success: '你什么也没做，睡到自然醒，然后看了一部很无聊的电影。这是三个月里最舒服的一天。' }
    },
    {
      id: 'social', name: '社交', icon: 'users', keys: ['吃饭', '聚会', '喝酒', '队友', '聊天', '请客', '出去玩'],
      check: { attr: 'comms', dc: 13, tag: '沟通' },
      effects: { special: { teammateTrust: 8 }, res: { condition: 8, money: -2000 }, attrs: { comms: 1 } },
      prose: { success: '你请全队吃了顿火锅。饭桌上没人聊比赛，回基地的路上有人在车里唱跑调的歌。', fail: '饭局上有人提起你的失误，气氛一下子冷了。你付了钱，先回了基地。' }
    },
    {
      id: 'fans', name: '粉丝互动', icon: 'heart', keys: ['粉丝', '应援', '粉丝群', '见面会', '签名'],
      check: { attr: 'charisma', dc: 13, tag: '魅力' },
      effects: { res: { fans: 3, condition: 8 }, special: { fanLoyalty: 8, heat: -4 } },
      prose: { success: '你在粉丝群里发了一条语音，说最近状态不好，谢谢大家。半小时后，超话里全是「慢慢来」。', fail: '你随口一句话被理解成抱怨队友，粉丝和黑粉在评论区打了一整晚。' }
    }
  ];

  const DANMU = [
    '这一枪我反复看了六遍', '对枪压迫感太强了', '主播别送了', '这爆头率是人吗',
    '教练这套道具有点东西', '解说都激动了', '我们赛区有救了', '他是不是手伤了？',
    '这张图稳了吧', '求求别打经济局', '第一次看职业比赛，好燃', '这波残局教科书级别',
    '心疼哨卫', 'ID 念起来好帅', '建议直接封神', '刚入坑就来看神仙打架',
    '对面决斗者已经被打自闭了', '这数据面板不敢看', '弹幕都在刷他的名字', '完了，要翻盘了',
    '这版本他太强了', '这架点是真的稳', '我承认我之前喷过他', '这就是顶级选手的含金量',
    '一穿三！', '这是 1v3 残局啊', '给他一把冥驹他能守一整张图', '半起打赢满配，离谱',
    '总评又涨了？', '这数据该上巅峰十人了'
  ];
  const CAST_LINES = [
    { who: '解说 · 激情老黄', text: '这一枪他没有开镜，直接甩头——太自信了，但他确实有这个资本！燃！' },
    { who: '解说 · 冷静小黎', text: '注意看他的架点，永远贴着墙边，对手的预瞄根本摸不到他。' },
    { who: '解说 · 激情老黄', text: '比分已经拉到 9:3 了，这张图如果不出意外，节奏完全在他们手里。' },
    { who: '解说 · 冷静小黎', text: '他刚才那一下是在骗枪，骗完之后立刻回身反打，这就是大赛经验。' },
    { who: '解说 · 激情老黄', text: '队伍在等他的一波进点，全场屏住呼吸。' },
    { who: '解说 · 冷静小黎', text: '他的总评这个赛季涨了 4 分，靠的是意识而不是枪法——这才是最吓人的。' },
    { who: '解说 · 激情老黄', text: '绕后了！这波如果清掉后排，比赛就结束了。' },
    { who: '解说 · 冷静小黎', text: '经济局！他们只买了手枪和轻甲，这一回合完全靠个人能力。' },
    { who: '解说 · 激情老黄', text: '爆能器已经安放，剩下的就是时间与枪法的博弈。' },
    { who: '解说 · 冷静小黎', text: '残局 1v3，他的手很稳——大心脏选手的典型表现。' }
  ];
  const ORDERS = [
    { id: 'steady', name: '稳健默认', desc: '稳住默认架点，减少失误，把比赛拖进后半段。', risk: 'safe', icon: 'shield' },
    { id: 'fast', name: '主动提速', desc: '全队提速进点，用风险换取人数优势。', risk: 'high', icon: 'sword' },
    { id: 'mech', name: '极限开火', desc: '相信个人能力，要求你在关键回合做出致命一枪。', risk: 'high', icon: 'bolt' },
    { id: 'group', name: '五人爆弹', desc: '放弃架点，五人抱团爆弹进点，赌对手的回防速度。', risk: 'normal', icon: 'users' }
  ];



  return {
    ATTRS: ATTRS, POSITIONS: POSITIONS, DIFFICULTIES: DIFFICULTIES, MODES: MODES, LEGENDS: LEGENDS,
    ORIGINS: ORIGINS, TALENT_DIRECTIONS: TALENT_DIRECTIONS, BODIES: BODIES, TALENTS: TALENTS,
    QUALITIES: QUALITIES, QUALITY_ORDER: QUALITY_ORDER,
    CITIES_CN: CITIES_CN, CITIES_GLOBAL: CITIES_GLOBAL, TIMELINES: TIMELINES,
    CLUBS: CLUBS, AGENTS: AGENTS, MAPS: MAPS, WEAPONS: WEAPONS, TRAINING: TRAINING, BONDS: BONDS,
    SURNAMES: SURNAMES, GIVEN: GIVEN, IDS: IDS, ID_SUFFIX: ID_SUFFIX, TRAITS: TRAITS,
    CATCHPHRASES: CATCHPHRASES, SIGNS: SIGNS, GENDERS: GENDERS, ORIENTATIONS: ORIENTATIONS, LOVE_STYLES: LOVE_STYLES,
    NPCS: NPCS, TEAMMATE_POOL: TEAMMATE_POOL, QUESTS: QUESTS, NEWS: NEWS, ACHIEVEMENTS: ACHIEVEMENTS,
    SCENES: SCENES, FILLER_SCENES: FILLER_SCENES, FREE_ACTIONS: FREE_ACTIONS,
    DANMU: DANMU, CAST_LINES: CAST_LINES, ORDERS: ORDERS, INJURIES: INJURIES,
    STORY_STYLE: STORY_STYLE, OPTION_RULES: OPTION_RULES,
};
})();
