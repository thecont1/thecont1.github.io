import { Fragment, Suspense, lazy, useEffect, useRef, useState } from "react";
import CaptionToggle from "./CaptionToggle";
import { cfImageUrl } from "../../utils/api";
const InfoPanel = lazy(() => import("./InfoPanel"));

const PLACEHOLDER_IMAGE_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

declare global {
  interface Window {
    __imageMetadataBySrc?: Map<string, any>;
  }
}

type ImageMetadata = {
  filename?: string;
  format?: string;
  size?: [number, number];
  width?: number;
  height?: number;
  exif?: Record<string, any>;
  photography?: {
    camera_make?: string;
    camera_model?: string;
    lens_model?: string;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    focal_length?: string;
    date_original?: string;
    date_taken?: string;
    artist?: string;
    copyright?: string;
    description?: string;
    title?: string;
  };
};

type Image = {
  src: string;
  caption?: string;
  metadata?: ImageMetadata;
};

export default function Carousel({ images }: { images: Image[] }) {
  const [index, setIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [userTookControl, setUserTookControl] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() => images.map((_, i) => i === 0));
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isAutoScrollingRef = useRef(false);
  const skipNextScrollRef = useRef(false);
  const programmaticNavUntilRef = useRef(0);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const ioTickRef = useRef<number | null>(null);
  const preloadTokenRef = useRef(0);

  // Publish a global lookup so the Lightbox (plain JS) can display the same metadata.
  useEffect(() => {
    const map = (window.__imageMetadataBySrc ||= new Map());
    images.forEach((img) => {
      if (!img?.src || !img?.metadata) return;
      const wrapped = { photography: img.metadata };
      map.set(img.src, wrapped);
      try {
        const path = new URL(img.src, window.location.origin).pathname;
        map.set(path, wrapped);
      } catch {
      }
    });
  }, [images]);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  useEffect(() => {
    setRevealed(images.map((_, i) => i === 0));
  }, [images]);

  useEffect(() => {
    setRevealed((prev) => {
      if (index < 0 || index >= images.length) return prev;
      if (prev[index]) return prev;
      const next = prev.slice(0, images.length);
      while (next.length < images.length) next.push(false);
      next[index] = true;
      return next;
    });
  }, [images.length, index]);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, images.length);
  }, [images.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    ioRef.current?.disconnect();

    const updateIndexFromVisibility = () => {
      if (Date.now() < programmaticNavUntilRef.current) return;
      if (ioTickRef.current != null) return;
      ioTickRef.current = window.requestAnimationFrame(() => {
        ioTickRef.current = null;

        const trackRect = track.getBoundingClientRect();
        const rootLeft = trackRect.left;
        const rootRight = trackRect.right;
        let bestIdx = 0;
        let bestDist = Number.POSITIVE_INFINITY;

        slideRefs.current.forEach((el, i) => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.right <= rootLeft || r.left >= rootRight) return;
          const dist = Math.abs(r.left - rootLeft);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        });

        if (bestIdx !== index) {
          skipNextScrollRef.current = true;
          setIndex(bestIdx);
        }
      });
    };

    const observer = new IntersectionObserver(
      () => updateIndexFromVisibility(),
      {
        root: track,
        threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );
    ioRef.current = observer;

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    updateIndexFromVisibility();

    const onResize = () => updateIndexFromVisibility();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (ioTickRef.current != null) {
        window.cancelAnimationFrame(ioTickRef.current);
        ioTickRef.current = null;
      }
      observer.disconnect();
    };
  }, [images.length, index]);

  // Resume autoplay when user scrolls back to curtain (scroll position near top)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      
      // Curtain is visible when scroll is less than 80% of viewport height
      if (scrollY < vh * 0.8) {
        setUserTookControl(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Autoplay effect with smooth infinite loop
  useEffect(() => {
    if (userTookControl || images.length < 2) return;

    const timer = window.setTimeout(() => {
      setIndex((i) => {
        const nextIndex = (i + 1) % images.length;
        return nextIndex;
      });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [userTookControl, images.length, index]);

  // Ensure images begin loading in order of appearance.
  // Rationale: in a horizontal carousel, native `loading="lazy"` can still trigger many
  // concurrent fetches (depending on heuristics), which makes early slides compete with
  // later ones. We instead:
  // - Keep slide 0 as the only eager/high-priority image.
  // - Sequentially preload images starting from the current index.
  useEffect(() => {
    if (!images.length) return;

    const startToken = ++preloadTokenRef.current;
    const queue = images.map((img) => img?.src ? cfImageUrl(img.src, 1920) : '').filter(Boolean);

    const clamp = (i: number) => {
      if (!queue.length) return 0;
      const m = i % queue.length;
      return m < 0 ? m + queue.length : m;
    };

    const run = async () => {
      // Preload a small window ahead; if the user swipes, this effect restarts.
      const maxAhead = Math.min(4, Math.max(0, queue.length - 1));
      const targets: Array<{ idx: number; src: string }> = [];
      for (let k = 1; k <= maxAhead; k++) {
        const idx = clamp(index + k);
        targets.push({ idx, src: queue[idx] });
      }

      for (const t of targets) {
        if (preloadTokenRef.current !== startToken) return;
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = t.src;
        });

        if (preloadTokenRef.current !== startToken) return;
        setRevealed((prev) => {
          if (t.idx < 0 || t.idx >= images.length) return prev;
          if (prev[t.idx]) return prev;
          const next = prev.slice(0, images.length);
          while (next.length < images.length) next.push(false);
          next[t.idx] = true;
          return next;
        });
      }
    };

    // Don't block initial paint; start preloading after the browser is idle.
    const w = window as any;
    const idleId = typeof w.requestIdleCallback === "function"
      ? w.requestIdleCallback(run, { timeout: 1200 })
      : window.setTimeout(run, 0);

    return () => {
      if (typeof w.cancelIdleCallback === "function" && typeof idleId === "number") {
        w.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId as number);
      }
    };
  }, [images, index]);

  // Scroll to current slide
  useEffect(() => {
    // Skip if this index change came from user drag (they're already at the right position)
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    
    isAutoScrollingRef.current = true;
    const el = slideRefs.current[index];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    
    // Reset flag after scroll animation completes
    const timer = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 800);
    
    return () => clearTimeout(timer);
  }, [index]);

  // Detect user interaction: trackpad scroll, drag, touch swipe, or keyboard on the track
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let lastScrollLeft = track.scrollLeft;

    // Detect horizontal scroll (trackpad two-finger swipe)
    const handleWheel = (e: WheelEvent) => {
      // If there's horizontal scroll intent, user is taking control
      if (Math.abs(e.deltaX) > 10) {
        setUserTookControl(true);
      }
    };

    // Detect touch interactions to stop auto-scroll (without interfering with natural scrolling)
    const handleTouchStart = (e: TouchEvent) => {
      // User started touching the carousel, stop auto-scroll
      setUserTookControl(true);
    };

    // Detect scroll changes on the track (catches all scroll methods including touch swipes)
    const handleScroll = () => {
      const currentScrollLeft = track.scrollLeft;
      const scrollDelta = Math.abs(currentScrollLeft - lastScrollLeft);
      
      // If scroll changed and we're not auto-scrolling, user did it
      if (scrollDelta > 5 && !isAutoScrollingRef.current) {
        setUserTookControl(true);
      }
      
      lastScrollLeft = currentScrollLeft;
    };

    // Detect keyboard navigation (arrow keys)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setUserTookControl(true);
      }
    };

    track.addEventListener('wheel', handleWheel, { passive: true });
    track.addEventListener('scroll', handleScroll, { passive: true });
    track.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      track.removeEventListener('wheel', handleWheel);
      track.removeEventListener('scroll', handleScroll);
      track.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images.length, index]);

  if (!images.length) return null;

  const currentImage = images[index];
  const metadata = currentImage?.metadata;

  const onPrev = () => {
    setUserTookControl(true);
    programmaticNavUntilRef.current = Date.now() + 900;
    const newIndex = (index - 1 + images.length) % images.length;
    setIndex(newIndex);
  };

  const onNext = () => {
    setUserTookControl(true);
    programmaticNavUntilRef.current = Date.now() + 900;
    const newIndex = (index + 1) % images.length;
    setIndex(newIndex);
  };

  const onToggleInfo = () => {
    setShowInfo((s) => !s);
  };

  return (
    <div className="carousel" aria-roledescription="carousel">
      <div className="carousel-track" ref={trackRef}>
        {images.map((img, i) => (
          <Fragment key={img.src}>
            <div
              className="carousel-slide"
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
            >
              <img
                src={revealed[i] ? cfImageUrl(img.src, 1920) : PLACEHOLDER_IMAGE_SRC}
                srcSet={revealed[i] ? [
                  `${cfImageUrl(img.src, 1200)} 1200w`,
                  `${cfImageUrl(img.src, 1920)} 1920w`,
                  `${cfImageUrl(img.src, 2560)} 2560w`,
                ].join(", ") : undefined}
                sizes="100vw"
                alt=""
                className="carousel-image"
                width={img.metadata?.width || undefined}
                height={img.metadata?.height || undefined}
                loading={i === index ? "eager" : "lazy"}
                fetchPriority={i === index ? "high" : "low"}
                decoding="async"
              />
            </div>
            {i < images.length - 1 && <div className="carousel-gap" aria-hidden="true" />}
          </Fragment>
        ))}
      </div>

      <div className="carousel-controls">
        <button type="button" aria-label="Previous image" onClick={onPrev}>
          <span className="carousel-glyph" aria-hidden="true">
            &lt;
          </span>
        </button>
        
        <CaptionToggle enabled={showInfo} onToggle={onToggleInfo} />
        
        <button type="button" aria-label="Next image" onClick={onNext}>
          <span className="carousel-glyph" aria-hidden="true">
            &gt;
          </span>
        </button>
      </div>

      {showInfo && metadata && (
        <Suspense fallback={null}>
          <InfoPanel metadata={metadata} imageSrc={currentImage.src} />
        </Suspense>
      )}
      {!metadata && <div className="debug-no-meta">No metadata available</div>}
    </div>
  );
}
