import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { authorizeGuild, DiscordAccessError } from "@/lib/discord";
import { getSession } from "@/lib/session";
import { DashboardWorkspace } from "@/components/dashboard-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ guildId: string }> }): Promise<Metadata> {
  const { guildId } = await params;
  return { title: `Server ${guildId}` };
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { guildId } = await params;
  const { view = "overview" } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const { guild } = await authorizeGuild(guildId);
    return <DashboardWorkspace
      guild={{ id: guild.id, name: guild.name, icon: guild.icon, approximate_member_count: guild.approximate_member_count }}
      user={session.user}
      initialView={view}
    />;
  } catch (error) {
    if (error instanceof DiscordAccessError && error.status === 401) redirect("/login");
    const accessError = error instanceof DiscordAccessError ? error : null;
    const inviteUrl = process.env.ELYRAX_INVITE_URL;
    return <main className="access-page"><section className="access-card">
      <div className="feature-icon"><ShieldAlert size={17}/></div>
      <h1>Server access needs attention.</h1>
      <p>{accessError?.message ?? "ELYRAX could not verify this server right now. Try again shortly."}</p>
      <div className="access-card-actions"><Link href="/dashboard/servers" className="button button-secondary"><ArrowLeft size={14}/> Choose another server</Link>{accessError?.status === 409 && inviteUrl && <a href={inviteUrl} target="_blank" rel="noreferrer" className="button button-accent">Install ELYRAX <span aria-hidden="true">→</span></a>}</div>
      {accessError?.status === 503 && <p style={{marginTop:16,color:"#d6be89",fontSize:11}}>Server-side Discord bot credentials need configuration before guild access can be verified.</p>}
    </section></main>;
  }
}
