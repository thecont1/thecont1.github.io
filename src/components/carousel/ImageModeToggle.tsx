import { useEffect, useState } from "react";

export default function ImageModeToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem("images-mode") ?? "on";
    setEnabled(saved === "on");
    document.body.dataset.images = saved;
  }, []);

  const toggle = () => {
    const next = enabled ? "off" : "on";
    setEnabled(!enabled);
    document.body.dataset.images = next;
    sessionStorage.setItem("images-mode", next);
  };

  return (
    <button
      className="image-mode-toggle"
      onClick={toggle}
      title="Toggle images"
    >
      👁
    </button>
  );
}