import { Fragment, useEffect, useRef, useState } from "react";
import CaptionToggle from "./CaptionToggle";
import InfoPanel from "./InfoPanel";

type ImageMetadata = {
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: number;
  focal_length?: string;
  date_original?: string;
  artist?: string;
  copyright?: string;
  description?: string;
  title?: string;
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isAutoScrollingRef = useRef(false);
  const skipNextScrollRef = useRef(false);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, images.length);
  }, [images.length]);

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

  // Autoplay effect
  useEffect(() => {
    if (userTookControl || images.length < 2) return;

    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [userTookControl, images.length, index]);

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

  // Detect user interaction: trackpad scroll, drag, or keyboard on the track
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

    // Detect scroll changes on the track (catches all scroll methods)
    const handleScroll = () => {
      const currentScrollLeft = track.scrollLeft;
      const scrollDelta = Math.abs(currentScrollLeft - lastScrollLeft);
      
      // If scroll changed and we're not auto-scrolling, user did it
      if (scrollDelta > 5 && !isAutoScrollingRef.current) {
        setUserTookControl(true);
        
        // Sync index to the currently visible slide (skip the scroll effect)
        const slideWidth = track.scrollWidth / images.length;
        const newIndex = Math.round(currentScrollLeft / slideWidth);
        if (newIndex >= 0 && newIndex < images.length && newIndex !== index) {
          skipNextScrollRef.current = true;
          setIndex(newIndex);
        }
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
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      track.removeEventListener('wheel', handleWheel);
      track.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images.length, index]);

  if (!images.length) return null;

  const currentImage = images[index];
  const metadata = currentImage?.metadata;

  const onPrev = () => {
    setUserTookControl(true);
    setIndex((i) => (i - 1 + images.length) % images.length);
  };

  const onNext = () => {
    setUserTookControl(true);
    setIndex((i) => (i + 1) % images.length);
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
                src={img.src}
                alt=""
                className="carousel-image"
                loading={i === 0 ? "eager" : "lazy"}
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

      {showInfo && metadata && <InfoPanel metadata={metadata} imageSrc={currentImage.src} />}
    </div>
  );
}
