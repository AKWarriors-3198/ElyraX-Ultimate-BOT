import Link from "next/link";
import { Activity, ArrowRight, Bot, Check, Fingerprint, LockKeyhole, MessageSquare, Music2, Shield, Sparkles, Users, Zap } from "lucide-react";
import { getPublicStats } from "@/lib/bot-api";

export const dynamic = "force-dynamic";

function count(value: number | undefined) {
  return value === undefined ? "—" : Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export default async function HomePage() {
  const [stats, inviteUrl] = await Promise.all([
    getPublicStats(),
    Promise.resolve(process.env.ELYRAX_INVITE_URL),
  ]);

  return <main className="landing">
    <div className="shell">
      <header className="landing-header">
        <Link href="/" className="wordmark" aria-label="ELYRAX home"><span className="wordmark-mark">E</span> ELYRAX</Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">Features</a><a href="#security">Security</a><a href="#metrics">Live metrics</a>
        </nav>
        <Link href="/login" className="button button-secondary button-small">Login with Discord <ArrowRight size={14}/></Link>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow hero-eyebrow">ELYRAX • SERVER CONTROL</div>
          <h1 className="hero-title"><span className="hero-title-line">Make your</span><span className="hero-title-line">server feel</span><span className="hero-title-line hero-title-emphasis">well run.</span></h1>
          <p className="hero-copy">A focused command center for the communities you care about. Configure moderation, safety, welcome flows and more with clear controls and permission-aware access.</p>
          <div className="hero-actions">
            <Link href="/login" className="button">Login with Discord <ArrowRight size={16}/></Link>
            {inviteUrl ? <a href={inviteUrl} target="_blank" rel="noreferrer" className="button button-secondary">Add ELYRAX to Discord <Bot size={15}/></a> : <span className="button button-secondary" aria-disabled="true" title="Set ELYRAX_INVITE_URL on the server">Invite link not configured <Bot size={15}/></span>}
          </div>
          {!inviteUrl && <p className="hero-note"><LockKeyhole size={13}/> The invite URL is supplied by the deployment environment.</p>}
        </div>

        <div className="hero-preview-stage">
          <div className="hero-preview" aria-label="Illustrative preview of the dashboard; it does not contain server data">
          <div className="preview-top"><div className="preview-controls"><span/><span/><span/></div><span className="eyebrow" style={{fontSize:9}}>ELYRAX CONTROL</span><div style={{width:30}}/></div>
          <div className="preview-body">
            <div className="preview-side"><div className="preview-side-line active"/>{Array.from({length:7},(_,i)=><div key={i} className="preview-side-line" style={{width:`${55+(i%3)*12}%`}}/>)}</div>
            <div className="preview-main"><div className="preview-title"/><div className="preview-subtitle"/><div className="preview-metrics"><div className="preview-metric"/><div className="preview-metric"/><div className="preview-metric"/></div><div className="preview-panel"><div className="preview-panel-title"/><div className="preview-row"/><div className="preview-row" style={{width:"78%"}}/><div className="preview-row" style={{width:"88%"}}/></div><div className="preview-panel" style={{minHeight:62}}><div className="preview-panel-title"/><div className="preview-row" style={{width:"61%"}}/></div></div>
          </div>
          <div className="preview-status"><span className="status-dot"/><span>Live server data appears after setup</span></div>
        </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="section-heading"><div className="eyebrow">A connected toolkit</div><h2>Everything your team needs to keep things moving.</h2><p>Purpose-built settings for day-to-day community operations, all in one place.</p></div>
        <div className="feature-grid">
          {[
            { Icon: Shield, title: "Moderation & safety", copy: "Set AutoMod rules, anti-nuke thresholds, and moderation logs around your team." },
            { Icon: Users, title: "Member experience", copy: "Shape welcome, verification, leveling, tickets, and role assignment." },
            { Icon: Activity, title: "Useful visibility", copy: "Connect live bot metrics and route activity to the channels you choose." },
            { Icon: Zap, title: "Automation", copy: "Configure invites, temporary voice rooms, reactions, and other repeatable work." },
            { Icon: MessageSquare, title: "Clear conversations", copy: "Keep support and community messages organized with purposeful defaults." },
            { Icon: Music2, title: "Voice features", copy: "Manage music and voice automation settings from the same workspace." },
            { Icon: Fingerprint, title: "Permission aware", copy: "Server access is checked against Discord membership and management permissions." },
            { Icon: Sparkles, title: "Made for ELYRAX", copy: "A calm, deliberate interface designed around the bot and your server." },
          ].map(({Icon,title,copy})=><article className="feature-card" key={title}><div className="feature-icon"><Icon size={16}/></div><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section id="security" className="landing-section">
        <div className="section-heading"><div className="eyebrow">Built for responsible access</div><h2>Safety controls you can understand.</h2><p>Server identity and management permissions are verified on the server for dashboard requests.</p></div>
        <div className="security-layout">
          <article className="security-card"><h3>Protection with context</h3><p>Give your team clear thresholds for destructive actions, trusted users, and where security events should be logged.</p><div className="security-list"><div className="security-item"><Check size={14}/> Mass-ban and channel-change safeguards</div><div className="security-item"><Check size={14}/> Whitelists for trusted users and roles</div><div className="security-item"><Check size={14}/> AutoMod actions with transparent settings</div></div></article>
          <article className="security-card"><h3>Private by design</h3><p>Discord OAuth and bot credentials stay on the server. Dashboard requests are checked against current Discord guild permissions and bot installation.</p><div className="security-list"><div className="security-item"><Check size={14}/> Encrypted, HTTP-only login session</div><div className="security-item"><Check size={14}/> Same-origin checks on configuration writes</div><div className="security-item"><Check size={14}/> Separate settings and audit records per server</div></div></article>
        </div>
      </section>

      <section id="metrics" className="landing-section">
        <div className="section-heading"><div className="eyebrow">Live, when connected</div><h2>Useful numbers. No demo data.</h2><p>Public bot statistics are read from the ELYRAX API. Values remain blank until that service returns real metrics.</p></div>
        <div className="stat-grid">
          <div className="stat-card"><span>Servers connected</span><strong>{count(stats?.servers)}</strong></div>
          <div className="stat-card"><span>Commands handled</span><strong>{count(stats?.commands)}</strong></div>
          <div className="stat-card"><span>Bot uptime</span><strong>{stats?.uptimePercent === undefined ? "—" : `${stats.uptimePercent.toFixed(1)}%`}</strong></div>
        </div>
        {!stats && <p className="stat-note">Live statistics are unavailable until the bot API is configured and reachable.</p>}
      </section>

      <footer className="landing-footer"><Link href="/" className="wordmark"><span className="wordmark-mark">E</span> ELYRAX</Link><span>© {new Date().getFullYear()} ElyraX Development</span><Link href="/login">Open dashboard <ChevronRightIcon/></Link></footer>
    </div>
  </main>;
}

function ChevronRightIcon() { return <span aria-hidden="true">→</span>; }
