import { Fragment, useEffect, useRef, useState } from "react";

type Image = {
  src: string;
  caption?: string;
};

export default function Carousel({ images }: { images: Image[] }) {
  const [index, setIndex] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, images.length);
  }, [images.length]);

  useEffect(() => {
    if (!autoPlay || images.length < 2) return;

    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [autoPlay, images.length]);

  useEffect(() => {
    const el = slideRefs.current[index];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, [index]);

  if (!images.length) return null;

  const caption = images[index]?.caption?.trim();
  const captionText = caption ? caption : "No caption available.";

  const onPrev = () => {
    setAutoPlay(false);
    setIndex((i) => (i - 1 + images.length) % images.length);
  };

  const onNext = () => {
    setAutoPlay(false);
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
        <button
          type="button"
          aria-label="Toggle image info"
          aria-pressed={showCaption}
          onClick={onToggleInfo}
        >
          <span className="carousel-glyph" aria-hidden="true">
            i
          </span>
        </button>
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