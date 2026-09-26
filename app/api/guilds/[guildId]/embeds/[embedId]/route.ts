import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, requireSameOrigin } from "@/lib/discord";
import { deleteEmbedTemplate, listEmbedTemplates, saveEmbedTemplate } from "@/lib/db";
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

function responseError(error: unknown) {
  const status = error instanceof DiscordAccessError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this embed." }, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ guildId: string; embedId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId, embedId } = await params;
    const { session, guild } = await authorizeGuild(guildId);
    const body = await readBody(request);
    if (!isEmbedPayload(body)) return NextResponse.json({ error: "Embed name or content is invalid. Review Discord's embed limits and try again." }, { status: 400 });
    if (!listEmbedTemplates(guildId).some((embed) => embed.id === embedId)) return NextResponse.json({ error: "This embed template was not found for this server." }, { status: 404 });
    const embed = saveEmbedTemplate(guildId, guild.name, session.user.id, embedId, body.name.trim(), body.document);
    return NextResponse.json({ embed }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return responseError(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string; embedId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId, embedId } = await params;
    const { session } = await authorizeGuild(guildId);
    if (!deleteEmbedTemplate(guildId, session.user.id, embedId)) return NextResponse.json({ error: "This embed template was not found for this server." }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return responseError(error); }
}
