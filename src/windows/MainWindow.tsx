import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button, Card, DatePicker, Divider, Icon, Input, Tag, Title } from "animal-island-ui";
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
  getDateNoteInfo,
  getOlderNotes,
  getRecentNotes,
  getTimelineCounts,
  PAGE_SIZE,
  searchNotes,
  toggleLock,
  togglePin,
  updateNote,
} from "../lib/db";
import {
  daysAgo,
  formatDateLabel,
  formatDateLabelFromKey,
  formatTime,
  groupNotesByDate,
} from "../lib/date";
import { collectTags } from "../lib/tags";
import { tagColor } from "../lib/theme";
import type { Note } from "../lib/types";
import "./MainWindow.css";

const TIMELINE_KEY = "note.timeline.visible";
const TIMELINE_PAGE_SIZE = 7;

type TimelineItem = {
  dateKey: string;
  label: string;
  count: number;
};

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
  const [activeDateKey, setActiveDateKey] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineHasMore, setTimelineHasMore] = useState(true);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { themeId, setThemeId } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const timelineItemsRef = useRef<HTMLDivElement>(null);

  const filtered = Boolean(query.trim() || activeTag || activeDateKey);

  const loadInitialTimeline = async () => {
    const currentLimit = Math.max(timeline.length, TIMELINE_PAGE_SIZE);
    const counts = await getTimelineCounts(currentLimit, 0);
    const items: TimelineItem[] = counts.map((row) => ({
      dateKey: row.date_key,
      label: formatDateLabel(row.created_at),
      count: Number(row.count),
    }));

    if (activeDateKey && !items.some((item) => item.dateKey === activeDateKey)) {
      const info = await getDateNoteInfo(activeDateKey);
      if (info) {
        items.unshift({
          dateKey: info.date_key,
          label: formatDateLabelFromKey(info.date_key),
          count: Number(info.count),
        });
        items.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
      }
    }

    setTimeline(items);
    setTimelineHasMore(counts.length >= currentLimit);
  };

  const loadMoreTimeline = async () => {
    if (timelineLoadingMore || !timelineHasMore) return;
    setTimelineLoadingMore(true);
    try {
      const nextCounts = await getTimelineCounts(TIMELINE_PAGE_SIZE, timeline.length);
      if (nextCounts.length === 0) {
        setTimelineHasMore(false);
        return;
      }
      const newItems: TimelineItem[] = nextCounts.map((row) => ({
        dateKey: row.date_key,
        label: formatDateLabel(row.created_at),
        count: Number(row.count),
      }));

      setTimeline((prev) => {
        const seen = new Set(prev.map((i) => i.dateKey));
        const merged = [...prev];
        for (const item of newItems) {
          if (!seen.has(item.dateKey)) {
            merged.push(item);
            seen.add(item.dateKey);
          }
        }
        return merged;
      });
      setTimelineHasMore(nextCounts.length >= TIMELINE_PAGE_SIZE);
    } finally {
      setTimelineLoadingMore(false);
    }
  };

  const onTimelineScroll = () => {
    const el = timelineItemsRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      loadMoreTimeline();
    }
  };

  const scrollActiveTimelineItemIntoView = (dateKey: string) => {
    requestAnimationFrame(() => {
      const el = timelineItemsRef.current?.querySelector<HTMLElement>(
        `[data-date-key="${dateKey}"]`
      );
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const loadMeta = async () => {
    const tags = await getAllTagNames();
    setAllTags(tags);
    await loadInitialTimeline();
  };

  const loadNotes = async () => {
    const data = filtered
      ? await searchNotes(query, activeTag, activeDateKey)
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
  }, [query, activeTag, activeDateKey]);

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

  const selectTimelineDate = (dateKey: string) => {
    if (activeDateKey === dateKey) {
      setActiveDateKey("");
    } else {
      setActiveDateKey(dateKey);
      scrollActiveTimelineItemIntoView(dateKey);
    }
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
            <div className="titlebar-datepicker">
              <DatePicker
                size="small"
                allowClear
                placeholder="按日期筛选"
                value={activeDateKey || null}
                onChange={(val) => {
                  if (!val || Array.isArray(val)) {
                    setActiveDateKey("");
                  } else {
                    setActiveDateKey(val);
                    scrollActiveTimelineItemIntoView(val);
                  }
                  listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
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
          <div className="timeline-section-header">
            <Title size="small">时间轴</Title>
            {activeDateKey && (
              <button
                type="button"
                className="timeline-clear-btn"
                onClick={() => setActiveDateKey("")}
              >
                清除过滤
              </button>
            )}
          </div>
          <div
            className="timeline-items"
            ref={timelineItemsRef}
            onScroll={onTimelineScroll}
          >
            {timeline.map((item) => (
              <button
                key={item.dateKey}
                data-date-key={item.dateKey}
                type="button"
                className={`timeline-item ${activeDateKey === item.dateKey ? "active" : ""}`}
                onClick={() => selectTimelineDate(item.dateKey)}
              >
                <span>{item.label}</span>
                <span className="count">{item.count}</span>
              </button>
            ))}
            {timelineLoadingMore && (
              <div className="timeline-loading-tip">加载中...</div>
            )}
            {!timelineHasMore && timeline.length > 0 && (
              <div className="timeline-loading-tip">已无更多日期</div>
            )}
          </div>

          <Divider type="wave-yellow" />
          <div className="timeline-tag-section">
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
                      : activeDateKey
                        ? `「${formatDateLabelFromKey(activeDateKey)}」暂无笔记`
                        : "小岛还很安静"}
                </p>
                <span>
                  {query.trim()
                    ? "试试别的关键词，或点标签筛选"
                    : activeDateKey
                      ? "当天没有记录笔记，您可以点此清除筛选或在下方记录"
                      : "在下方记下一条，Enter 发送"}
                </span>
                {activeDateKey && (
                  <div className="empty-state-action">
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => setActiveDateKey("")}
                    >
                      返回全部笔记
                    </Button>
                  </div>
                )}
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
