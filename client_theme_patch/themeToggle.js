export const THEMES = {
  default: {
    glass: false
  },
  dark: {
    glass: false
  },
  glass: {
    glass: true,
    blur: true,
    transparency: true
  }
};

export function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);

  if (theme === "glass") {
    document.body.classList.add("glass-theme");
  } else {
    document.body.classList.remove("glass-theme");
  }

  localStorage.setItem("theme", theme);
}
