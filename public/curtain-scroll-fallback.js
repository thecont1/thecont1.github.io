(() => {
  const supportsScrollTimeline =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: scroll()") &&
    CSS.supports("animation-range: 0vh 1vh");

  const statement = document.querySelector(".hero-statement");
  if (!statement) return;

  const projects = document.querySelector(".projects");
  const projectsHeader = document.querySelector(".projects-header");

  const siteHeaderHeight = () => {
    const value =
      getComputedStyle(document.body).getPropertyValue("--site-header-height");
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const onScroll = () => {
    const y = window.scrollY || 0;

    const vh = window.innerHeight || 1;

    if (projectsHeader) {
      const h = siteHeaderHeight();
      const headerTop = projectsHeader.getBoundingClientRect().top;
      const dist = headerTop - h;
      const range = Math.max(120, vh * 0.25);
      const alpha = clamp(1 - dist / range, 0, 1);

      document.body.style.setProperty("--nav-bg-alpha", alpha.toFixed(3));

      if (dist <= 0) document.body.classList.add("in-projects");
      else document.body.classList.remove("in-projects");
    } else if (projects) {
      const top = projects.getBoundingClientRect().top + y;
      if (y + vh * 0.25 >= top) document.body.classList.add("in-projects");
      else document.body.classList.remove("in-projects");
    }

    if (y >= 1.2 * vh) {
      document.body.classList.add("controls-visible");
    } else {
      document.body.classList.remove("controls-visible");
    }

    if (supportsScrollTimeline) return;

    const progress = clamp(y / (1.2 * vh), 0, 1);
    const translate = -120 * progress;
    statement.style.transform = `translateY(${translate}vh)`;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
