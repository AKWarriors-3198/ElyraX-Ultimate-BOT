import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, fetchGuildResources, requireSameOrigin, validateGuildMember } from "@/lib/discord";
import { getGuildCommands, invokeGuildCommand, type CommandOption, type GuildCommand } from "@/lib/bot-api";

export const dynamic = "force-dynamic";
const maxBodyBytes = 24 * 1024;

async function validateOptions(guildId: string, command: GuildCommand, value: unknown): Promise<boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  if (Object.keys(options).length > command.options.length) return false;
  const definitions = new Map(command.options.map((option) => [option.name, option]));
  let resources: Awaited<ReturnType<typeof fetchGuildResources>> | null = null;
  const getResources = async () => resources ?? (resources = await fetchGuildResources(guildId));
  for (const name of Object.keys(options)) if (!definitions.has(name)) return false;
  for (const definition of command.options) {
    const item = options[definition.name];
    if (item === undefined || item === null || item === "") {
      if (definition.required) return false;
      continue;
    }
    if (!validOptionValue(definition, item)) return false;
    if (definition.type === "channel" && typeof item === "string") {
      const allowedTypes = definition.channelTypes?.length ? definition.channelTypes : [0, 2, 4, 5, 13, 15, 16];
      const serverResources = await getResources();
      const channel = serverResources.channels.find((resource) => resource.id === item);
      if (!channel) throw new DiscordAccessError("The selected channel does not belong to this server or is unavailable to ELYRAX.", 400);
      if (!allowedTypes.includes(channel.type)) throw new DiscordAccessError("Choose a channel with the required Discord channel type.", 400);
    }
    if (definition.type === "role" && typeof item === "string") {
      const serverResources = await getResources();
      if (!serverResources.roles.some((role) => role.id === item)) throw new DiscordAccessError("The selected role does not belong to this server or is unavailable to ELYRAX.", 400);
    }
    if (definition.type === "user" && typeof item === "string" && !await validateGuildMember(guildId, item)) {
      throw new DiscordAccessError("The selected user is not a member of this server.", 400);
    }
  }
  return true;
}

function validOptionValue(definition: CommandOption, value: unknown) {
  const valid = (() => {
    switch (definition.type) {
      case "string": return typeof value === "string" && value.length <= 2_000;
      case "number": return typeof value === "number" && Number.isFinite(value);
      case "integer": return typeof value === "number" && Number.isInteger(value);
      case "boolean": return typeof value === "boolean";
      case "channel":
      case "role":
      case "user": return typeof value === "string" && /^\d{15,22}$/.test(value);
    }
  })();
  if (!valid) return false;
  if ((definition.type === "number" || definition.type === "integer") && typeof value === "number") {
    if (definition.min !== undefined && value < definition.min) return false;
    if (definition.max !== undefined && value > definition.max) return false;
  }
  if (definition.choices?.length && !definition.choices.some((choice) => choice.value === value)) return false;
  return true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId } = await params;
    const { session } = await authorizeGuild(guildId);
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > maxBodyBytes) return NextResponse.json({ error: "Command payload is too large." }, { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) return NextResponse.json({ error: "Command payload is too large." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Command request must be valid JSON." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Command request is invalid." }, { status: 400 });
    const payload = body as Record<string, unknown>;
    if (typeof payload.name !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(payload.name)) return NextResponse.json({ error: "Choose a valid command." }, { status: 400 });
    const catalog = await getGuildCommands(guildId);
    if (!catalog.available) return NextResponse.json({ error: catalog.reason }, { status: 503 });
    const command = catalog.commands.find((entry) => entry.name === payload.name);
    if (!command) return NextResponse.json({ error: "This command is not available in the current bot catalog." }, { status: 404 });
    const options = payload.options ?? {};
    if (!await validateOptions(guildId, command, options)) return NextResponse.json({ error: "Command options are incomplete or invalid." }, { status: 400 });
    if (!options || typeof options !== "object" || Array.isArray(options)) return NextResponse.json({ error: "Command options are incomplete or invalid." }, { status: 400 });
    const result = await invokeGuildCommand(guildId, command.name, options as Record<string, unknown>, session.user.id);
    const status = result.status === "synced" ? 200 : result.status === "pending" ? 503 : 502;
    return NextResponse.json({ ...result }, { status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run this command." }, { status });
  }
}
