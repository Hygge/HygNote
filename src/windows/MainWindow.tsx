import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button, Card, Divider, Icon, Input, Tag, Title } from "animal-island-ui";
import { TitleBar } from "../components/TitleBar";
import { SettingsPanel } from "../components/SettingsPanel";
import { TagInput } from "../components/TagInput";
import { NoteEditor } from "../components/NoteEditor";
import { NoteContent } from "../components/NoteContent";
import { useTheme } from "../hooks/useTheme";
import {
  createNote,
  deleteNote,
  gcImages,
  getAllTagNames,
  getOlderNotes,
  getRecentNotes,
  getTimelineCounts,
  PAGE_SIZE,
  searchNotes,
  toggleLock,
  togglePin,
  updateNote,
} from "../lib/db";
import { daysAgo, formatDateLabel, formatTime, groupNotesByDate } from "../lib/date";
import { collectTags } from "../lib/tags";
import { tagColor } from "../lib/theme";
import type { Note } from "../lib/types";
import "./MainWindow.css";

const TIMELINE_KEY = "note.timeline.visible";

export function MainWindow() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState("");
  const [inputTags, setInputTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(() => {
    return localStorage.getItem(TIMELINE_KEY) !== "0";
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeDate, setActiveDate] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<Array<{ label: string; count: number }>>(
    []
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { themeId, setThemeId } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const filtered = Boolean(query.trim() || activeTag);

  const loadMeta = async () => {
    const [tags, counts] = await Promise.all([
      getAllTagNames(),
      getTimelineCounts(),
    ]);
    setAllTags(tags);
    const grouped = new Map<string, number>();
    for (const row of counts) {
      const label = formatDateLabel(row.created_at);
      grouped.set(label, (grouped.get(label) ?? 0) + Number(row.count));
    }
    setTimeline(
      Array.from(grouped.entries()).map(([label, count]) => ({ label, count }))
    );
  };

  const loadNotes = async () => {
    const data = filtered
      ? await searchNotes(query, activeTag)
      : await getRecentNotes(7);
    setNotes(data);
    if (filtered || data.length === 0) {
      setHasMore(false);
    } else {
      const unpinned = data.filter((note) => !note.pinned);
      const oldest = unpinned.length
        ? Math.min(...unpinned.map((note) => note.created_at))
        : daysAgo(6);
      const older = await getOlderNotes(oldest, 1);
      setHasMore(older.length > 0);
    }
    await loadMeta();
  };

  useEffect(() => {
    loadNotes();
    gcImages().catch(() => undefined);
    const unlisten = listen("notes-changed", () => {
      loadNotes();
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(TIMELINE_KEY, timelineOpen ? "1" : "0");
  }, [timelineOpen]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setFiltering(true);
      try {
        await loadNotes();
      } finally {
        setFiltering(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, activeTag]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchWrapRef.current
          ?.querySelector<HTMLInputElement>("input")
          ?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pinnedNotes = notes.filter((note) => note.pinned);
  const groupedNotes = groupNotesByDate(notes.filter((note) => !note.pinned));
  const noteGroups = [
    ...(pinnedNotes.length
      ? [{ key: "pinned", label: "置顶", notes: pinnedNotes, dateLabel: "" }]
      : []),
    ...Array.from(groupedNotes.entries()).map(([dateLabel, group]) => ({
      key: dateLabel,
      label: dateLabel,
      notes: group,
      dateLabel,
    })),
  ];
  const todayLabel = useMemo(() => {
    const now = new Date();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return {
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      weekday: `星期${weekdays[now.getDay()]}`,
    };
  }, []);
  const tagSuggestions = useMemo(
    () => Array.from(new Set([...allTags, ...collectTags(notes)])),
    [allTags, notes]
  );

  const loadMore = async () => {
    if (filtered || loadingMore || !hasMore || notes.length === 0) return;
    const unpinned = notes.filter((note) => !note.pinned);
    const oldest = unpinned.length
      ? Math.min(...unpinned.map((note) => note.created_at))
      : daysAgo(6);
    setLoadingMore(true);
    try {
      const older = await getOlderNotes(oldest);
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setNotes((current) => {
        const seen = new Set(current.map((note) => note.id));
        return [...current, ...older.filter((note) => !seen.has(note.id))];
      });
      setHasMore(older.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      loadMore();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      await createNote(input.trim(), inputTags);
      setInput("");
      setInputTags([]);
      await loadNotes();
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId || deleting) return;
    const id = pendingDeleteId;
    setDeleting(true);
    try {
      if (editingId === id) {
        setEditingId(null);
      }
      await deleteNote(id);
      setPendingDeleteId(null);
      await loadNotes();
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (id: string, currentPinned: number) => {
    await togglePin(id, currentPinned === 0);
    await loadNotes();
  };

  const handleToggleLock = async (id: string, currentLocked: number) => {
    await toggleLock(id, currentLocked === 0);
    await loadNotes();
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setDraft(note.content);
    setDraftTags(note.tags);
    setExpandedIds((current) => new Set(current).add(note.id));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
    setDraftTags([]);
  };

  const saveEdit = async (id: string) => {
    const content = draft.trim();
    if (!content) return;
    await updateNote(id, content, draftTags);
    setEditingId(null);
    setDraft("");
    setDraftTags([]);
    await loadNotes();
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const jumpToDate = async (dateLabel: string) => {
    setActiveDate(dateLabel);
    const el = document.getElementById(`date-${dateLabel}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (filtered) return;
    await loadMore();
    requestAnimationFrame(() => {
      document
        .getElementById(`date-${dateLabel}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className={`main-window ${timelineOpen ? "" : "timeline-collapsed"}`}>
      <TitleBar
        title="HygNote"
        extra={
          <>
            <div className="titlebar-search" ref={searchWrapRef}>
              <Input
                size="small"
                allowClear
                shadow={false}
                value={query}
                placeholder="搜索内容和标签"
                prefix={<Icon name="icon-critterpedia" size={16} />}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery("")}
                aria-label="搜索笔记"
              />
            </div>
            <Button
              size="small"
              type={timelineOpen ? "primary" : "default"}
              onClick={() => setTimelineOpen((v) => !v)}
            >
              {timelineOpen ? "隐藏时间轴" : "显示时间轴"}
            </Button>
          </>
        }
        settingsOpen={settingsOpen}
        onSettings={() => setSettingsOpen((v) => !v)}
      />

      <div className="main-body">
        <aside className="timeline">
          <div className="timeline-today">
            <strong>{todayLabel.date}</strong>
            <span>{todayLabel.weekday}</span>
          </div>
          <Title size="small">时间轴</Title>
          <div className="timeline-items">
            {timeline.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`timeline-item ${activeDate === item.label ? "active" : ""}`}
                onClick={() => jumpToDate(item.label)}
              >
                <span>{item.label}</span>
                <span className="count">{item.count}</span>
              </button>
            ))}
          </div>

          <Divider type="wave-yellow" />
          <Title size="small">标签</Title>
          <div className="tag-filter">
            <Tag
              size="small"
              variant={activeTag ? "soft" : "solid"}
              color="app-teal"
              onClick={() => setActiveTag("")}
            >
              全部
            </Tag>
            {allTags.map((tag) => (
              <Tag
                key={tag}
                size="small"
                variant={activeTag === tag ? "solid" : "soft"}
                color={tagColor(tag)}
                onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </aside>

        <div className="main-content">
          <div className="notes-list" ref={listRef} onScroll={onListScroll}>
            {noteGroups.map((group) => (
              <div
                key={group.key}
                className="note-group"
                id={group.dateLabel ? `date-${group.dateLabel}` : undefined}
              >
                <div className="date-header">{group.label}</div>
                {group.notes.map((note) => {
                  const editing = editingId === note.id;
                  const expanded = expandedIds.has(note.id);
                  return (
                    <Card
                      key={note.id}
                      hoverable={!editing}
                      color={note.pinned ? "app-yellow" : "default"}
                      className={`note-item ${editing ? "is-editing" : ""} ${note.locked ? "is-locked" : ""}`}
                    >
                      <div className="note-header">
                        <span className="note-time">
                          {formatTime(note.created_at)}
                          {note.pinned ? " · 置顶" : ""}
                          {note.locked ? " · 私密" : ""}
                          <button
                            type="button"
                            className={`note-lock ${note.locked ? "is-on" : ""}`}
                            title={note.locked ? "取消私密" : "设为私密"}
                            aria-label={note.locked ? "取消私密" : "设为私密"}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleLock(note.id, note.locked);
                            }}
                          >
                            <span className="note-lock-icon" aria-hidden="true" />
                          </button>
                        </span>
                        <div className="note-actions">
                          {editing ? (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                disabled={!draft.trim()}
                                onClick={() => saveEdit(note.id)}
                              >
                                保存
                              </Button>
                              <Button size="small" onClick={cancelEdit}>
                                取消
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="small"
                                onClick={() => startEdit(note)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="small"
                                onClick={() =>
                                  handleTogglePin(note.id, note.pinned)
                                }
                              >
                                {note.pinned ? "取消置顶" : "置顶"}
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingDeleteId(note.id);
                                }}
                              >
                                删除
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {editing ? (
                        <>
                          <NoteEditor
                            value={draft}
                            onChange={setDraft}
                            onSubmit={() => saveEdit(note.id)}
                            onEscape={cancelEdit}
                            submitHint="Ctrl+Enter 保存"
                          />
                          <TagInput
                            tags={draftTags}
                            onChange={setDraftTags}
                            suggestions={tagSuggestions}
                            placeholder="给这条笔记加标签"
                          />
                        </>
                      ) : (
                        <>
                          <NoteContent
                            content={note.content}
                            query={query}
                            expanded={expanded}
                            onToggle={() => toggleExpanded(note.id)}
                            onDoubleClick={() => startEdit(note)}
                          />
                          {note.tags.length > 0 ? (
                            <div className="tag-list">
                              {note.tags.map((tag) => (
                                <Tag
                                  key={tag}
                                  size="small"
                                  variant={activeTag === tag ? "solid" : "soft"}
                                  color={tagColor(tag)}
                                  onClick={() =>
                                    setActiveTag(activeTag === tag ? "" : tag)
                                  }
                                >
                                  {tag}
                                </Tag>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            ))}

            {notes.length === 0 && !filtering && (
              <Card type="dashed" className="empty-state">
                <p>
                  {query.trim()
                    ? `没有找到「${query.trim()}」`
                    : activeTag
                      ? `没有「${activeTag}」相关笔记`
                      : "小岛还很安静"}
                </p>
                <span>
                  {query.trim()
                    ? "试试别的关键词，或点标签筛选"
                    : "在下方记下一条，Enter 发送"}
                </span>
              </Card>
            )}

            {!filtered && hasMore && notes.length > 0 && (
              <div className="load-more">
                <Button size="small" loading={loadingMore} onClick={loadMore}>
                  {loadingMore ? "加载中" : "加载更早的笔记"}
                </Button>
              </div>
            )}
          </div>

          <div className="composer">
            <form onSubmit={handleSubmit}>
              <div className="composer-fields">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="记一条小岛日记... Enter 发送，Shift+Enter 换行"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={loading}
                />
                <TagInput
                  tags={inputTags}
                  onChange={setInputTags}
                  suggestions={tagSuggestions}
                  placeholder="标签，如 工作、想法"
                  disabled={loading}
                />
              </div>
              <Button
                htmlType="submit"
                type="primary"
                loading={loading}
                disabled={!input.trim()}
              >
                发送
              </Button>
            </form>
          </div>
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        themeId={themeId}
        onClose={() => setSettingsOpen(false)}
        onThemeChange={setThemeId}
      />

      {pendingDeleteId ? (
        <div
          className="confirm-mask"
          onClick={cancelDelete}
          role="presentation"
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <strong id="delete-confirm-title">删除这条笔记？</strong>
            <p>删除后无法恢复。</p>
            <div className="confirm-actions">
              <Button size="small" disabled={deleting} onClick={cancelDelete}>
                取消
              </Button>
              <Button
                size="small"
                danger
                loading={deleting}
                onClick={confirmDelete}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
