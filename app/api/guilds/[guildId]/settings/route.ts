import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, requireSameOrigin } from "@/lib/discord";
import { clearGuildSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId } = await params;
    const { session } = await authorizeGuild(guildId);
    clearGuildSettings(guildId, session.user.id);
    return NextResponse.json({ ok: true, message: "Dashboard settings have been reset." });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reset server settings." }, { status });
  }
}
