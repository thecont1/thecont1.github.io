const toggle = document.getElementById("toggle-textmode");
const STORAGE_KEY = "textmode_enabled";

const apply = (enabled) => {
  document.body.classList.toggle("text-only", enabled);
  toggle?.setAttribute("aria-pressed", enabled ? "true" : "false");
  try {
    sessionStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (e) {
    // Ignore storage errors
  }
};

// Initialize state from storage
try {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === "true") {
    apply(true);
  } else {
    apply(false);
  }
} catch (e) {
  apply(false);
}

toggle?.addEventListener("click", () => {
  const next = !document.body.classList.contains("text-only");
  apply(next);
});
