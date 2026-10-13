import { glyph } from "../../../packages/shared-ui/glyphs.js";

// Also embedded in the head by the shared builder to restore the theme before paint.
export function themeBootstrap() {
  let saved;
  try { saved = localStorage.getItem("relay-theme"); } catch {}
  const theme = saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  return theme;
}
export function bindTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return () => {};
  const update = () => {
    const light = document.documentElement.dataset.theme === "light";
    const label = light ? "Switch to dark mode" : "Switch to light mode";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.querySelector(".utility-icon").innerHTML = glyph(light ? "moon" : "sun");
    button.querySelector(".utility-label").textContent = light ? "Dark mode" : "Light mode";
  };
  themeBootstrap(); update();
  const toggle = () => {
    const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("relay-theme", theme); } catch {}
    update();
  };
  button.addEventListener("click", toggle);
  const media = matchMedia("(prefers-color-scheme: light)");
  const systemChange = () => {
    let saved;
    try { saved = localStorage.getItem("relay-theme"); } catch {}
    if (saved !== "light" && saved !== "dark") { themeBootstrap(); update(); }
  };
  media.addEventListener("change", systemChange);
  return () => { button.removeEventListener("click", toggle); media.removeEventListener("change", systemChange); };
}
