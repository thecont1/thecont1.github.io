const initTextMode = () => {
  const toggleBtn = document.getElementById("toggle-textmode");
  if (!toggleBtn || toggleBtn.dataset.hasListener) return;

  const STORAGE_KEY = "textmode_enabled";

  const applyTextMode = (enabled) => {
    document.body.classList.toggle("text-only", enabled);
    toggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    try {
      sessionStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (e) {}
  };

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      applyTextMode(stored === "true");
    }
  } catch (e) {}

  toggleBtn.addEventListener("click", () => {
    const next = !document.body.classList.contains("text-only");
    applyTextMode(next);
  });

  toggleBtn.dataset.hasListener = "true";
};

// Handle initial load and view transitions
initTextMode();
document.addEventListener("astro:page-load", initTextMode);
