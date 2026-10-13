/** icon-generator：アイコン一式の生成（配置・ICO・マニフェスト・HTML スニペット・canvas 描画・ZIP・画面）（feature の外からはここだけを import する） */
export { generateIconFiles } from "./adapters/generate";
export { loadIconSource } from "./adapters/source";
export { DEFAULT_ICON_SETTINGS, type IconSettings } from "./core/settings";
export { IconTool } from "./ui/IconTool";
