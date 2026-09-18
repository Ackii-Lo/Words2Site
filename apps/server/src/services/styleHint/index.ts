/**
 * Words2Site 大屏 · 按内容自动选款 —— 主题关键词库 + 分类器
 *
 * 结构：styles.ts（主题/样式类型与映射）· lexicon/（四主题词库，纯数据）·
 * classify.ts（匹配与分类）。公共 API 在此再导出，外部统一从
 * `services/styleHint.js` 导入，内部文件调整不影响调用方。
 */

export type { CardTheme, CardStyle } from "./styles.js";
export { ALL_STYLES, THEME_STYLES } from "./styles.js";
export { LEXICON } from "./lexicon/index.js";
export { classifyTheme, classifyDetail, pickStyle } from "./classify.js";
