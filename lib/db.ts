import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type SqliteDatabase = InstanceType<typeof Database>;
type SqliteGlobal = typeof globalThis & { __elyraxDatabase?: SqliteDatabase; __elyraxDatabasePath?: string };
const sqliteGlobal = globalThis as SqliteGlobal;

function getDatabase() {
  const databasePath = path.resolve(process.env.DATABASE_PATH || "./data/elyrax.db");
  if (sqliteGlobal.__elyraxDatabase) {
    if (sqliteGlobal.__elyraxDatabasePath !== databasePath) throw new Error("DATABASE_PATH cannot change after the ELYRAX database is opened.");
    return sqliteGlobal.__elyraxDatabase;
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("busy_timeout = 15000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    const migrationDirectory = path.join(process.cwd(), "lib", "migrations");
    const migrations = fs.readdirSync(migrationDirectory).filter((entry) => entry.endsWith(".sql")).sort();
    db.transaction(() => {
      db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
      for (const name of migrations) {
        const applied = db.prepare("SELECT name FROM schema_migrations WHERE name = ?").get(name);
        if (applied) continue;
        const sql = fs.readFileSync(path.join(migrationDirectory, name), "utf8");
        db.exec(sql);
        db.prepare("INSERT INTO schema_migrations(name, applied_at) VALUES(?, ?)").run(name, Date.now());
      }
    }).immediate();
  } catch (error) {
    db.close();
    throw error;
  }

  sqliteGlobal.__elyraxDatabasePath = databasePath;
  sqliteGlobal.__elyraxDatabase = db;
  return db;
}

export function getSettings(guildId: string, module: string) {
  const row = getDatabase().prepare("SELECT config, updated_at FROM guild_settings WHERE guild_id = ? AND module = ?")
    .get(guildId, module) as { config: string; updated_at: number } | undefined;
  if (!row) return { config: {} as Record<string, unknown>, updatedAt: null as number | null };
  try {
    return { config: JSON.parse(row.config) as Record<string, unknown>, updatedAt: row.updated_at };
  } catch {
    return { config: {} as Record<string, unknown>, updatedAt: row.updated_at };
  }
}

export function getSavedModuleCount(guildId: string) {
  const row = getDatabase().prepare(`SELECT
    (SELECT COUNT(*) FROM guild_settings WHERE guild_id = ?) +
    (SELECT COUNT(*) FROM guild_embeds WHERE guild_id = ?) AS count`)
    .get(guildId, guildId) as { count: number };
  return row.count;
}

export function saveSettings(guildId: string, guildName: string, module: string, config: Record<string, unknown>, actorId: string) {
  const db = getDatabase();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`INSERT INTO guilds(guild_id, name, created_at, updated_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`)
      .run(guildId, guildName, now, now);
    db.prepare(`INSERT INTO guild_settings(guild_id, module, config, updated_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(guild_id, module) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`)
      .run(guildId, module, JSON.stringify(config), now);
    // Keep user-entered settings out of the audit log details.
    db.prepare("INSERT INTO audit_logs(guild_id, actor_id, action, detail, created_at) VALUES(?, ?, ?, '', ?)")
      .run(guildId, actorId, `settings.${module}.updated`, now);
  })();
  return now;
}

export function clearGuildSettings(guildId: string, actorId: string) {
  const db = getDatabase();
  const now = Date.now();
  db.transaction(() => {
    db.prepare("DELETE FROM guild_settings WHERE guild_id = ?").run(guildId);
    db.prepare("DELETE FROM guild_embeds WHERE guild_id = ?").run(guildId);
    db.prepare("INSERT INTO audit_logs(guild_id, actor_id, action, detail, created_at) VALUES(?, ?, 'settings.reset', '', ?)")
      .run(guildId, actorId, now);
  })();
}

export type EmbedDocument = {
  content: string;
  authorName: string;
  authorIconUrl: string;
  title: string;
  titleUrl: string;
  description: string;
  color: string;
  thumbnailUrl: string;
  imageUrl: string;
  footer: string;
  footerIconUrl: string;
  timestampEnabled: boolean;
  fields: Array<{ name: string; value: string; inline: boolean }>;
};

export type EmbedTemplate = {
  id: string;
  name: string;
  document: EmbedDocument;
  createdAt: number;
  updatedAt: number;
};

export function listEmbedTemplates(guildId: string): EmbedTemplate[] {
  const rows = getDatabase().prepare(`SELECT embed_id, name, definition, created_at, updated_at
    FROM guild_embeds WHERE guild_id = ? ORDER BY updated_at DESC, name COLLATE NOCASE ASC`).all(guildId) as Array<{
      embed_id: string; name: string; definition: string; created_at: number; updated_at: number;
    }>;
  return rows.flatMap((row) => {
    try {
      const document = JSON.parse(row.definition) as EmbedDocument;
      return [{ id: row.embed_id, name: row.name, document, createdAt: row.created_at, updatedAt: row.updated_at }];
    } catch {
      return [];
    }
  });
}

export function saveEmbedTemplate(guildId: string, guildName: string, actorId: string, id: string, name: string, document: EmbedDocument) {
  const db = getDatabase();
  const now = Date.now();
  const existing = db.prepare("SELECT created_at FROM guild_embeds WHERE guild_id = ? AND embed_id = ?").get(guildId, id) as { created_at: number } | undefined;
  db.transaction(() => {
    db.prepare(`INSERT INTO guilds(guild_id, name, created_at, updated_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`)
      .run(guildId, guildName, now, now);
    db.prepare(`INSERT INTO guild_embeds(guild_id, embed_id, name, definition, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, embed_id) DO UPDATE SET name = excluded.name, definition = excluded.definition, updated_at = excluded.updated_at`)
      .run(guildId, id, name, JSON.stringify(document), now, now);
    db.prepare("INSERT INTO audit_logs(guild_id, actor_id, action, detail, created_at) VALUES(?, ?, ?, '', ?)")
      .run(guildId, actorId, existing ? "embeds.updated" : "embeds.created", now);
  })();
  return { id, name, document, createdAt: existing?.created_at ?? now, updatedAt: now };
}

export function deleteEmbedTemplate(guildId: string, actorId: string, id: string) {
  const db = getDatabase();
  const now = Date.now();
  return db.transaction(() => {
    const result = db.prepare("DELETE FROM guild_embeds WHERE guild_id = ? AND embed_id = ?").run(guildId, id);
    if (result.changes) {
      db.prepare("INSERT INTO audit_logs(guild_id, actor_id, action, detail, created_at) VALUES(?, ?, 'embeds.deleted', '', ?)")
        .run(guildId, actorId, now);
    }
    return result.changes > 0;
  })();
}
