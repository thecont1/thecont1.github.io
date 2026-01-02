import { Fragment, useEffect, useRef, useState } from "react";
import CaptionToggle from "./CaptionToggle";

type Image = {
  src: string;
  caption?: string;
};

export default function Carousel({ images }: { images: Image[] }) {
  const [index, setIndex] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [userTookControl, setUserTookControl] = useState(false);
  const [curtainVisible, setCurtainVisible] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, images.length);
  }, [images.length]);

  // Watch for controls-visible class to detect when curtain is pulled/lifted
  useEffect(() => {
    const checkCurtainState = () => {
      const controlsVisible = document.body.classList.contains('controls-visible');
      const wasCurtainVisible = curtainVisible;
      const isCurtainVisible = !controlsVisible;
      
      setCurtainVisible(isCurtainVisible);
      
      // If curtain just became visible (user scrolled back up), reset user control
      if (!wasCurtainVisible && isCurtainVisible) {
        setUserTookControl(false); // Reset - autoplay resumes
      }
    };

    // Check initially
    checkCurtainState();

    // Use MutationObserver to watch for class changes on body
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkCurtainState();
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    return () => observer.disconnect();
  }, [curtainVisible]);

  // Autoplay effect - only stops if user manually clicked prev/next
  useEffect(() => {
    // Don't autoplay if user took control or if there are less than 2 images
    if (userTookControl || images.length < 2) return;

    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [userTookControl, images.length]);

  useEffect(() => {
    const el = slideRefs.current[index];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, [index]);

  if (!images.length) return null;

  const caption = images[index]?.caption?.trim();
  const captionText = caption ? caption : "No caption available.";

  const onPrev = () => {
    setUserTookControl(true); // User clicked - stop autoplay
    setIndex((i) => (i - 1 + images.length) % images.length);
  };

  const onNext = () => {
    setUserTookControl(true); // User clicked - stop autoplay
    setIndex((i) => (i + 1) % images.length);
  };

  const onToggleInfo = () => {
    setShowCaption((s) => !s);
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
        
        <CaptionToggle enabled={showCaption} onToggle={onToggleInfo} />
        
        <button type="button" aria-label="Next image" onClick={onNext}>
          <span className="carousel-glyph" aria-hidden="true">
            &gt;
          </span>
        </button>
      </div>

      {showCaption && <div className="carousel-caption">{captionText}</div>}
    </div>
  );
}