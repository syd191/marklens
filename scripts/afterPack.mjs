// 打包后清理：删除多余 Electron 语言包（仅保留 en-US / zh-CN）及软件渲染后备库，
// 减小最终应用体积。仅在 win 平台生效。
import fs from "node:fs";
import path from "node:path";

const KEEP_LOCALES = new Set(["en-US.pak", "zh-CN.pak"]);

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

  // 2) 移除软件 Vulkan 渲染后备（Windows 通常有硬件 GPU），省 5MB+
  const swiftshader = path.join(appOutDir, "vk_swiftshader.dll");
  if (fs.existsSync(swiftshader)) {
    try {
      fs.unlinkSync(swiftshader);
    } catch {
      // 忽略
    }
  }
}
