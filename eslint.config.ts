//
// ESLint flat config：ESLint 管代码质量，Prettier 管格式（见 .prettierrc），
// 这里不放格式规则。eslint.config.ts 由 ESLint >= 9.14 原生加载（jiti）。
// Vue SFC 的 <script> 块用 typescript-eslint 解析器，模板规则取 flat/essential
// （其余 preset 含属性排序等风格规则，与 Prettier 分工冲突）。
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "pnpm-lock.yaml",
      "**/vendor/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    // .vue 未进 tseslint 的 TS 豁免名单，no-undef 由 TS 编译兜底（与 .ts 同待遇）
    rules: { "no-undef": "off" },
  },
  {
    // pm2 配置是 CommonJS
    files: ["deploy/**/*.js"],
    languageOptions: {
      globals: { module: "readonly", require: "readonly", process: "readonly" },
    },
  },
  {
    // UI 原子组件按约定单词命名（Button/Badge/Card/Textarea）
    files: ["apps/web/src/components/ui/**/*.vue"],
    rules: { "vue/multi-word-component-names": "off" },
  },
);
