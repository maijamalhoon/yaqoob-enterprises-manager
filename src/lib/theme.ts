export type AppTheme = "light" | "dark";

export function getSavedTheme(): AppTheme {
  try {
    return localStorage.getItem("yaqoob-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
