/**
 * html-to-image 1.11.13 的类型声明（vendored 单文件，只声明本仓库用到的 API）。
 * 上游完整类型见 https://github.com/bubkooo/html-to-image
 */
declare module "@/lib/vendor/html-to-image.js" {
  export interface Options {
    width?: number;
    height?: number;
    pixelRatio?: number;
    backgroundColor?: string | null;
    filter?: (domNode: HTMLElement) => boolean;
    style?: Partial<CSSStyleDeclaration>;
  }
  export function toPng(node: HTMLElement, options?: Options): Promise<string>;
}
