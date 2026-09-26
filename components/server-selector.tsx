"use client";

import { ArrowRight, Search, Server, Settings2, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ServerEntry = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  manageable: boolean;
  installed: boolean | null;
  configurationStatus: number | null;
  approximateMemberCount?: number;
};

function avatarUrl(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=96` : null;
}

export function ServerSelector({ servers, inviteUrl, error }: { servers: ServerEntry[]; inviteUrl?: string; error?: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem("elyrax:recent-servers") || "[]")); } catch { setRecent([]); }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const visible = servers.filter((server) => server.name.toLocaleLowerCase().includes(q));
    if (sort === "name") return visible.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "installed") return visible.sort((a, b) => Number(b.installed === true) - Number(a.installed === true) || a.name.localeCompare(b.name));
    return visible.sort((a, b) => {
      const ar = recent.indexOf(a.id), br = recent.indexOf(b.id);
      if (ar === -1 && br === -1) return a.name.localeCompare(b.name);
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return ar - br;
    });
  }, [query, recent, servers, sort]);

  return <>
    <div className="servers-intro"><div className="eyebrow">Your workspace</div><h1>Choose a server.</h1><p>Only server details returned by Discord are shown. Management is checked with your current account permissions.</p></div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <div className="server-toolbar">
      <label className="search-control"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your servers" aria-label="Search servers"/></label>
      <select value={sort} onChange={(event) => setSort(event.target.value)} className="field-control" aria-label="Sort servers"><option value="recent">Recently managed</option><option value="name">Name</option><option value="installed">ELYRAX installed</option></select>
    </div>
    {filtered.length === 0 ? <div className="empty-state"><Server size={22}/><strong>{servers.length ? "No servers match that search" : "No servers available yet"}</strong><p>{servers.length ? "Try another server name." : "Check that Discord OAuth is configured and your account has access to at least one server."}</p></div> : <div className="server-grid">
      {filtered.map((server) => {
        const image = avatarUrl(server.id, server.icon);
        const manageable = server.manageable;
        const installed = server.installed;
        const url = `/dashboard/${server.id}`;
        return <article className="server-card" key={server.id}>
          {image ? <img className="server-icon" src={image} alt="" loading="lazy"/> : <div className="server-icon"><Server size={18}/></div>}
          <div className="server-info">
            <strong title={server.name}>{server.name}</strong>
            <div className="server-meta"><Users size={11}/>{typeof server.approximateMemberCount === "number" ? `${Intl.NumberFormat().format(server.approximateMemberCount)} members · approximate` : "Member count unavailable"}</div>
            <div className={`server-state ${installed === null ? "pending" : installed === false ? "offline" : ""}`}><span className="status-dot"/>{installed === true ? "ELYRAX installed" : installed === false ? "ELYRAX not installed" : "Bot installation not verified"}</div>
            {manageable && installed === true && <div className="server-meta"><Settings2 size={11}/>{server.configurationStatus === null ? "Configuration status unavailable" : server.configurationStatus === 0 ? "Not configured" : `${server.configurationStatus} feature${server.configurationStatus === 1 ? "" : "s"} configured`}</div>}
            {!manageable && <div className="server-meta" style={{ color: "#c2c2c5", marginTop: 6 }}><ShieldCheck size={11}/> Requires Manage Server or Administrator</div>}
          </div>
          <div className="server-card-action">
            {manageable && installed === true ? <a href={url} onClick={() => { try { localStorage.setItem("elyrax:recent-servers", JSON.stringify([server.id, ...recent.filter((id) => id !== server.id)].slice(0, 8))); } catch { /* local recency is optional */ } }} className="button button-secondary button-small">Manage <ArrowRight size={13}/></a> : manageable && installed === false && inviteUrl ? <a href={inviteUrl} target="_blank" rel="noreferrer" className="button button-secondary button-small">Install <ArrowRight size={13}/></a> : <button className="button button-secondary button-small" disabled title={!manageable ? "Your Discord account does not have server management permissions." : installed === null ? "Configure DISCORD_BOT_TOKEN to verify bot installation." : "Configure ELYRAX_INVITE_URL to create an install link."}>{manageable && installed === false ? "Install needed" : manageable ? "Unavailable" : "No access"}</button>}
          </div>
        </article>;
      })}
    </div>}
    <p className="stat-note" style={{ marginTop: 15 }}>Member counts, when provided by Discord, are approximate. Bot installation is verified server-side.</p>
  </>;
}
