// 打包后只裁剪未使用的 Electron 语言包。GPU/SwiftShader 软件渲染后备
// 必须保留，企业电脑、远程桌面、虚拟机和旧驱动可能依赖这些文件启动。
import fs from "node:fs";
import path from "node:path";

const KEEP_LOCALES = new Set(["en-US.pak", "zh-CN.pak", "zh-TW.pak"]);

export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const appOutDir = context.appOutDir;

  // 1) 裁剪 locales：仅保留界面需要的两种语言
  const localesDir = path.join(appOutDir, "locales");
  if (fs.existsSync(localesDir)) {
    for (const file of fs.readdirSync(localesDir)) {
      if (!KEEP_LOCALES.has(file)) {
        try {
          fs.unlinkSync(path.join(localesDir, file));
        } catch {
          // 忽略无法删除的文件
        }
      }
    }
  }
}
