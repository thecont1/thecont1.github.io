const toggle = document.getElementById("toggle-textmode");

const apply = (enabled) => {
  document.body.classList.toggle("text-only", enabled);
  toggle?.setAttribute("aria-pressed", enabled ? "true" : "false");
};

apply(false);

toggle?.addEventListener("click", () => {
  const next = !document.body.classList.contains("text-only");
  apply(next);
});
