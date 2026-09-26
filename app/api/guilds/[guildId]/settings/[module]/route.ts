import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, fetchGuildResources, requireSameOrigin } from "@/lib/discord";
import { getSettings, saveSettings } from "@/lib/db";
import { features } from "@/lib/features";
import { syncModuleSettings } from "@/lib/bot-api";

export const dynamic = "force-dynamic";
const supportedModules = new Set(Object.keys(features));
const maxBodyBytes = 64 * 1024;

function validateConfig(module: string, value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  const defaults = features[module].defaults;
  if (Object.keys(config).length > Object.keys(defaults).length) return false;
  for (const [key, fieldValue] of Object.entries(config)) {
    if (!(key in defaults) || key === "__proto__" || key === "constructor" || key === "prototype") return false;
    const example = defaults[key];
    const field = features[module].fields.find((entry) => entry.key === key);
    if (typeof example === "string" && (typeof fieldValue !== "string" || fieldValue.length > (field?.maxLength ?? 5_000))) return false;
    if (typeof example === "boolean" && typeof fieldValue !== "boolean") return false;
    if (typeof example === "number" && (typeof fieldValue !== "number" || !Number.isFinite(fieldValue) || fieldValue < 0 || fieldValue > 1_000_000)) return false;
    if (field?.type === "embed-fields") {
      if (!Array.isArray(fieldValue) || fieldValue.length > 25 || fieldValue.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string" || entry.name.length > 256 || typeof entry.value !== "string" || entry.value.length > 1024 || typeof entry.inline !== "boolean")) return false;
    } else if (Array.isArray(example) && (!Array.isArray(fieldValue) || fieldValue.length > 50 || fieldValue.some((entry) => typeof entry !== "string" || entry.length > 64))) return false;
    if (typeof fieldValue === "number" && field && ((field.min !== undefined && fieldValue < field.min) || (field.max !== undefined && fieldValue > field.max))) return false;
    if (typeof fieldValue === "string" && field?.type === "select" && field.options && !field.options.some((option) => option.value === fieldValue)) return false;
    if (typeof fieldValue === "string" && (field?.type === "channel" || field?.type === "role") && fieldValue && !/^\d{15,22}$/.test(fieldValue)) return false;
    if (typeof fieldValue === "string" && field?.type === "color" && !/^#[0-9a-f]{6}$/i.test(fieldValue)) return false;
    if (typeof fieldValue === "string" && field?.type === "url" && fieldValue) {
      try { if (!["http:", "https:"].includes(new URL(fieldValue).protocol)) return false; }
      catch { return false; }
    }
    if (Array.isArray(fieldValue) && field?.type === "roles" && fieldValue.some((entry) => !/^\d{15,22}$/.test(String(entry)))) return false;
  }
  if (module === "welcome") {
    const embedFields = Array.isArray(config.embedFields) ? config.embedFields as Array<{ name: string; value: string }> : [];
    const embedLength = ["embedAuthorName", "embedTitle", "embedDescription", "footer"].reduce((total, key) => total + String(config[key] || "").length, 0) + embedFields.reduce((total, field) => total + field.name.length + field.value.length, 0);
    if (embedLength > 6_000) return false;
  }
  return true;
}

async function validateRoleHierarchy(guildId: string, module: string, config: Record<string, unknown>) {
  const directKeys: Record<string, string[]> = {
    roles: ["autoRoleId"],
    verification: ["verifiedRoleId"],
  };
  const ids = new Set<string>();
  for (const key of directKeys[module] ?? []) {
    const value = config[key];
    if (typeof value === "string" && value) ids.add(value);
  }
  for (const id of module === "welcome" && Array.isArray(config.autoRoleIds) ? config.autoRoleIds : []) {
    if (typeof id === "string" && id) ids.add(id);
  }
  const ruleTextKeys: Record<string, string[]> = {
    roles: ["vanityRoleRules"],
    vanityroles: ["rules"],
    leveling: ["roleRewards"],
    reactionroles: ["roleMappings"],
  };
  for (const key of ruleTextKeys[module] ?? []) {
    const value = config[key];
    if (typeof value === "string") for (const id of value.match(/\b\d{15,22}\b/g) ?? []) ids.add(id);
  }
  if (!ids.size) return;
  const resources = await fetchGuildResources(guildId);
  for (const id of ids) {
    const role = resources.roles.find((entry) => entry.id === id);
    if (!role) throw new DiscordAccessError("A selected role no longer exists or cannot be managed by the bot.", 400);
    if (role.position >= resources.botHighestRolePosition) {
      throw new DiscordAccessError("Move ELYRAX's highest role above every role it assigns, then try again.", 400);
    }
  }
}

async function validateChannelSelections(guildId: string, module: string, config: Record<string, unknown>) {
  const selections = features[module].fields.flatMap((field) => {
    const value = config[field.key];
    return field.type === "channel" && typeof value === "string" && value
      ? [{ id: value, allowedTypes: field.channelTypes ?? [0, 5, 15] }]
      : [];
  });
  if (!selections.length) return;
  const resources = await fetchGuildResources(guildId);
  for (const selection of selections) {
    const channel = resources.channels.find((entry) => entry.id === selection.id);
    if (!channel) throw new DiscordAccessError("A selected channel does not belong to this server or is unavailable to ELYRAX.", 400);
    if (!selection.allowedTypes.includes(channel.type)) throw new DiscordAccessError("A selected channel has the wrong Discord channel type.", 400);
  }
}

async function routeParams(context: { params: Promise<{ guildId: string; module: string }> }) {
  const params = await context.params;
  return { ...params, module: params.module.toLowerCase() };
}

export async function GET(_: NextRequest, context: { params: Promise<{ guildId: string; module: string }> }) {
  try {
    const { guildId, module } = await routeParams(context);
    await authorizeGuild(guildId);
    if (!supportedModules.has(module)) return NextResponse.json({ error: "Unknown feature." }, { status: 404 });
    return NextResponse.json({ guildId, module, ...getSettings(guildId, module) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load this feature." }, { status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ guildId: string; module: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId, module } = await routeParams(context);
    const { session, guild } = await authorizeGuild(guildId);
    if (!supportedModules.has(module)) return NextResponse.json({ error: "Unknown feature." }, { status: 404 });
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > maxBodyBytes) return NextResponse.json({ error: "Settings payload is too large." }, { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) return NextResponse.json({ error: "Settings payload is too large." }, { status: 413 });

    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "Settings must be valid JSON." }, { status: 400 }); }
    if (!validateConfig(module, parsed)) return NextResponse.json({ error: "Settings contain unsupported or invalid values." }, { status: 400 });

    const current = getSettings(guildId, module).config;
    const config = { ...current, ...parsed };
    if (!validateConfig(module, config)) return NextResponse.json({ error: "Saved settings are invalid. Reset this feature and try again." }, { status: 400 });
    await validateChannelSelections(guildId, module, config);
    await validateRoleHierarchy(guildId, module, config);
    const updatedAt = saveSettings(guildId, guild.name, module, config, session.user.id);
    const sync = await syncModuleSettings(guildId, module, config);
    return NextResponse.json({ ok: true, guildId, module, config, updatedAt, sync }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this feature." }, { status });
  }
}

export const PUT = PATCH;
