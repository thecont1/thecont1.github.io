type Props = {
  enabled: boolean;
  onToggle: () => void;
};

export default function CaptionToggle({ enabled, onToggle }: Props) {
  return (
    <button
      className="caption-toggle"
      aria-pressed={enabled}
      onClick={onToggle}
      title="Toggle image info"
    >
      <span className="carousel-glyph" aria-hidden="true">i</span>
    </button>
  );
}