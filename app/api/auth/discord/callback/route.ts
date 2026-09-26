import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/session";

type OAuthTokenResponse = { access_token: string; refresh_token: string; expires_in: number };
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("elyrax_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_state", request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=discord_config_missing", request.url));
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!tokenResponse.ok) return NextResponse.redirect(new URL("/login?error=oauth_exchange", request.url));
    const token = await tokenResponse.json() as OAuthTokenResponse;
    if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) {
      return NextResponse.redirect(new URL("/login?error=oauth_response", request.url));
    }

    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!userResponse.ok) return NextResponse.redirect(new URL("/login?error=discord_profile", request.url));
    const user = await userResponse.json() as DiscordUser;
    if (!user.id || !user.username) return NextResponse.redirect(new URL("/login?error=discord_profile", request.url));

    await setSession({
      user: { id: user.id, username: user.username, global_name: user.global_name ?? null, avatar: user.avatar ?? null },
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    });
    const response = NextResponse.redirect(new URL("/dashboard/servers", request.url));
    response.cookies.delete("elyrax_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=session_setup", request.url));
  }
}
