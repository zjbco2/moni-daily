// 专题详情页测试版 - 可视化数据
// 验证用，不影响 detail.html
// 数据暴露给 window，由 HTML 内联脚本中的 Vue 使用

(function() {

  window.EVENT_TIMELINE = [
    { date: '20260329', emoji: '💥', level: 'conflict', title: '战事爆发', desc: '美以对伊朗发动空袭，霍尔木兹海峡船流量暴跌95%' },
    { date: '20260330', emoji: '💥', level: 'conflict', title: '地面行动', desc: '德黑兰遭两轮空袭，超120枚弹药投向伊朗设施；美军被曝拟开展地面行动' },
    { date: '20260331', emoji: '🔴', level: 'negotiation', title: '强硬表态', desc: '伊朗批准霍尔木兹通行收费；特朗普威胁摧毁石油设施' },
    { date: '20260401', emoji: '💥', level: 'conflict', title: '全面反击', desc: '伊朗联合真主党、胡塞武装同时袭击以色列；特朗普威胁退出北约' },
    { date: '20260402', emoji: '💥', level: 'conflict', title: '导弹反击', desc: '伊朗超100枚导弹打击以色列全境；特朗普称话音刚落导弹就来了' },
    { date: '20260403', emoji: '⚡', level: 'turning', title: '战局升级', desc: '普京出手推动停火；伊朗革命卫队击落F-35，飞行员疑似被俘' },
    { date: '20260404', emoji: '💥', level: 'conflict', title: '石化空袭', desc: '美以对伊朗西南石化枢纽发动空袭；伊朗首艘LNG船穿越霍尔木兹' },
    { date: '20260405', emoji: '💥', level: 'conflict', title: '斩首行动', desc: '特朗普宣称打死多名伊朗军事领导人；美以空袭原美国驻伊朗使馆区域' },
    { date: '20260406', emoji: '🟡', level: 'negotiation', title: '谈判信号', desc: '伊朗导弹击中以色列城市；停火框架方案出台，市场大涨' },
    { date: '20260407', emoji: '🟡', level: 'negotiation', title: '首次停火', desc: '最后通牒到期；美伊谈判，停火传来，油价盘中暴跌' },
    { date: '20260409', emoji: '🔴', level: 'conflict', title: '停火破裂', desc: '霍尔木兹海峡再次关闭；伊朗革命卫队宣布复仇不会停止' },
    { date: '20260410', emoji: '⚠️', level: 'escalation', title: '伤亡惨重', desc: '世卫组织：2400人死亡；布伦特原油突破97美元' },
    { date: '20260412', emoji: '⚡', level: 'turning', title: '谈判破裂', desc: '万斯确认谈判未达成共识；美舰夹尾逃离霍尔木兹，"30分钟击沉"威慑奏效' },
    { date: '20260414', emoji: '🔴', level: 'conflict', title: '再次封锁', desc: '特朗普下令封锁伊朗港口，霍尔木兹海峡"战争状态"再度升级' },
  ];

  window.STANCE_CARDS = [
    { flag: '🇺🇸', name: '美国', color: '#1a4a8a', summary: '封锁霍尔木兹、极限施压', recentActions: ['4月14日 下令封锁伊朗港口','4月12日 谈判破裂，副总统万斯返美','4月7日 设最后通牒，后延期'], stance: '强硬' },
    { flag: '🇮🇷', name: '伊朗', color: '#1a6b3a', summary: '强硬反击、核谈判严苛', recentActions: ['4月14日 伊朗愿谈判，特朗普：闭嘴收手','4月12日 开出"四项不可谈判条件"','4月7日 青年人链护核设施'], stance: '强硬' },
    { flag: '🇵🇰', name: '巴基斯坦', color: '#2d7d2d', summary: '居中调解、提供谈判场所', recentActions: ['4月12日 美伊谈判场所','4月7日 拟定停火框架方案'], stance: '调解' },
    { flag: '🇨🇳', name: '中国', color: '#c41e3a', summary: '呼吁停火、提供斡旋渠道', recentActions: ['4月14日 驻伊大使20分钟电话劝阻','3月31日 中巴联合发布五点倡议'], stance: '斡旋' },
    { flag: '🇬🇧', name: '英国', color: '#1a4a8a', summary: '召集35国开会、推动通航', recentActions: ['4月3日 召集35国开会','4月1日 海上安全倡议'], stance: '斡旋' },
    { flag: '🇷🇺', name: '俄罗斯', color: '#4a1a1a', summary: '推动停火、撤走核电站人员', recentActions: ['4月3日 普京准备推动解决冲突','4月4日 从布什尔核电站撤侨198人'], stance: '斡旋' },
  ];

  window.KEY_MOMENTS = [
    { emoji: '🚀', date: '4月7日', title: '停火传来', quote: '巴基斯坦拟定两步走框架：先停火重开海峡，20天内达成最终协议', context: '市场反应：加密货币大涨、油价跳水' },
    { emoji: '💨', date: '4月11日', title: '美舰夹尾逃离', quote: '伊朗：美帝夹着尾巴逃跑了', context: '霍尔木兹危机再升级' },
    { emoji: '🛡️', date: '4月7日', title: '人链护核', quote: '伊朗青年手拉手组成人墙，将核设施团团围住', context: '血肉之躯抵挡空袭' },
    { emoji: '💀', date: '4月3日', title: 'F-35被击落', quote: '伊朗革命卫队：在伊斯法罕南部击落美F-35，公布解体碎片照片', context: '飞行员疑似被俘' },
  ];

})();
