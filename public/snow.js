(() => {
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const toggleBtn = document.getElementById("toggle-snow");
  const setPressed = (pressed) => {
    if (!(toggleBtn instanceof HTMLButtonElement)) return;
    toggleBtn.setAttribute("aria-pressed", pressed ? "true" : "false");
  };

  const canvas = document.getElementById("snow-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (prefersReduced) {
    canvas.style.display = "none";
    if (toggleBtn instanceof HTMLButtonElement) toggleBtn.disabled = true;
    setPressed(false);
    return;
  }

  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";

  const NUM_FLAKES = 200;
  const MAX_SIZE = 3;
  const MAX_SPEED = 1.5;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const flakes = [];

  const resizeCanvas = () => {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const createFlake = () => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * MAX_SIZE + 1,
      speed: Math.random() * MAX_SPEED + 0.5,
      sway: Math.random() * 1 - 0.5,
    };
  };

  const init = () => {
    flakes.length = 0;
    for (let i = 0; i < NUM_FLAKES; i++) flakes.push(createFlake());
  };

  let raf = 0;
  let enabled = true;

  try {
    const saved = sessionStorage.getItem("snow_enabled");
    if (saved !== null) {
      enabled = saved === "true";
    }
  } catch (e) {}

  const readNavAlpha = () => {
    const raw = getComputedStyle(document.body).getPropertyValue("--nav-bg-alpha");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? clamp(n, 0, 1) : 0;
  };

  const setCanvasEnabled = (on) => {
    enabled = !!on;
    try {
      sessionStorage.setItem("snow_enabled", String(enabled));
    } catch (e) {}

    canvas.style.display = enabled ? "block" : "none";
    setPressed(enabled);

    if (!enabled) {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth || 1, window.innerHeight || 1);
      return;
    }

    onResize();
    draw();
  };

  const draw = () => {
    if (!enabled) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    ctx.clearRect(0, 0, w, h);
    const alpha = readNavAlpha();
    const c = Math.round(255 * (1 - alpha));
    ctx.fillStyle = `rgba(${c}, ${c}, ${c}, 0.9)`;

    for (const flake of flakes) {
      flake.y += flake.speed;
      flake.x += flake.sway;

      if (flake.y > h + flake.r) {
        flake.y = -flake.r;
        flake.x = Math.random() * w;
      }

      if (flake.x < -flake.r) flake.x = w + flake.r;
      if (flake.x > w + flake.r) flake.x = -flake.r;

      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = window.requestAnimationFrame(draw);
  };

  const onResize = () => {
    resizeCanvas();
    init();
  };

  window.addEventListener("resize", onResize, { passive: true });
  onResize();
  draw();

  if (toggleBtn instanceof HTMLButtonElement) {
    setPressed(true);
    toggleBtn.addEventListener(
      "click",
      () => {
        setCanvasEnabled(!enabled);
      },
      { passive: true }
    );
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
      } else {
        draw();
      }
    },
    { passive: true }
  );
})();
