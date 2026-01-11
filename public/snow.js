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
      glow: true,
      glowSize: 2.2,
      glowOpacity: 0.22,
      storageKey: "pixel_dust_enabled",
      fps: 30,
      // Responsive breakpoints
      mobileBreakpoint: 768,
      tabletBreakpoint: 1024,
      // Particle count ratios for different viewports
      mobileParticleRatio: 0.5,
      tabletParticleRatio: 0.75,
      desktopParticleRatio: 1.0,
      ...options,
    };
    this.canvas = null;
    this.ctx = null;
    this.toggleBtn = null;
    this.raf = 0;
    this.enabled = true;
    this.lastFrameAt = 0;
    this.navAlpha = 0;
    this.navAlphaTimer = 0;
    this.particles = [];
    this.time = 0;
    this.wind = 0;
    this.resizeTimeout = null;
    this.colorMode = this.options.colors;
    this.fadingOut = false;
    this.fadingIn = false;
    this.fadeStart = 0;
    this.fadeDuration = 650;

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

    // Load saved state BEFORE any other initialization that might override it
    try {
      const saved = sessionStorage.getItem(this.options.storageKey);
      if (saved !== null) {
        this.enabled = saved === "true";
        console.log('PixelDust: Loaded saved state:', this.enabled);
      }
    } catch (e) {
      console.warn('PixelDust: Failed to load saved state:', e);
    }

    this.setupStyles();
    this.bindEvents();
    this.createParticles();
    this.resize();
    this.applyState();
    
    // Attach instance to canvas for test access
    if (this.canvas) {
      this.canvas.pixelDustInstance = this;
    }
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
    // Simple resize handling
    const onResize = () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.resize();
      }, 150);
    };

    window.addEventListener("resize", onResize, { passive: true });
    
    this.startNavAlphaPolling();
    this.draw();

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.pause();
        else if (this.enabled) this.resume();
      },
      { passive: true }
    );

    window.addEventListener("blur", () => this.pause(), { passive: true });
    window.addEventListener("focus", () => this.resume(), { passive: true });

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
        // Ensure state is preserved after page navigation
        this.applyState();
      } else {
        // Preserve enabled state when reinitializing
        const currentEnabled = this.enabled;
        this.init();
        // Restore the enabled state after init
        this.enabled = currentEnabled;
        this.applyState();
      }
    });

    // Store cleanup function for destroy method
    this.resizeCleanup = resizeCleanup;
  }

  readNavAlpha() {
    const raw = getComputedStyle(document.body).getPropertyValue("--nav-bg-alpha");
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  startNavAlphaPolling() {
    this.stopNavAlphaPolling();
    this.navAlpha = this.readNavAlpha();
    this.navAlphaTimer = window.setInterval(() => {
      this.navAlpha = this.readNavAlpha();
    }, 250);
  }

  stopNavAlphaPolling() {
    if (this.navAlphaTimer) window.clearInterval(this.navAlphaTimer);
    this.navAlphaTimer = 0;
  }

  getBackgroundIsDark() {
    const bg = getComputedStyle(document.body).backgroundColor || "rgb(255, 255, 255)";
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return false;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);

    // Relative luminance (sRGB)
    const srgb = [r, g, b].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    return lum < 0.45;
  }

  updateColorMode() {
    if (this.options.colors !== "auto") {
      this.colorMode = this.options.colors;
      return;
    }
    const isDark = this.getBackgroundIsDark();
    // Hard/saturated on light backgrounds, soft/pastel on dark backgrounds
    this.colorMode = isDark ? "pastel" : "hard";
  }

  randomColor() {
    const { minOpacity, maxOpacity } = this.options;
    const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

    const mode = this.colorMode || this.options.colors;

    if (mode === "pastel") {
      const pastel = [
        [255, 179, 186],
        [255, 223, 186],
        [255, 255, 186],
        [186, 255, 201],
        [186, 225, 255],
        [220, 198, 255],
      ];
      const [r, g, b] = pastel[Math.floor(Math.random() * pastel.length)];
      return { r, g, b, a: opacity };
    }

    if (mode === "hard") {
      const hard = [
        [255, 77, 79],
        [255, 179, 0],
        [255, 230, 109],
        [82, 196, 26],
        [22, 119, 255],
        [114, 46, 209],
      ];
      const [r, g, b] = hard[Math.floor(Math.random() * hard.length)];
      return { r, g, b, a: opacity };
    }

    return { r: 255, g: 255, b: 255, a: opacity };
  }

  getParticleCount() {
    const { maxParticles, mobileBreakpoint, mobileParticleRatio, desktopParticleRatio } = this.options;
    
    // Simple viewport width detection
    const width = window.innerWidth || 1920;
    
    // Apply particle count ratios based on requirements:
    // ≤768px: 50% fewer particles (mobile)
    // >768px: full particle count (desktop)
    if (width <= mobileBreakpoint) {
      return Math.floor(maxParticles * mobileParticleRatio);
    }
    // All viewports > 768px get full desktop particle count
    return Math.floor(maxParticles * desktopParticleRatio);
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
    const color = this.randomColor();

    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -size * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      color,
      shape: this.getShape(),
      opacity: 0.7 + Math.random() * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      drift: Math.sin(Math.random() * Math.PI * 2) * 0.2,
    };
  }

  parseRgba(color) {
    const m = String(color).match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) };
  }

  createParticles() {
    this.updateColorMode();
    const particleCount = this.getParticleCount();
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    this.particles = Array.from({ length: particleCount }, () =>
      this.spawnParticle(w, h, true)
    );
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth || 1920;
    const height = window.innerHeight || 1080;
    
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Store previous particle count to detect breakpoint changes
    const previousParticleCount = this.particles ? this.particles.length : 0;
    const newParticleCount = this.getParticleCount();
    
    // Only recreate particles if the count changed (crossed breakpoint)
    if (previousParticleCount !== newParticleCount) {
      this.createParticles();
    }
  }

  getViewportHeightFallback() {
    try {
      // Try multiple methods to get viewport height
      if (typeof window.innerHeight === 'number' && window.innerHeight > 0) {
        return window.innerHeight;
      }
      if (document.documentElement && document.documentElement.clientHeight > 0) {
        return document.documentElement.clientHeight;
      }
      if (document.body && document.body.clientHeight > 0) {
        return document.body.clientHeight;
      }
      if (screen && screen.height > 0) {
        return screen.height;
      }
      
      // Ultimate fallback - assume desktop
      console.warn('PixelDust: All viewport height detection methods failed, assuming desktop (1080px)');
      return 1080;
      
    } catch (error) {
      console.error('PixelDust: Critical error in viewport height detection:', error);
      return 1080; // Desktop fallback
    }
  }

  update(fadeOut = false) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const { maxSpeed } = this.options;

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
        if (fadeOut) {
          // During fade-out, don't respawn; keep moving off screen
          p.y = h + p.size * 3;
        } else {
          const newP = this.spawnParticle(w, h, false);
          Object.assign(p, newP);
        }
      }

      if (p.x < -p.size * 2) p.x = w + p.size * 2;
      if (p.x > w + p.size * 2) p.x = -p.size * 2;
    }
  }

  draw(now = performance.now()) {
    if (!this.enabled && !this.fadingOut) return;

    const frameMs = 1000 / (this.options.fps || 30);
    if (now - this.lastFrameAt < frameMs) {
      this.raf = window.requestAnimationFrame((t) => this.draw(t));
      return;
    }
    this.lastFrameAt = now;

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = "lighter";

    let fadeMul = 1;
    if (this.fadingOut) {
      const t = performance.now();
      const p = Math.min(1, Math.max(0, (t - this.fadeStart) / this.fadeDuration));
      // Ease out (1 -> 0)
      fadeMul = (1 - p) * (1 - p);
    } else if (this.fadingIn) {
      const t = performance.now();
      const p = Math.min(1, Math.max(0, (t - this.fadeStart) / this.fadeDuration));
      // Ease in (0 -> 1)
      fadeMul = 1 - (1 - p) * (1 - p);
    }

    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      const base = p.color;
      const rgba = {
        r: base.r,
        g: base.g,
        b: base.b,
        a: base.a * fadeMul,
      };

      const color = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
      this.ctx.fillStyle = color;

      if (p.shape === "square") {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        if (this.options.glow && rgba) {
          const r = p.size / 2;
          const outer = r * this.options.glowSize;
          const g = this.ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, outer);
          const ga = Math.max(0, Math.min(1, rgba.a * this.options.glowOpacity));
          g.addColorStop(0, `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${ga})`);
          g.addColorStop(1, `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0)`);
          this.ctx.fillStyle = g;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, outer, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = color;
        }
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    this.ctx.globalCompositeOperation = "source-over";

    if (this.fadingOut) {
      const done = performance.now() - this.fadeStart >= this.fadeDuration;
      if (done) {
        this.fadingOut = false;
        this.pause();
        if (this.canvas) this.canvas.style.display = "none";
        this.clear();
        return;
      }
      this.update(true);
      this.raf = window.requestAnimationFrame((t) => this.draw(t));
      return;
    }

    if (this.fadingIn) {
      const done = performance.now() - this.fadeStart >= this.fadeDuration;
      if (done) {
        this.fadingIn = false;
      }
    }

    this.update(false);
    this.raf = window.requestAnimationFrame((t) => this.draw(t));
  }

  toggle() {
    this.enabled = !this.enabled;
    console.log('PixelDust: Toggled to enabled:', this.enabled);
    this.saveState();
    this.applyState();
  }

  saveState() {
    try {
      sessionStorage.setItem(this.options.storageKey, String(this.enabled));
      console.log('PixelDust: Saved state to sessionStorage:', this.enabled);
    } catch (e) {
      console.warn('PixelDust: Failed to save state:', e);
    }
  }

  applyState() {
    this.setAriaPressed(this.enabled);

    if (this.enabled) {
      this.fadingOut = false;
      this.fadingIn = true;
      this.fadeStart = performance.now();
      if (this.canvas) this.canvas.style.display = "block";
      this.draw();
    } else {
      // Fade out gently when disabling
      this.fadingOut = true;
      this.fadingIn = false;
      this.fadeStart = performance.now();
      if (this.canvas) this.canvas.style.display = "block";
      this.draw();
    }
    
    // Log state for debugging
    console.log('PixelDust: Applied state - enabled:', this.enabled, 'button pressed:', this.toggleBtn?.getAttribute('aria-pressed'));
  }

  pause() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastFrameAt = 0;
    this.stopNavAlphaPolling();
  }

  resume() {
    if (!this.enabled) return;
    if (this.raf) return;
    this.startNavAlphaPolling();
    this.draw();
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
    
    // Clean up viewport detector resize handler if it exists
    if (this.resizeCleanup && typeof this.resizeCleanup === 'function') {
      try {
        this.resizeCleanup();
      } catch (error) {
        console.warn('PixelDust: Error during resize cleanup:', error);
      }
    }
  }
}

// Initialize with working defaults
const pixelDustInstance = new PixelDust({
  maxParticles: 350,
  maxSize: 10,
  maxSpeed: 0.9,
  minSpeed: 0.1,
  shape: "square",
  colors: "hard", // Force colored snowflakes instead of "auto"
  minOpacity: 0.5,
  maxOpacity: 0.9,
  glow: true,
  glowSize: 1.6,
  glowOpacity: 0.24
});

// Expose instance globally for testing
if (typeof window !== 'undefined') {
  window.pixelDustInstance = pixelDustInstance;
  
  // Also attach to canvas element for test access
  if (pixelDustInstance.canvas) {
    pixelDustInstance.canvas.pixelDustInstance = pixelDustInstance;
  }
}
