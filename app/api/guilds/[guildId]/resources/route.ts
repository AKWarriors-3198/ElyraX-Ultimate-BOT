import { NextRequest, NextResponse } from "next/server";
import { authorizeGuild, DiscordAccessError, errorResponse, fetchGuildResources } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await authorizeGuild(guildId);
    return NextResponse.json(await fetchGuildResources(guildId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof DiscordAccessError) return errorResponse(error);
    return NextResponse.json({ error: "Could not load server channels and roles." }, { status: 500 });
  }
}
