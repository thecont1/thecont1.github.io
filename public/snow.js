class PixelDust {
  constructor(options = {}) {
    this.options = {
      selector: "#snow-canvas",
      toggleSelector: "#toggle-snow",
      maxParticles: 300,
      maxSize: 6,
      maxSpeed: 0.5,
      minSpeed: 0.1,
      shape: "square",
      colors: "primary",
      minOpacity: 0.5,  // New: Minimum opacity (0.0-1.0)
      maxOpacity: 1.0,  // New: Maximum opacity (0.0-1.0)
      storageKey: "pixel_dust_enabled",
      ...options,
    };
    this.canvas = null;
    this.ctx = null;
    this.toggleBtn = null;
    this.raf = null;
    this.enabled = true;
    this.particles = [];
    this.time = 0;
    this.wind = 0;
    this.resizeTimeout = null;
    this.init();
  }

  init() {
    this.canvas = document.querySelector(this.options.selector);
    this.toggleBtn = document.querySelector(this.options.toggleSelector);

    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d", { alpha: true });
    if (!this.ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      this.enabled = false;
      if (this.toggleBtn) this.toggleBtn.disabled = true;
      this.setAriaPressed(false);
      return;
    }

    try {
      const saved = sessionStorage.getItem(this.options.storageKey);
      if (saved !== null) this.enabled = saved === "true";
    } catch (e) {}

    this.setupStyles();
    this.bindEvents();
    this.createParticles();
    this.resize();
    this.applyState();
  }

  setupStyles() {
    Object.assign(this.canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "9999",
      display: this.enabled ? "block" : "none",
    });
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 150);
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pause();
      } else if (this.enabled) {
        this.resume();
      }
    });

    if (this.toggleBtn && !this.toggleBtn.dataset.hasDustListener) {
      this.toggleBtn.addEventListener("click", () => this.toggle());
      this.toggleBtn.dataset.hasDustListener = "true";
    }

    document.addEventListener("astro:page-load", () => {
      this.canvas = document.querySelector(this.options.selector);
      this.toggleBtn = document.querySelector(this.options.toggleSelector);
      if (this.canvas && this.ctx) {
        this.resize();
        this.draw();
      } else {
        this.init();
      }
    });
  }

  randomColor() {
    const { minOpacity, maxOpacity } = this.options;
    const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
    const colorOptions = [
      `rgba(255, 20, 20, ${opacity})`,    // Hard red
      `rgba(20, 255, 20, ${opacity})`,    // Hard green
      `rgba(20, 20, 255, ${opacity})`     // Hard blue
    ];
    return colorOptions[Math.floor(Math.random() * colorOptions.length)];
  }

  getShape() {
    return this.options.shape;
  }

  spawnParticle(w, h, randomY = false) {
    const { maxSize, maxSpeed, minSpeed } = this.options;
    const size = Math.random() * maxSize + 2;

    // Fixed velocity system that respects maxSpeed
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    const angle = Math.random() * Math.PI * 2;

    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -size * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      color: this.randomColor(),
      shape: this.getShape(),
      opacity: 0.7 + Math.random() * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      drift: Math.sin(Math.random() * Math.PI * 2) * 0.2,
    };
  }

  createParticles() {
    const { maxParticles } = this.options;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    this.particles = Array.from({ length: maxParticles }, () =>
      this.spawnParticle(w, h, true)
    );
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.createParticles();
  }

  update() {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const { maxSpeed, minSpeed } = this.options;

    // Gentle wind effect
    this.wind = Math.sin(this.time * 0.001) * 0.2;
    this.time++;

    for (const p of this.particles) {
      // Apply velocity
      p.x += p.vx + this.wind + p.drift;
      p.y += p.vy;

      // Apply rotation
      p.rotation += p.rotationSpeed;

      // Apply gentle gravity
      p.vy = Math.min(p.vy + 0.005, maxSpeed);

      // Wrap particles
      if (p.y > h + p.size * 2) {
        const newP = this.spawnParticle(w, h, false);
        Object.assign(p, newP);
      }

      if (p.x < -p.size * 2) p.x = w + p.size * 2;
      if (p.x > w + p.size * 2) p.x = -p.size * 2;
    }
  }

  draw() {
    if (!this.enabled || !this.ctx) return;

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = "lighter";

    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.fillStyle = p.color;

      if (p.shape === "square") {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    this.ctx.globalCompositeOperation = "source-over";
    this.update();
    this.raf = requestAnimationFrame(() => this.draw());
  }

  toggle() {
    this.enabled = !this.enabled;
    this.saveState();
    this.applyState();
  }

  saveState() {
    try {
      sessionStorage.setItem(this.options.storageKey, String(this.enabled));
    } catch (e) {}
  }

  applyState() {
    if (this.canvas) {
      this.canvas.style.display = this.enabled ? "block" : "none";
    }
    this.setAriaPressed(this.enabled);

    if (this.enabled) {
      this.draw();
    } else {
      this.pause();
      this.clear();
    }
  }

  pause() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  resume() {
    if (!this.raf && this.enabled) {
      this.draw();
    }
  }

  clear() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  setAriaPressed(pressed) {
    if (this.toggleBtn instanceof HTMLButtonElement) {
      this.toggleBtn.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  }

  destroy() {
    this.pause();
    clearTimeout(this.resizeTimeout);
  }
}

// Initialize with working defaults
new PixelDust({
  maxParticles: 300,
  maxSize: 8,
  maxSpeed: 0.7,
  minSpeed: 0.1,
  shape: "circle",
  colors: "primary",
  minOpacity: 0.5,  // Particles will range from 30% to 80% opacity
  maxOpacity: 1.0
});
