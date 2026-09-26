import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError } from "@/lib/discord";
import { getOverviewStats } from "@/lib/bot-api";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await authorizeGuild(guildId);
    return NextResponse.json(await getOverviewStats(guildId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load server metrics." }, { status });
  }
}
