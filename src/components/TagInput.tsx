import { useMemo, useState, type KeyboardEvent } from "react";
import { Tag } from "animal-island-ui";
import { addTags, parseTagInput, removeTag } from "../lib/tags";
import { tagColor } from "../lib/theme";
import "./TagInput.css";

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
};

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "添加标签，回车确认",
  disabled = false,
}: TagInputProps) {
  const [value, setValue] = useState("");

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return suggestions
      .filter((tag) => !tags.some((item) => item.toLowerCase() === tag.toLowerCase()))
      .filter((tag) => (q ? tag.toLowerCase().includes(q) : true))
      .slice(0, 6);
  }, [suggestions, tags, value]);

  const commit = (raw = value) => {
    const next = addTags(tags, parseTagInput(raw));
    if (next.length !== tags.length) {
      onChange(next);
    }
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === "，") {
      event.preventDefault();
      event.stopPropagation();
      commit();
    }
    if (event.key === "Backspace" && !value && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className={`tag-input ${disabled ? "disabled" : ""}`}>
      {tags.map((tag) => (
        <Tag
          key={tag}
          size="small"
          color={tagColor(tag)}
          closable
          disabled={disabled}
          onClose={() => onChange(removeTag(tags, tag))}
        >
          {tag}
        </Tag>
      ))}
      <input
        value={value}
        disabled={disabled}
        placeholder={tags.length ? "再加一个" : placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (value.trim()) commit();
        }}
      />
      {filtered.length > 0 && value.trim() ? (
        <div className="tag-suggest">
          {filtered.map((tag) => (
            <span
              key={tag}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(addTags(tags, [tag]));
                setValue("");
              }}
            >
              <Tag size="small" color={tagColor(tag)}>
                {tag}
              </Tag>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
