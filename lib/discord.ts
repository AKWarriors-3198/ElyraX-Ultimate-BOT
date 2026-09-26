import type { DashboardSession } from "@/lib/session";
import { getSession } from "@/lib/session";
import { getSavedModuleCount } from "@/lib/db";

const API = "https://discord.com/api/v10";

export class DiscordAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "DiscordAccessError";
  }
}

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
};

function manageable(guild: DiscordGuild) {
  if (guild.owner) return true;
  try {
    const permissions = BigInt(guild.permissions || "0");
    const administrator = 1n << 3n;
    const manageGuild = 1n << 5n;
    return (permissions & (administrator | manageGuild)) !== 0n;
  } catch {
    return false;
  }
}

async function discordFetch<T>(path: string, authorization: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new DiscordAccessError("Your Discord session expired. Please sign in again.", 401);
    throw new DiscordAccessError("Discord could not verify server access. Try again in a moment.", 502);
  }
  return response.json() as Promise<T>;
}

export async function fetchUserGuilds(session: DashboardSession) {
  return discordFetch<DiscordGuild[]>("/users/@me/guilds?with_counts=true", `Bearer ${session.accessToken}`);
}

export async function fetchBotGuildIds(): Promise<Set<string> | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  const guilds = await discordFetch<Array<{ id: string }>>("/users/@me/guilds", `Bot ${token}`);
  return new Set(guilds.map((guild) => guild.id));
}

export async function listDashboardGuilds() {
  const session = await getSession();
  if (!session) throw new DiscordAccessError("Sign in with Discord to continue.", 401);

  const [guilds, botGuildIds] = await Promise.all([fetchUserGuilds(session), fetchBotGuildIds().catch(() => null)]);
  return guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    owner: guild.owner,
    approximateMemberCount: guild.approximate_member_count,
    manageable: manageable(guild),
    installed: botGuildIds ? botGuildIds.has(guild.id) : null,
    configurationStatus: manageable(guild) ? getSavedModuleCount(guild.id) : null,
    permissions: guild.permissions,
  }));
}

export async function authorizeGuild(guildId: string) {
  if (!/^\d{15,22}$/.test(guildId)) throw new DiscordAccessError("Invalid server ID.", 400);
  const session = await getSession();
  if (!session) throw new DiscordAccessError("Sign in with Discord to continue.", 401);

  const guilds = await fetchUserGuilds(session);
  const guild = guilds.find((entry) => entry.id === guildId);
  if (!guild) throw new DiscordAccessError("This server is not connected to your Discord account.", 403);
  if (!manageable(guild)) throw new DiscordAccessError("You need the Manage Server permission or server ownership to change settings.", 403);

  const botGuildIds = await fetchBotGuildIds();
  if (!botGuildIds) throw new DiscordAccessError("Server management is not ready until DISCORD_BOT_TOKEN is configured on the server.", 503);
  if (!botGuildIds.has(guildId)) throw new DiscordAccessError("ELYRAX is not installed on this server yet.", 409);

  return { session, guild };
}

export async function fetchGuildResources(guildId: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new DiscordAccessError("Discord bot resources are not configured on the server yet.", 503);
  const authorization = `Bot ${token}`;
  const [channels, roles, botUser] = await Promise.all([
    discordFetch<Array<{ id: string; name: string; type: number }>>(`/guilds/${guildId}/channels`, authorization),
    discordFetch<Array<{ id: string; name: string; color: number; position: number; managed: boolean; icon: string | null }>>(`/guilds/${guildId}/roles`, authorization),
    discordFetch<{ id: string }>("/users/@me", authorization),
  ]);
  const botMember = await discordFetch<{ roles: string[] }>(`/guilds/${guildId}/members/${botUser.id}`, authorization);
  const botRoleIds = new Set(botMember.roles);
  const botHighestRolePosition = Math.max(-1, ...roles.filter((role) => botRoleIds.has(role.id)).map((role) => role.position));
  return {
    channels: channels.filter((channel) => [0, 2, 4, 5, 13, 15, 16].includes(channel.type)).map(({ id, name, type }) => ({ id, name, type })),
    roles: roles.filter((role) => !role.managed && role.id !== guildId).map(({ id, name, color, position, icon }) => ({ id, name, color, position, icon })),
    botHighestRolePosition,
  };
}

export async function validateGuildChannel(guildId: string, channelId: string, allowedTypes: number[]) {
  const resources = await fetchGuildResources(guildId);
  const channel = resources.channels.find((item) => item.id === channelId);
  if (!channel) throw new DiscordAccessError("The selected channel does not belong to this server or is unavailable to ELYRAX.", 400);
  if (!allowedTypes.includes(channel.type)) throw new DiscordAccessError("Choose a channel with the required Discord channel type.", 400);
  return channel;
}

export async function validateGuildMember(guildId: string, userId: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new DiscordAccessError("Discord bot resources are not configured on the server yet.", 503);
  if (!/^\d{15,22}$/.test(userId)) return false;
  const response = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    if (response.status === 401) throw new DiscordAccessError("The ElyraX bot token was rejected by Discord.", 503);
    throw new DiscordAccessError("Discord could not verify this server member. Try again in a moment.", 502);
  }
  return true;
}

export async function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new DiscordAccessError("The request origin could not be verified. Reload the dashboard and try again.", 403);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof DiscordAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Something went wrong while checking Discord access." }, { status: 500 });
}
