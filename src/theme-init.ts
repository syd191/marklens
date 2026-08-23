try {
  const saved = JSON.parse(localStorage.getItem("marklens-preferences-v1") || "{}") as { themeMode?: string };
  const systemNight = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const savedTheme = saved.themeMode === "light" ? "github" : saved.themeMode;
  const theme = savedTheme === "system" || !savedTheme
    ? (systemNight ? "night" : "github")
    : savedTheme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "night" ? "dark" : "light";
} catch {
  if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
    document.documentElement.dataset.theme = "night";
    document.documentElement.style.colorScheme = "dark";
  }
}
