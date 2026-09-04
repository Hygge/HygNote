import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const PUBLIC_WHERE = "(COALESCE(locked, 0) = 0)";

export function resolveDbPath(explicit) {
  if (explicit) {
    return isAbsolute(explicit) ? explicit : join(process.cwd(), explicit);
  }

  const envDir = process.env.NOTE_DATA_DIR?.trim();
  if (envDir) return join(envDir, "notes.db");

  const exeDir = dirname(fileURLToPath(import.meta.url));
  const nearby = [
    join(process.cwd(), "data-dir.txt"),
    join(exeDir, "data-dir.txt"),
    join(exeDir, "..", "data-dir.txt"),
  ];
  for (const marker of nearby) {
    if (!existsSync(marker)) continue;
    const dir = readFileSync(marker, "utf8").trim();
    if (dir) return join(dir, "notes.db");
  }

  const portable = [
    join(process.cwd(), "data", "notes.db"),
    join(exeDir, "data", "notes.db"),
    join(exeDir, "..", "data", "notes.db"),
  ];
  for (const path of portable) {
    if (existsSync(path)) return path;
  }

  const documents = join(homedir(), "Documents", "NoteData", "notes.db");
  if (existsSync(documents)) return documents;

  return join(homedir(), "AppData", "Roaming", "com.note.app", "notes.db");
}

export function openPublicDb(explicit) {
  const dbPath = resolveDbPath(explicit);
  if (!existsSync(dbPath)) {
    throw new Error(`notes.db not found: ${dbPath}`);
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'")
    .get();
  if (!table) {
    db.close();
    throw new Error("notes table not found");
  }
  return { db, dbPath };
}

export function listRecentPublicNotes(db, days = 7, limit = 20) {
  const since = startOfDaysAgo(clampInt(days, 7, 1, 365) - 1);
  const safeLimit = clampInt(limit, 20, 1, 100);
  return db
    .prepare(
      `SELECT id, content, created_at, pinned, tags
       FROM notes
       WHERE ${PUBLIC_WHERE}
         AND (pinned = 1 OR created_at >= ?)
       ORDER BY pinned DESC, created_at DESC
       LIMIT ?`
    )
    .all(since, safeLimit)
    .map(mapPublicNote);
}

export function searchPublicNotes(db, query = "", tag = "", limit = 20) {
  const keyword = String(query ?? "").trim();
  const tagName = String(tag ?? "").trim();
  const safeLimit = clampInt(limit, 20, 1, 100);
  if (!keyword && !tagName) {
    return listRecentPublicNotes(db, 7, safeLimit);
  }
  if (keyword && tagName) {
    const like = `%${escapeLike(keyword)}%`;
    const tagLike = `%${escapeLike(tagName)}%`;
    return db
      .prepare(
        `SELECT id, content, created_at, pinned, tags
         FROM notes
         WHERE ${PUBLIC_WHERE}
           AND (content LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
           AND tags LIKE ? ESCAPE '\\'
         ORDER BY pinned DESC, created_at DESC
         LIMIT ?`
      )
      .all(like, like, tagLike, safeLimit)
      .filter((row) => hasTag(row.tags, tagName))
      .map(mapPublicNote);
  }
  if (keyword) {
    const like = `%${escapeLike(keyword)}%`;
    return db
      .prepare(
        `SELECT id, content, created_at, pinned, tags
         FROM notes
         WHERE ${PUBLIC_WHERE}
           AND (content LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
         ORDER BY pinned DESC, created_at DESC
         LIMIT ?`
      )
      .all(like, like, safeLimit)
      .map(mapPublicNote);
  }
  const tagLike = `%${escapeLike(tagName)}%`;
  return db
    .prepare(
      `SELECT id, content, created_at, pinned, tags
       FROM notes
       WHERE ${PUBLIC_WHERE}
         AND tags LIKE ? ESCAPE '\\'
       ORDER BY pinned DESC, created_at DESC
       LIMIT ?`
    )
    .all(tagLike, safeLimit)
    .filter((row) => hasTag(row.tags, tagName))
    .map(mapPublicNote);
}

function mapPublicNote(row) {
  return {
    id: row.id,
    content: row.content,
    created_at: Number(row.created_at),
    created_at_iso: new Date(Number(row.created_at)).toISOString(),
    pinned: Number(row.pinned) ? 1 : 0,
    tags: parseTags(row.tags),
  };
}

function parseTags(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim())
      : [];
  } catch {
    return [];
  }
}

function hasTag(raw, tag) {
  return parseTags(raw).some((item) => item.toLowerCase() === tag.toLowerCase());
}

function escapeLike(value) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function startOfDaysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
