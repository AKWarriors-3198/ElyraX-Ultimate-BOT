import { NextResponse } from "next/server";
import { DiscordAccessError, listDashboardGuilds } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ guilds: await listDashboardGuilds() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiscordAccessError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to load your servers.";
    return NextResponse.json({ error: message }, { status });
  }
}
