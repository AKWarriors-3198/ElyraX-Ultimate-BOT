import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, LockKeyhole } from "lucide-react";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  discord_config_missing: "Discord OAuth is not configured on this deployment yet.",
  oauth_state: "Your sign-in request expired or could not be verified. Please try again.",
  oauth_exchange: "Discord could not complete sign-in. Please try again.",
  oauth_response: "Discord returned an incomplete sign-in response. Please try again.",
  discord_profile: "ELYRAX could not load your Discord profile. Please try again.",
  session_setup: "ELYRAX could not create a secure session. Check the server configuration.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-page">
    <section className="auth-card">
      <Link href="/" className="profile-inline" style={{ color: "#c6c6c9" }}><ArrowLeft size={14}/> Back to ELYRAX</Link>
      <div style={{ marginTop: 30 }}><Link href="/" className="wordmark"><span className="wordmark-mark">E</span> ELYRAX</Link></div>
      <h1>Sign in to your workspace.</h1>
      <p>Connect your Discord account to find servers you own or have permission to manage.</p>
      {error && <div className="auth-error" role="alert">{errors[error] ?? "Sign-in could not be completed. Please try again."}</div>}
      {error === "discord_config_missing" && <p className="auth-setup-note">Add <code>DISCORD_CLIENT_ID</code>, <code>DISCORD_CLIENT_SECRET</code> and <code>DISCORD_REDIRECT_URI</code> to the D: project&apos;s <code>.env.local</code>. Register that exact callback URL in the Discord Developer Portal, then restart the dashboard. Keep the client secret and bot token server-side.</p>}
      <a href="/api/auth/discord" className="button" style={{ width: "100%", marginTop: 20 }}>Continue with Discord <span aria-hidden="true">→</span></a>
      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 20, color: "#777982", fontSize: 10 }}><LockKeyhole size={12}/> OAuth secrets and bot credentials stay on the server.</p>
    </section>
  </main>;
}
