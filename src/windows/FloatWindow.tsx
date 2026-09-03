import { useEffect, useState, type FormEvent } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "animal-island-ui";
import { TitleBar } from "../components/TitleBar";
import { TagInput } from "../components/TagInput";
import { NoteEditor } from "../components/NoteEditor";
import { useTheme } from "../hooks/useTheme";
import { createNote, getNotes } from "../lib/db";
import { collectTags } from "../lib/tags";
import "./FloatWindow.css";

export function FloatWindow() {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const win = getCurrentWindow();
  useTheme();

  useEffect(() => {
    getNotes()
      .then((notes) => setSuggestions(collectTags(notes)))
      .catch(() => undefined);
  }, []);

  const close = () => win.close();

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      await createNote(input.trim(), tags);
      await emit("notes-changed");
      setInput("");
      setTags([]);
      await close();
    } catch (error) {
      console.error("Failed to create note:", error);
      setLoading(false);
    }
  };

  return (
    <div className="float-window">
      <TitleBar title="快速笔记" variant="float" />
      <form onSubmit={handleSubmit} className="float-form">
        <NoteEditor
          value={input}
          onChange={setInput}
          placeholder="随手记一条，支持加粗、列表和粘贴图片，点缩略图可预览"
          disabled={loading}
          autoFocus
          onSubmit={() => handleSubmit()}
          onEscape={close}
          submitHint="Ctrl+Enter 发送"
        />
        <TagInput
          tags={tags}
          onChange={setTags}
          suggestions={suggestions}
          placeholder="标签，回车添加"
          disabled={loading}
        />
        <div className="float-actions">
          <Button onClick={close} disabled={loading}>
            取消
          </Button>
          <Button
            htmlType="submit"
            type="primary"
            loading={loading}
            disabled={!input.trim()}
          >
            发送
          </Button>
        </div>
      </form>
    </div>
  );
}
