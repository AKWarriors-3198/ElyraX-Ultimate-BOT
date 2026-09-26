import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "elyrax_session";
const MAX_SESSION_AGE = 60 * 60 * 24 * 14;

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type DashboardSession = {
  user: { id: string; username: string; global_name: string | null; avatar: string | null };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32 || secret === "replace-with-a-long-random-secret") {
    throw new Error("NEXTAUTH_SECRET must be set to a random value of at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

async function writeSession(session: DashboardSession) {
  const token = await new EncryptJWT(session)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + MAX_SESSION_AGE)
    .encrypt(encryptionKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_SESSION_AGE,
  });
}

export async function setSession(session: DashboardSession) {
  await writeSession(session);
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getSession(): Promise<DashboardSession | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtDecrypt(raw, encryptionKey());
    const session = payload as unknown as DashboardSession;
    if (!session.user?.id || !session.accessToken || !session.refreshToken) return null;

    if (session.accessTokenExpiresAt > Date.now() + 60_000) return session;

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const refreshed = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const nextSession: DashboardSession = {
      ...session,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      accessTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await writeSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
}
