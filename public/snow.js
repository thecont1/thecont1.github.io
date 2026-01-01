(() => {
  let raf = 0;
  let enabled = true;
  let canvas, ctx, toggleBtn;
  let globalAlpha = 0.8;
  let targetAlpha = 0.4;
  const FADE_SPEED = 0.05;
  const STORAGE_KEY = "snow_enabled";

  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setPressed = (pressed) => {
    if (!(toggleBtn instanceof HTMLButtonElement)) return;
    toggleBtn.setAttribute("aria-pressed", pressed ? "true" : "false");
  };

  const NUM_FLAKES = 250;
  const MAX_SIZE = 4.0;
  const MIN_SIZE = 0.8;
  const MAX_SPEED = 3.5;
  const MIN_SPEED = 1.5;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  
  // Wind system
  let windSpeed = 1;
  let windDirection = -1;
  let windChangeTimer = 0;
  const WIND_CHANGE_INTERVAL = 240; // frames between wind changes
  const MAX_WIND = 1.5;

  const flakes = [];

  const createFlake = () => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE,
      speed: Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED,
      sway: Math.random() * 0.5 - 0.25,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.4 + 0.6, // Varying opacity for depth
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
    };
  };

  const initFlakes = () => {
    flakes.length = 0;
    for (let i = 0; i < NUM_FLAKES; i++) flakes.push(createFlake());
  };

  const updateWind = () => {
    windChangeTimer++;
    if (windChangeTimer >= WIND_CHANGE_INTERVAL) {
      windChangeTimer = 0;
      // Randomly change wind speed and direction
      windSpeed = (Math.random() - 0.5) * MAX_WIND;
      windDirection = Math.random() > 0.5 ? 1 : -1;
    }
    
    // Smooth wind transitions
    windSpeed *= 0.98;
  };

  const resizeCanvas = () => {
    if (!canvas || !ctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const readNavAlpha = () => {
    const raw = getComputedStyle(document.body).getPropertyValue("--nav-bg-alpha");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? clamp(n, 0, 1) : 0;
  };

  const drawFlake = (flake) => {
    ctx.save();
    ctx.translate(flake.x, flake.y);
    ctx.rotate(flake.rotation);
    
    // Draw a more complex, flaky snowflake shape
    const arms = 6;
    const innerRadius = flake.r * 0.3;
    const outerRadius = flake.r;
    
    ctx.beginPath();
    for (let i = 0; i < arms * 2; i++) {
      const angle = (Math.PI / arms) * i;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    
    // Add a subtle glow
    ctx.beginPath();
    ctx.arc(0, 0, flake.r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const draw = () => {
    if (!canvas || !ctx) {
      raf = 0;
      return;
    }
    
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    // Handle fade in/out
    if (enabled && globalAlpha < targetAlpha) {
      globalAlpha = Math.min(globalAlpha + FADE_SPEED, targetAlpha);
    } else if (!enabled && globalAlpha > 0) {
      globalAlpha = Math.max(globalAlpha - FADE_SPEED, 0);
      if (globalAlpha === 0) {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
        return;
      }
    }

    ctx.clearRect(0, 0, w, h);
    
    updateWind();
    
    const navAlpha = readNavAlpha();
    const baseColor = Math.round(255 * (1 - navAlpha));

    for (const flake of flakes) {
      // Update position with wind influence
      flake.y += flake.speed;
      flake.swayOffset += 0.02;
      const swayAmount = Math.sin(flake.swayOffset) * flake.sway;
      flake.x += swayAmount + windSpeed * windDirection;
      
      // Update rotation
      flake.rotation += flake.rotationSpeed;

      // Wrap around edges
      if (flake.y > h + flake.r * 2) {
        flake.y = -flake.r * 2;
        flake.x = Math.random() * w;
      }

      if (flake.x < -flake.r * 2) flake.x = w + flake.r * 2;
      if (flake.x > w + flake.r * 2) flake.x = -flake.r * 2;

      // Set color with varying opacity and global fade
      ctx.fillStyle = `rgba(${baseColor}, ${baseColor}, ${baseColor}, ${flake.opacity * globalAlpha})`;
      drawFlake(flake);
    }

    raf = window.requestAnimationFrame(draw);
  };

  const setCanvasEnabled = (on) => {
    enabled = !!on;
    targetAlpha = enabled ? 1 : 0;
    
    try {
      sessionStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (e) {}

    setPressed(enabled);

    if (!on && globalAlpha === 0) {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      if (ctx) ctx.clearRect(0, 0, window.innerWidth || 1, window.innerHeight || 1);
      return;
    }

    if (!raf) {
      onResize();
      draw();
    }
  };

  const onResize = () => {
    resizeCanvas();
    initFlakes();
  };

  const initSnow = () => {
    canvas = document.getElementById("snow-canvas");
    toggleBtn = document.getElementById("toggle-snow");

    if (!canvas) return;
    
    ctx = canvas.getContext("2d");
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
    canvas.style.display = "block";

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        enabled = saved === "true";
      } else {
        // NEW: Default to enabled if no saved preference exists
        enabled = true;
      }
    } catch (e) {
      // NEW: Default to enabled if sessionStorage fails
      enabled = true;
    }

    if (toggleBtn instanceof HTMLButtonElement && !toggleBtn.dataset.hasSnowListener) {
      toggleBtn.addEventListener("click", () => {
        setCanvasEnabled(!enabled);
      });
      toggleBtn.dataset.hasSnowListener = "true";
    }

    // CHANGED: Start with snow fully visible (no fade-in on first load)
    globalAlpha = enabled ? 1 : 0;
    targetAlpha = enabled ? 1 : 0;
    setCanvasEnabled(enabled);
  };


  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) window.cancelAnimationFrame(raf);
    } else if (enabled || globalAlpha > 0) {
      draw();
    }
  });

  initSnow();
  document.addEventListener("astro:page-load", initSnow);
})();
