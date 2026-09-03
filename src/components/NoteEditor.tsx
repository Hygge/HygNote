import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Button } from "animal-island-ui";
import {
  continueList,
  insertAtCursor,
  prefixLines,
  wrapSelection,
} from "../lib/markdown";
import {
  extractImageRefs,
  imageMarkdown,
  resolveImageSrc,
  saveImageFile,
} from "../lib/images";
import "./NoteEditor.css";
import "./ImagePreview.css";

type NoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
  onEscape?: () => void;
  submitHint?: string;
};

export function NoteEditor({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  onSubmit,
  onEscape,
  submitHint,
}: NoteEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState("");
  const refs = extractImageRefs(value);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      refs.map(async (item) => [item, await resolveImageSrc(item)] as const)
    ).then((entries) => {
      if (!cancelled) setImages(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreview("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const apply = (next: { value: string; start: number; end?: number; cursor?: number }) => {
    onChange(next.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = next.cursor ?? next.end ?? next.start;
      el.focus();
      el.setSelectionRange(next.start, pos);
    });
  };

  const currentRange = () => {
    const el = ref.current;
    return {
      start: el?.selectionStart ?? value.length,
      end: el?.selectionEnd ?? value.length,
    };
  };

  const bold = () => {
    const { start, end } = currentRange();
    apply(wrapSelection(value, start, end, "**"));
  };

  const bullet = () => {
    const { start, end } = currentRange();
    apply(prefixLines(value, start, end, "- "));
  };

  const numbered = () => {
    const { start, end } = currentRange();
    apply(prefixLines(value, start, end, "1. "));
  };

  const insertImage = async (file: File | Blob) => {
    const path = await saveImageFile(file);
    const { start } = currentRange();
    const md = `\n${imageMarkdown(path)}\n`;
    apply(insertAtCursor(value, start, md));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      if (preview) {
        event.preventDefault();
        setPreview("");
        return;
      }
      onEscape?.();
      return;
    }
    if (event.key === "b" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      bold();
      return;
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit?.();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      const continued = continueList(value, event.currentTarget.selectionStart);
      if (continued) {
        event.preventDefault();
        apply({ value: continued.value, start: continued.cursor, cursor: continued.cursor });
      }
    }
  };

  const onPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData.items);
    const image = items.find((item) => item.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    const file = image.getAsFile();
    if (file) await insertImage(file);
  };

  return (
    <div className="note-editor-wrap">
      <div className="note-toolbar">
        <Button size="small" disabled={disabled} onClick={bold}>
          加粗
        </Button>
        <Button size="small" disabled={disabled} onClick={bullet}>
          无序
        </Button>
        <Button size="small" disabled={disabled} onClick={numbered}>
          有序
        </Button>
        <label className="note-upload">
          图片
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) insertImage(file);
              e.target.value = "";
            }}
          />
        </label>
        <span className="note-hint">{submitHint}</span>
      </div>
      <textarea
        ref={ref}
        className="note-editor"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {refs.length > 0 ? (
        <div className="note-thumbs">
          {refs.map((item) => {
            const src = images[item];
            if (!src) return null;
            return (
              <button
                key={item}
                type="button"
                className="note-thumb"
                title="查看大图"
                onClick={() => setPreview(src)}
              >
                <img src={src} alt="" />
              </button>
            );
          })}
        </div>
      ) : null}
      {preview ? (
        <div className="image-preview" onClick={() => setPreview("")}>
          <img src={preview} alt="预览" onClick={(event) => event.stopPropagation()} />
          <span>点击空白处关闭</span>
        </div>
      ) : null}
    </div>
  );
}
