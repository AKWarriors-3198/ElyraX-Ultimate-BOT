import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, requireSameOrigin } from "@/lib/discord";
import { getSettings } from "@/lib/db";
import { sendWelcomeTest } from "@/lib/bot-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    await requireSameOrigin(request);
    const { guildId } = await params;
    const { session } = await authorizeGuild(guildId);
    const config = getSettings(guildId, "welcome").config;
    const result = await sendWelcomeTest(guildId, config, session.user.id);
    const status = result.status === "synced" ? 200 : result.status === "pending" ? 503 : 502;
    return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send a welcome test." }, { status });
  }
}
