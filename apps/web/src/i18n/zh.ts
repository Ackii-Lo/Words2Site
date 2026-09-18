import type en from "./en.js";

/** 中文字典：key 集合由 en 推导，编译期强制两语言对齐（漏 key 即报错） */
const dict: Record<keyof typeof en, string> = {
  /* 语言切换器 */
  "lang.switch": "切换语言",

  /* /start 壳与步骤机 */
  "home.step.intro": "欢迎",
  "home.step.form": "填写信息",
  "home.step.waiting": "生成中",
  "home.step.done": "完成",
  "home.stepOf": "步骤 {n} / {total}",
  "home.backToScreen": "返回现场大屏",

  /* ① 欢迎 */
  "intro.title": "一句话，生成你的网页",
  "intro.sub": "填好信息交给 AI\n几分钟后网址就会发到你的邮箱",
  "intro.how1": "填写邮箱、网址和网页描述",
  "intro.how2": "AI 现场为你生成网页",
  "intro.how3": "自动发布，网址发送到你的邮箱",
  "intro.start": "开始体验",

  /* ② 填写信息 */
  "form.descLabel": "描述你想要的网页",
  "form.descPlaceholder":
    "比如：做一个介绍我家猫咪的网页，粉色可爱风，要有照片墙…",
  "form.emailLabel": "宁诺邮箱（只填前缀）",
  "form.emailPh": "li.zhou",
  "form.domainLabel": "为你的网页选个网址",
  "form.urlPrefix": "你的网址：https://",
  "form.publicTitle": "上大屏展示",
  "form.publicDesc":
    "勾选后你的网页会出现在现场大屏上滚动展示；\n不勾选仅自己通过链接访问",
  "form.submit": "让 AI 生成！",
  "form.submitting": "提交中…",

  /* ③ 生成中 / 卡住 */
  "waiting.title": "你的网页正在搭建…",
  "waiting.sub": "完成后网址会发送到你的邮箱：{email}",
  "waiting.failedTitle": "啊哦，卡住了",
  "waiting.retry": "点击刷新",
  "waiting.help": "找工作人员帮忙",
  "waiting.errorCode": "错误码",

  /* ④ 完成 */
  "done.title": "网页发布成功！",
  "done.mailed": "网址也已发送到你的邮箱：{email}",
  "done.restart": "帮朋友也做一个 →",

  /* 凭证卡 */
  "cert.urlLabel": "你的网页地址",
  "cert.stamp": "凭此页面找工作人员集章",
  "cert.qrAlt": "核验二维码",
  "cert.no": "凭证编号 · {code}",

  /* 大屏 */
  "screen.badge": "现场大屏 · 投影",
  "screen.onlinePre": "已上线 ",
  "screen.onlinePost": " 个网页",
  "screen.demo": "演示模式 ×{n}",
  "screen.start": "开始制作你的网页",

  /* 大屏卡片外壳 */
  "film.proof": "凭证",
  "film.proofCode": "凭 · {code}",

  /* 核验页 */
  "verify.title": "集章核验",
  "verify.loading": "核验中…",
  "verify.invalidHint": "凭证无效，请与参与者确认编号，或到管理台查询任务",
  "verify.codeLabel": "凭证编号",
  "verify.published": "已发布 · 可集章",
  "verify.removed": "已下线",
  "verify.abnormal": "状态异常： {status}",
  "verify.promptLabel": "参与者描述",
  "verify.created": "创建：",
  "verify.finished": "完成：",
  "verify.view": "查看已发布的网页",
  "verify.confirm": "确认无误后，给参与者盖章",
};

export default dict;

/** 生成中轮换文案（与 en.ts 一一对应） */
export const waitingMessages = [
  "AI正在一块块搬砖砌你的网页…",
  "正在给你的网页挑一个合适的字体…",
  "网页刚做完热身运动，马上就出来见你",
  "正在用Ctrl+Z撤销几个用错的设计…",
  "灵感只在咖啡凉了之后才来",
  "这段话正在被一个AI看，但AI假装没看懂",
  "世界上第一个网页诞生于1991年，长得非常朴素",
  "HTTP里的404是「找不到」，418是「我是茶壶」",
  "宁诺计算机系有且只有一个直属学生团体——Computer Psycho Union",
  "CPU由三个部门组成：主席团·技术部·宣传策划部",
  "CPU每周都有周常活动：技术分享、Workshop、校内XCPC、师生茶话会、UNNC黑客松",
  "CPU做过这些项目：抽奖系统、会议签到、群二维码录取认证、UNNC黑客松评分Agent",
];
