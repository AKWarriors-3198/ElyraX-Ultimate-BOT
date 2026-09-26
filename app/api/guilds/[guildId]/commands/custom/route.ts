import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, requireSameOrigin } from "@/lib/discord";
import { getSettings, saveSettings } from "@/lib/db";
import { syncCustomCommands, type BotSyncResult } from "@/lib/bot-api";

export const dynamic = "force-dynamic";
const maxBodyBytes = 128 * 1024;
type CustomCommand = { id: string; name: string; description: string; response: string; embedEnabled: boolean; embedTitle: string; embedDescription: string; embedColor: string; embedFields: Array<{ name: string; value: string; inline: boolean }> };

function validCommands(value: unknown): value is CustomCommand[] {
  if (!Array.isArray(value) || value.length > 50) return false;
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const command = item as Record<string, unknown>;
    if (typeof command.id !== "string" || !/^[a-z0-9-]{1,64}$/i.test(command.id)) return false;
    if (typeof command.name !== "string" || !/^[a-z][a-z0-9_-]{1,31}$/i.test(command.name)) return false;
    if (names.has(command.name.toLowerCase())) return false;
    names.add(command.name.toLowerCase());
    if (typeof command.description !== "string" || command.description.length > 100) return false;
    if (typeof command.response !== "string" || command.response.length > 2000) return false;
    if (typeof command.embedEnabled !== "boolean") return false;
    if (typeof command.embedTitle !== "string" || command.embedTitle.length > 256) return false;
    if (typeof command.embedDescription !== "string" || command.embedDescription.length > 4096) return false;
    if (typeof command.embedColor !== "string" || !/^#[0-9a-f]{6}$/i.test(command.embedColor)) return false;
    if (!Array.isArray(command.embedFields) || command.embedFields.length > 25 || command.embedFields.some((field) => !field || typeof field !== "object" || Array.isArray(field) || typeof field.name !== "string" || field.name.length > 256 || typeof field.value !== "string" || field.value.length > 1024 || typeof field.inline !== "boolean")) return false;
    if (command.response.length === 0 && command.embedEnabled && command.embedTitle.length === 0 && command.embedDescription.length === 0) return false;
    const embedLength = command.embedTitle.length + command.embedDescription.length + command.embedFields.reduce((total, field) => total + field.name.length + field.value.length, 0);
    if (embedLength > 6_000) return false;
  }
  return true;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await authorizeGuild(guildId);
    const saved = getSettings(guildId, "customcommands").config.commands;
    return NextResponse.json({ commands: Array.isArray(saved) ? saved : [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load custom commands." }, { status });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId } = await params;
    const { session, guild } = await authorizeGuild(guildId);
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > maxBodyBytes) return NextResponse.json({ error: "Custom commands payload is too large." }, { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) return NextResponse.json({ error: "Custom commands payload is too large." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Custom commands must be valid JSON." }, { status: 400 }); }
    const commands = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).commands : undefined;
    if (!validCommands(commands)) return NextResponse.json({ error: "Custom commands contain invalid or duplicate values." }, { status: 400 });
    saveSettings(guildId, guild.name, "customcommands", { commands }, session.user.id);
    const sync: BotSyncResult = await syncCustomCommands(guildId, commands);
    return NextResponse.json({ commands, sync }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save custom commands." }, { status });
  }
}
