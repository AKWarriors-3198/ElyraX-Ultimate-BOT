CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Each row belongs to one guild and one feature, so unrelated feature settings
-- stay isolated and can be migrated independently as the bot API grows.
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT NOT NULL,
  module TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, module),
  FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS guild_settings_updated_idx ON guild_settings(guild_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_guild_created_idx ON audit_logs(guild_id, created_at DESC);
