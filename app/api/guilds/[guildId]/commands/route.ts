import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError } from "@/lib/discord";
import { getGuildCommands } from "@/lib/bot-api";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await authorizeGuild(guildId);
    const result = await getGuildCommands(guildId);
    return NextResponse.json(result, { status: result.available ? 200 : 503, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ available: false, reason: error instanceof Error ? error.message : "Could not load the command catalog." }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
