"use client";
import Link from "next/link";

import {
  Activity, BadgeCheck, Bell, Bot, ChevronRight, ClipboardList, Code2, Gavel, Hash, Layers,
  LayoutDashboard, Mail, Menu, MessageSquare, Music, Radio, Search, Settings, Shield,
  ShieldAlert, Smile, Sparkles, Ticket, Terminal, TrendingUp, Users, X, Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { navigation } from "@/lib/features";
import { FeaturePanel } from "@/components/feature-panel";
import { OverviewPanel } from "@/components/overview-panel";
import { CommandCenter } from "@/components/command-center";
import { CustomCommandsPanel } from "@/components/custom-commands-panel";
import { EmbedLibraryPanel } from "@/components/embed-library-panel";

type PublicUser = { id: string; username: string; global_name: string | null; avatar: string | null };
type PublicGuild = { id: string; name: string; icon: string | null; approximate_member_count?: number };

const icons = {
  overview: LayoutDashboard,
  embeds: Layers,
  commands: Terminal,
  customcommands: Code2,
  moderation: Gavel,
  antinuke: ShieldAlert,
  automod: Shield,
  welcome: Mail,
  logging: ClipboardList,
  leveling: TrendingUp,
  roles: Users,
  reactionroles: Smile,
  tickets: Ticket,
  verification: BadgeCheck,
  autoreact: Sparkles,
  joindm: MessageSquare,
  invites: Hash,
  j2c: Radio,
  tracking: Activity,
  vanityroles: Zap,
  music: Music,
  settings: Settings,
} as const;

function avatarUrl(user: PublicUser) {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null;
}
function guildIconUrl(guild: PublicGuild) {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : null;
}

export function DashboardWorkspace({ guild, user, initialView }: { guild: PublicGuild; user: PublicUser; initialView: string }) {
  const activeView = navigation.some((item) => item.id === initialView) ? initialView : "overview";
  const [filter, setFilter] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const items = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return navigation.filter((item) => !query || item.label.toLocaleLowerCase().includes(query));
  }, [filter]);
  const userName = user.global_name || user.username;
  const avatar = avatarUrl(user);
  const serverIcon = guildIconUrl(guild);
  const basePath = `/dashboard/${guild.id}`;

  return <div className="dashboard">
    <button className={`sidebar-overlay ${mobileOpen ? "open" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>
    <aside className={`dashboard-sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><Link href="/" className="wordmark"><span className="wordmark-mark">E</span> ELYRAX</Link><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={15}/></button></div>
      <Link className="sidebar-server" href="/dashboard/servers">
        {serverIcon ? <img className="server-icon" src={serverIcon} alt=""/> : <div className="server-icon"><Bot size={16}/></div>}
        <span style={{minWidth:0,flex:1}}><span className="sidebar-server-name" title={guild.name}>{guild.name}</span><span className="sidebar-server-label">Server workspace</span></span><ChevronRight size={14} color="#737680"/>
      </Link>
      <label className="sidebar-search"><Search size={13}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a feature" aria-label="Find a feature"/></label>
      <div className="sidebar-nav">
        <div className="sidebar-section-label">Manage server</div>
        <nav aria-label="Server features">
          {items.map((item) => {
            const Icon = icons[item.id as keyof typeof icons];
            const href = item.id === "overview" ? basePath : `${basePath}?view=${item.id}`;
            return <Link key={item.id} href={href} onClick={() => setMobileOpen(false)} className={`nav-link ${activeView === item.id ? "active" : ""}`} aria-current={activeView === item.id ? "page" : undefined}><Icon size={15}/>{item.label}</Link>;
          })}
          {items.length === 0 && <p style={{padding:"0 10px",color:"#777982",fontSize:11}}>No matching feature.</p>}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-account">{avatar ? <img className="avatar" src={avatar} alt=""/> : <div className="avatar"/>}<span style={{minWidth:0}}><span className="sidebar-account-name" title={userName}>{userName}</span><span className="sidebar-account-caption">Discord account</span></span></div>
        <form action="/api/auth/logout" method="post"><button className="icon-button" title="Log out" aria-label="Log out" type="submit"><X size={14}/></button></form>
      </div>
    </aside>

    <div className="dashboard-main">
      <header className="dashboard-topbar">
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={16}/></button>
          {serverIcon ? <img className="server-icon" src={serverIcon} alt=""/> : <div className="server-icon"><Bot size={15}/></div>}
          <div className="topbar-server"><span className="topbar-server-name">{guild.name}</span><span className="bot-status installed"><span className="status-dot"/>ELYRAX installed</span></div>
        </div>
        <div className="topbar-right">
          <label className="topbar-search"><Search size={13}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search features" aria-label="Search features"/></label>
          <div style={{position:"relative"}}><button className="icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => {setNotificationsOpen((value) => !value);setUserMenuOpen(false);}}><Bell size={15}/></button>{notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><p>Bot alerts will appear here when the ELYRAX API is connected.</p></div>}</div>
          <div style={{position:"relative"}}><button className="icon-button" aria-label="Account menu" aria-expanded={userMenuOpen} onClick={() => {setUserMenuOpen((value) => !value);setNotificationsOpen(false);}}>{avatar ? <img className="avatar" src={avatar} alt="" style={{width:24,height:24,border:0}}/> : <Users size={15}/>}</button>{userMenuOpen && <div className="account-popover"><span className="account-popover-name">{userName}</span><span className="account-popover-id">ID {user.id}</span><Link href="/dashboard/servers">Change server</Link><form action="/api/auth/logout" method="post"><button type="submit">Log out</button></form></div>}</div>
        </div>
      </header>

      <main className="dashboard-content">
        {activeView === "overview" ? <OverviewPanel guild={guild}/> : activeView === "embeds" ? <EmbedLibraryPanel key={activeView} guild={guild}/> : activeView === "commands" ? <CommandCenter key={activeView} guild={guild}/> : activeView === "customcommands" ? <CustomCommandsPanel key={activeView} guild={guild}/> : <FeaturePanel key={activeView} guild={guild} user={user} module={activeView}/>}
      </main>
      <footer className="dashboard-footer"><span>ElyraX Development</span><span>Server settings are checked on every request.</span></footer>
    </div>
  </div>;
}
