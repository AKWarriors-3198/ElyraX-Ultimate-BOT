export type BotSyncResult = { status: "synced" | "pending" | "error"; message: string };

export type CommandOptionType = "string" | "integer" | "number" | "boolean" | "channel" | "role" | "user";
export type CommandOption = { name: string; description: string; type: CommandOptionType; required: boolean; min?: number; max?: number; channelTypes?: number[]; choices?: Array<{ name: string; value: string | number | boolean }> };
export type GuildCommand = { name: string; description: string; category?: string; options: CommandOption[] };

function botApiConfiguration() {
  const base = process.env.ELYRAX_API_URL?.replace(/\/+$/, "");
  const secret = process.env.ELYRAX_API_SECRET;
  if (!base || !secret || secret === "replace-with-a-random-secret") return null;
  if (!/^https?:\/\//i.test(base)) return null;
  return { base, secret };
}

const commandOptionTypes = new Set<CommandOptionType>(["string", "integer", "number", "boolean", "channel", "role", "user"]);

function cleanGuildCommands(raw: unknown): GuildCommand[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): GuildCommand[] => {
    if (!item || typeof item !== "object") return [];
    const command = item as Record<string, unknown>;
    if (typeof command.name !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(command.name)) return [];
    const options = Array.isArray(command.options) ? command.options.flatMap((option): CommandOption[] => {
      if (!option || typeof option !== "object") return [];
      const entry = option as Record<string, unknown>;
      if (typeof entry.name !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(entry.name) || typeof entry.type !== "string" || !commandOptionTypes.has(entry.type as CommandOptionType)) return [];
      const choices = Array.isArray(entry.choices) ? entry.choices.flatMap((choice): Array<{ name: string; value: string | number | boolean }> => {
        if (!choice || typeof choice !== "object") return [];
        const value = (choice as Record<string, unknown>).value;
        const name = (choice as Record<string, unknown>).name;
        return typeof name === "string" && (typeof value === "string" || typeof value === "number" || typeof value === "boolean") ? [{ name: name.slice(0, 100), value }] : [];
      }).slice(0, 25) : undefined;
      const allowedChannelTypes = [0, 2, 4, 5, 13, 15, 16];
      const channelTypes = Array.isArray(entry.channelTypes) ? entry.channelTypes.filter((type): type is number => typeof type === "number" && allowedChannelTypes.includes(type)).slice(0, allowedChannelTypes.length) : undefined;
      return [{ name: entry.name, description: typeof entry.description === "string" ? entry.description.slice(0, 100) : "", type: entry.type as CommandOptionType, required: entry.required === true, ...(typeof entry.min === "number" && Number.isFinite(entry.min) ? { min: entry.min } : {}), ...(typeof entry.max === "number" && Number.isFinite(entry.max) ? { max: entry.max } : {}), ...(channelTypes?.length ? { channelTypes } : {}), ...(choices ? { choices } : {}) }];
    }).slice(0, 25) : [];
    return [{ name: command.name, description: typeof command.description === "string" ? command.description.slice(0, 200) : "", ...(typeof command.category === "string" ? { category: command.category.slice(0, 64) } : {}), options }];
  }).slice(0, 500);
}

export async function getGuildCommands(guildId: string) {
  const api = botApiConfiguration();
  if (!api) return { available: false as const, reason: "The command catalog appears after the ELYRAX bot API is connected." };
  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/commands`, { headers: { Authorization: `Bearer ${api.secret}` }, cache: "no-store", signal: AbortSignal.timeout(3_500) });
    if (!response.ok) return { available: false as const, reason: "The ELYRAX API has not returned this server's command catalog yet." };
    const raw = await response.json() as { commands?: unknown };
    if (!Array.isArray(raw.commands)) return { available: false as const, reason: "The bot API command catalog response is invalid." };
    return { available: true as const, commands: cleanGuildCommands(raw.commands) };
  } catch {
    return { available: false as const, reason: "The ELYRAX bot API is unavailable. Check the server-side connection settings." };
  }
}

export async function invokeGuildCommand(guildId: string, name: string, options: Record<string, unknown>, actorId: string): Promise<BotSyncResult> {
  const api = botApiConfiguration();
  if (!api) return { status: "pending", message: "Command execution is pending ELYRAX bot API configuration." };
  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/commands/run`, { method: "POST", headers: { Authorization: `Bearer ${api.secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ name, options, actorId }), cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const body = await response.json().catch(() => ({})) as { message?: unknown };
    if (!response.ok) return { status: "error", message: typeof body.message === "string" ? body.message.slice(0, 300) : "The bot could not run this command. Check its Discord permissions and try again." };
    return { status: "synced", message: typeof body.message === "string" ? body.message.slice(0, 300) : `/${name} was sent to the ELYRAX bot.` };
  } catch {
    return { status: "error", message: "The bot API did not respond. This command was not confirmed as executed." };
  }
}

export async function syncCustomCommands(guildId: string, commands: unknown): Promise<BotSyncResult> {
  const api = botApiConfiguration();
  if (!api) return { status: "pending", message: "Saved in the dashboard. Custom command sync is pending bot API configuration." };
  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/commands/custom`, { method: "PUT", headers: { Authorization: `Bearer ${api.secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ commands }), cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return { status: "error", message: "Saved in the dashboard, but the bot API could not sync these custom commands." };
    return { status: "synced", message: "Custom commands saved and synced to ELYRAX." };
  } catch {
    return { status: "error", message: "Saved in the dashboard, but the bot API is unavailable. Save again to retry sync." };
  }
}

export async function sendWelcomeTest(guildId: string, config: Record<string, unknown>, actorId: string): Promise<BotSyncResult> {
  const api = botApiConfiguration();
  if (!api) return { status: "pending", message: "Welcome test sending is pending bot API configuration." };
  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/welcome/test`, { method: "POST", headers: { Authorization: `Bearer ${api.secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ config, actorId }), cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const body = await response.json().catch(() => ({})) as { message?: unknown };
    if (!response.ok) return { status: "error", message: typeof body.message === "string" ? body.message.slice(0, 300) : "ELYRAX could not send the welcome test. Check its channel permissions." };
    return { status: "synced", message: typeof body.message === "string" ? body.message.slice(0, 300) : "Welcome test sent to Discord." };
  } catch {
    return { status: "error", message: "The bot API did not respond. The welcome test was not confirmed as sent." };
  }
}

export async function syncModuleSettings(guildId: string, module: string, config: Record<string, unknown>): Promise<BotSyncResult> {
  const api = botApiConfiguration();
  if (!api) return { status: "pending", message: "Saved in the dashboard. Bot API sync is pending configuration." };

  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/settings/${module}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${api.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(config),
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    });
    if (!response.ok) return { status: "error", message: "Saved in the dashboard, but the bot API could not sync this change." };
    return { status: "synced", message: "Settings saved and synced to ELYRAX." };
  } catch {
    return { status: "error", message: "Saved in the dashboard, but the bot API is unavailable. Sync can be retried by saving again." };
  }
}

export type OverviewStats = {
  members?: number;
  onlineMembers?: number;
  channels?: number;
  roles?: number;
  commandsUsed?: number;
  moderationActions?: number;
  uptimePercent?: number;
  botStatus?: "online" | "offline" | "unknown";
  levelActivity?: Array<{ label: string; value: number }>;
};

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function percentage(value: unknown) {
  const number = finiteNonNegative(value);
  return number !== undefined && number <= 100 ? number : undefined;
}

export async function getOverviewStats(guildId: string) {
  const api = botApiConfiguration();
  if (!api) return { available: false as const, reason: "Live metrics appear after the ELYRAX bot API is configured." };

  try {
    const response = await fetch(`${api.base}/guilds/${guildId}/stats`, {
      headers: { Authorization: `Bearer ${api.secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    });
    if (!response.ok) return { available: false as const, reason: "The bot API has not returned live metrics yet." };
    const raw = await response.json() as Record<string, unknown>;
    const activity = Array.isArray(raw.levelActivity) ? raw.levelActivity.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const value = finiteNonNegative(row.value);
      return typeof row.label === "string" && value !== undefined ? [{ label: row.label.slice(0, 32), value }] : [];
    }).slice(0, 14) : undefined;
    const status = raw.botStatus;
    const stats: OverviewStats = {
      members: finiteNonNegative(raw.members),
      onlineMembers: finiteNonNegative(raw.onlineMembers),
      channels: finiteNonNegative(raw.channels),
      roles: finiteNonNegative(raw.roles),
      commandsUsed: finiteNonNegative(raw.commandsUsed),
      moderationActions: finiteNonNegative(raw.moderationActions),
      uptimePercent: percentage(raw.uptimePercent),
      botStatus: status === "online" || status === "offline" ? status : "unknown",
      levelActivity: activity,
    };
    if (Object.values(stats).every((value) => value === undefined || (Array.isArray(value) && value.length === 0) || value === "unknown")) {
      return { available: false as const, reason: "The bot API has not returned live metrics yet." };
    }
    return { available: true as const, stats };
  } catch {
    return { available: false as const, reason: "The bot API is unavailable. Check the server-side connection settings." };
  }
}

export async function getPublicStats() {
  const api = botApiConfiguration();
  if (!api) return null;
  try {
    const response = await fetch(`${api.base}/stats/public`, {
      headers: { Authorization: `Bearer ${api.secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return null;
    const raw = await response.json() as Record<string, unknown>;
    const stats = {
      servers: finiteNonNegative(raw.servers),
      commands: finiteNonNegative(raw.commands),
      uptimePercent: percentage(raw.uptimePercent),
    };
    return Object.values(stats).some((value) => value !== undefined) ? stats : null;
  } catch {
    return null;
  }
}
