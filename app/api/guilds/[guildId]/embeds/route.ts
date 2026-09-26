import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, requireSameOrigin } from "@/lib/discord";
import { listEmbedTemplates, saveEmbedTemplate } from "@/lib/db";
import { isEmbedPayload } from "@/lib/embed-validation";

export const dynamic = "force-dynamic";
const maxBodyBytes = 48 * 1024;

async function readBody(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBodyBytes) throw new DiscordAccessError("Embed payload is too large.", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) throw new DiscordAccessError("Embed payload is too large.", 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new DiscordAccessError("Embed request must be valid JSON.", 400); }
}

function errorResponse(error: unknown) {
  const status = error instanceof DiscordAccessError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Could not access embed templates." }, { status });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await authorizeGuild(guildId);
    return NextResponse.json({ embeds: listEmbedTemplates(guildId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId } = await params;
    const { session, guild } = await authorizeGuild(guildId);
    const body = await readBody(request);
    if (!isEmbedPayload(body)) return NextResponse.json({ error: "Embed name or content is invalid. Review Discord's embed limits and try again." }, { status: 400 });
    if (listEmbedTemplates(guildId).length >= 100) return NextResponse.json({ error: "This server has reached the 100-template limit." }, { status: 409 });
    const embed = saveEmbedTemplate(guildId, guild.name, session.user.id, randomUUID(), body.name.trim(), body.document);
    return NextResponse.json({ embed }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
