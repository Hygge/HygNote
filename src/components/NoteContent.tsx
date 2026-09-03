import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { extractImageRefs, resolveImageSrc } from "../lib/images";
import { renderMarkdown } from "../lib/markdown";
import "./ImagePreview.css";

type NoteContentProps = {
  content: string;
  query?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onDoubleClick?: () => void;
};

export function NoteContent({
  content,
  query = "",
  expanded = false,
  onToggle,
  onDoubleClick,
}: NoteContentProps) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [overflow, setOverflow] = useState(false);
  const [preview, setPreview] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const refs = extractImageRefs(content);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      refs.map(async (ref) => [ref, await resolveImageSrc(ref)] as const)
    ).then((entries) => {
      if (!cancelled) {
        setImages(Object.fromEntries(entries));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      setOverflow(el.scrollHeight > el.clientHeight + 4);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [content, images, expanded]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPreview("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const openPreview = (event: MouseEvent, src: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (src) setPreview(src);
  };

  return (
    <div className="note-content" onDoubleClick={onDoubleClick}>
      <div
        ref={bodyRef}
        className={`note-content-body ${expanded ? "is-expanded" : "is-collapsed"}`}
      >
        {renderMarkdown(content, query, images, (src) => setPreview(src)) as ReactNode}
      </div>
      {refs.length > 0 ? (
        <div className="note-thumbs">
          {refs.map((ref) => {
            const src = images[ref];
            if (!src) return null;
            return (
              <button
                key={ref}
                type="button"
                className="note-thumb"
                title="查看大图"
                onClick={(event) => openPreview(event, src)}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <img src={src} alt="" />
              </button>
            );
          })}
        </div>
      ) : null}
      {(overflow || expanded) && onToggle ? (
        <button type="button" className="note-expand" onClick={onToggle}>
          {expanded ? "收起" : "展开"}
        </button>
      ) : null}
      {preview ? (
        <div
          className="image-preview"
          onClick={(event) => {
            event.stopPropagation();
            setPreview("");
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <img src={preview} alt="预览" onClick={(event) => event.stopPropagation()} />
          <span>点击空白处关闭</span>
        </div>
      ) : null}
    </div>
  );
}
