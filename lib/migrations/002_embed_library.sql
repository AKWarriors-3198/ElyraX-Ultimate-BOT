CREATE TABLE IF NOT EXISTS guild_embeds (
  guild_id TEXT NOT NULL,
  embed_id TEXT NOT NULL,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, embed_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guild_embeds_updated_idx ON guild_embeds(guild_id, updated_at DESC);
