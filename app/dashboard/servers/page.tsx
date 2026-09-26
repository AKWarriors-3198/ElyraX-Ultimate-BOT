import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DiscordAccessError, listDashboardGuilds } from "@/lib/discord";
import { ServerSelector, type ServerEntry } from "@/components/server-selector";

export const metadata: Metadata = { title: "Select a server" };
export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let servers: ServerEntry[] = [];
  let error = "";
  try {
    servers = await listDashboardGuilds();
  } catch (cause) {
    error = cause instanceof DiscordAccessError ? cause.message : "Discord could not load your server list. Refresh and try again.";
  }
  const displayName = session.user.global_name || session.user.username;
  const avatar = session.user.avatar ? `https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.png?size=64` : null;

  return <main className="servers-page"><div className="shell">
    <header className="servers-header">
      <Link href="/" className="wordmark"><span className="wordmark-mark">E</span> ELYRAX</Link>
      <div className="profile-inline">{avatar ? <img className="avatar" src={avatar} alt=""/> : <div className="avatar"/>}<span>{displayName}</span><form action="/api/auth/logout" method="post"><button className="button button-secondary button-small" type="submit">Log out</button></form></div>
    </header>
    <ServerSelector servers={servers} inviteUrl={process.env.ELYRAX_INVITE_URL} error={error}/>
    <footer className="landing-footer" style={{ marginTop: 55 }}><span>ElyraX Development</span><Link href="/">Back to home <span aria-hidden="true">→</span></Link></footer>
  </div></main>;
}
