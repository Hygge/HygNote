import { useEffect, useState } from "react";
import "./ImagePreview.css";

export function ImagePreview() {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const onPreview = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next) setSrc(next);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSrc("");
    };
    window.addEventListener("note-image-preview", onPreview);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("note-image-preview", onPreview);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!src) return null;

  return (
    <div className="image-preview" onClick={() => setSrc("")}>
      <img src={src} alt="预览" onClick={(e) => e.stopPropagation()} />
      <span>点击空白处关闭</span>
    </div>
  );
}
