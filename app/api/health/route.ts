import { NextResponse } from "next/server";

function configured(name: string) {
  const value = process.env[name]?.trim();
  return Boolean(value && !value.startsWith("replace-with-") && !value.startsWith("your-"));
}

export async function GET() {
  const checks = {
    discordOAuth: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"].every(configured),
    sessionEncryption: configured("NEXTAUTH_SECRET") && (process.env.NEXTAUTH_SECRET?.length ?? 0) >= 32,
    discordBot: configured("DISCORD_BOT_TOKEN"),
    botApi: configured("ELYRAX_API_URL") && configured("ELYRAX_API_SECRET"),
    botInvite: configured("ELYRAX_INVITE_URL"),
  };
  const missing = Object.entries({
    discordOAuth: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"],
    sessionEncryption: ["NEXTAUTH_SECRET"],
    discordBot: ["DISCORD_BOT_TOKEN"],
    botApi: ["ELYRAX_API_URL", "ELYRAX_API_SECRET"],
    botInvite: ["ELYRAX_INVITE_URL"],
  }).flatMap(([check, variables]) => checks[check as keyof typeof checks] ? [] : variables);

  return NextResponse.json({
    status: "ok",
    service: "elyrax-dashboard",
    readiness: missing.length === 0 ? "ready" : "needs_configuration",
    checks,
    missing: [...new Set(missing)],
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
