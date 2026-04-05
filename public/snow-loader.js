(() => {
  let started = false;

  const loadSnow = () => {
    if (started) return;
    started = true;

    if (document.body.classList.contains("no-snow")) {
      try { localStorage.setItem("pixel_dust_enabled", "false"); } catch (e) {}
    }

    const script = document.createElement("script");
    script.src = "/snow.js";
    script.defer = true;
    document.body.appendChild(script);
  };

  const scheduleLoad = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(loadSnow, { timeout: 2000 });
      return;
    }

    window.setTimeout(loadSnow, 1200);
  };

  if (document.readyState === "complete") {
    scheduleLoad();
  } else {
    window.addEventListener("load", scheduleLoad, { once: true });
  }
})();
