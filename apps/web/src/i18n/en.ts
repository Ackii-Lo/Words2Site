/** 英文字典（默认语言）。key 扁平、按页面命名空间分组；{x} 为插值占位 */
const dict = {
  /* 语言切换器 */
  "lang.switch": "Language",

  /* /start 壳与步骤机 */
  "home.step.intro": "Welcome",
  "home.step.form": "Your Info",
  "home.step.waiting": "Generating",
  "home.step.done": "Done",
  "home.step.sent": "Submitted",
  "home.stepOf": "Step {n} / {total}",
  "home.backToScreen": "Back to the live wall",

  /* ① 欢迎 */
  "intro.title": "One sentence, one website",
  "intro.sub":
    "Fill in the form and hand it to the AI.\nThe URL lands in your inbox in a few minutes.",
  "intro.how1": "Fill in your email, address and description",
  "intro.how2": "The AI builds your page on the spot",
  "intro.how3": "Auto-published — the URL goes to your inbox",
  "intro.start": "Start",
  "intro.noticeBar": "BEFORE WE START",
  "intro.noticeTitle": "About the page you'll get in this event",
  "intro.noticeLead":
    "The site we generate is a single HTML page — if you'd like to add more complex logic, it may not be able to deliver that.",
  "intro.noticeCanTitle": "Can do",
  "intro.noticeCan1": "Rich text, images and layout",
  "intro.noticeCan2": "Animations and interactions",
  "intro.noticeCantTitle": "Cannot",
  "intro.noticeCant1": "Sign-in and accounts",
  "intro.noticeCant2": "Storing data, payments or emails",
  "intro.noticeCant3": "Realtime multi-user features",
  "intro.noticeOk": "Start describing",

  /* ② 填写信息 */
  "form.descLabel": "Describe the page you want",
  "form.descPlaceholder":
    "e.g. A page about my cat — cute, pink, with a photo wall…",
  "form.emailLabel": "UNNC email — prefix only",
  "form.emailPh": "li.zhou",
  "form.domainLabel": "Pick a web address",
  "form.domainChecking": "Checking availability…",
  "form.domainFree": "Available",
  "form.domainTaken": "Already taken — try another",
  "form.domainInvalid":
    "3–31 chars — lowercase letters, digits and hyphens only",
  "form.pageLangLabel": "Page language",
  "form.publicLabel": "Visibility",
  "form.publicOn": "Scroll on the live wall",
  "form.publicOff": "Private link only",
  "form.publicDesc": "Toggle to show your page to all.",
  "form.submit": "Let AI build it!",
  "form.submitting": "Submitting…",

  /* ③ 生成中 / 卡住 */
  "waiting.title": "Building your page…",
  "waiting.sub": "Done? The URL will be sent to: {email}",
  "waiting.failedTitle": "Oops, stuck",
  "waiting.retry": "Tap to retry",
  "waiting.help": "Ask staff for help",
  "waiting.errorCode": "Error",

  /* ④ 完成（手机端） */
  "done.title": "Your page is live!",
  "done.mailed": "The URL has also been emailed to: {email}",
  "done.restart": "Make one for a friend →",

  /* ③' 已提交（电脑端：提交即释放） */
  "sent.title": "Submitted — the AI takes it from here",
  "sent.sub":
    "Your page and stamp code will be emailed\nto the inbox below shortly — please wait.",
  "sent.confirm": "Got it — next one, please",

  /* 凭证卡 */
  "cert.urlLabel": "Your page URL",
  "cert.stamp": "Show this page to staff for a stamp",
  "cert.qrAlt": "Verification QR code",
  "cert.no": "Stamp code · {code}",

  /* 大屏（filmRibbon SVG 文案，EN 需短避免固定坐标溢出） */
  "screen.badge": "LIVE WALL",
  "screen.onlinePre": "",
  "screen.onlinePost": " PAGES ONLINE",
  "screen.demo": "DEMO ×{n}",
  "screen.start": "Start building your page",
  /* 大屏文字全场共见：中英同显，不随语言切换 */
  "screen.qrMain":
    "也可在自己设备上尝试!\nAlternatively, try it on your own device!",
  "screen.qrAlt": "QR code to the start page",

  /* 大屏卡片外壳 */
  "film.proof": "PROOF",
  "film.proofCode": "Proof · {code}",

  /* 核验页 */
  "verify.title": "Stamp Verification",
  "verify.loading": "Checking…",
  "verify.invalidHint":
    "Invalid code — check with the participant, or look it up in the admin console.",
  "verify.codeLabel": "Stamp code",
  "verify.published": "Published · stamp ready",
  "verify.removed": "Offline",
  "verify.abnormal": "Unexpected status: {status}",
  "verify.promptLabel": "Participant's description",
  "verify.created": "Created:",
  "verify.finished": "Finished:",
  "verify.view": "View the published page",
  "verify.confirm": "Verified? Give the participant a stamp.",
};

export default dict;

/** 生成中轮换文案（与 zh.ts 一一对应） */
export const waitingMessages = [
  "The AI is laying bricks for your page, one by one…",
  "Picking the perfect font for your page…",
  "Your page just finished warming up — almost showtime.",
  "Pressing Ctrl+Z on a few questionable design choices…",
  "Inspiration only arrives once the coffee goes cold.",
  "An AI is reading this sentence and pretending it didn't.",
  "The first website, built in 1991, was remarkably plain.",
  "HTTP 404 means not found; 418 means “I'm a teapot”.",
  "UNNC's CS department has exactly one student society — Computer Psycho Union.",
  "CPU runs on three teams: Presidium, Tech, and PR & Events.",
  "Weekly at CPU: tech talks, workshops, on-campus XCPC, staff-student teas, and the UNNC hackathon.",
  "CPU built the raffle system, event check-in, group QR verification, and the hackathon judge agent.",
];
