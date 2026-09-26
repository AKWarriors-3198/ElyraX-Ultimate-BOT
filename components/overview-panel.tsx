"use client";

import { Activity, Clock3, Gavel, Hash, Shield, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { OverviewStats } from "@/lib/bot-api";
import { navigation } from "@/lib/features";

type Guild = { id: string; name: string };
type OverviewResponse = { available: true; stats: OverviewStats } | { available: false; reason: string } | { error: string };

function format(value: number | undefined, suffix = "") {
  return value === undefined ? "—" : `${Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

export function OverviewPanel({ guild }: { guild: Guild }) {
  const [result, setResult] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/guilds/${guild.id}/overview`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as OverviewResponse;
        if (!response.ok && !("error" in data)) throw new Error("Server metrics could not be loaded.");
        return data;
      })
      .then((data) => { if (active) setResult(data); })
      .catch((error: unknown) => { if (active) setResult({ error: error instanceof Error ? error.message : "Server metrics could not be loaded." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [guild.id]);

  const stats = result && "available" in result && result.available ? result.stats : undefined;
  const status = stats?.botStatus ?? "unknown";
  const cards = [
    { label: "Members", value: format(stats?.members), Icon: Users, caption: "Live guild total" },
    { label: "Online", value: format(stats?.onlineMembers), Icon: Activity, caption: "Current presence" },
    { label: "Channels", value: format(stats?.channels), Icon: Hash, caption: "Guild channels" },
    { label: "Roles", value: format(stats?.roles), Icon: Shield, caption: "Guild roles" },
  ];
  const secondary = [
    { label: "Commands used", value: format(stats?.commandsUsed), Icon: Zap, caption: "Bot-reported total" },
    { label: "Moderation actions", value: format(stats?.moderationActions), Icon: Gavel, caption: "Bot-reported total" },
    { label: "Uptime", value: format(stats?.uptimePercent, stats?.uptimePercent === undefined ? "" : "%"), Icon: Clock3, caption: "Bot-reported availability" },
  ];
  const activity = stats?.levelActivity ?? [];
  const maximum = Math.max(1, ...activity.map((point) => point.value));
  const activeNavigation = navigation.filter((item) => item.id !== "overview");

  return <>
    <div className="dashboard-heading">
      <div><div className="eyebrow">Server overview</div><h1>{guild.name}</h1><p>Live server and bot metrics are loaded from the ELYRAX API. Values stay blank when the service does not provide data.</p></div>
      <div className={`bot-status ${status}`}><span className="status-dot"/>{status === "online" ? "Bot online" : status === "offline" ? "Bot offline" : "Bot status unavailable"}</div>
    </div>

    <div className="metric-grid">
      {cards.map(({label,value,Icon,caption})=><Metric key={label} label={label} value={value} Icon={Icon} caption={caption} loading={loading}/>)}
    </div>
    <div className="metric-grid" style={{marginTop:10}}>
      {secondary.map(({label,value,Icon,caption})=><Metric key={label} label={label} value={value} Icon={Icon} caption={caption} loading={loading}/>)}
      <div className="metric-card" style={{display:"flex",flexDirection:"column",justifyContent:"space-between"}}><div className="metric-top">Bot connection <span className="metric-icon"><Activity size={14}/></span></div><div className="metric-value" style={{fontSize:15}}>{loading ? "Checking…" : result && "available" in result && result.available ? "Connected" : "Not connected"}</div><div className="metric-caption">Private API status</div></div>
    </div>

    {result && "error" in result && <div className="auth-error" role="alert" style={{marginTop:12}}>{result.error}</div>}
    {result && "available" in result && !result.available && <div className="overview-note"><strong>Live metrics unavailable.</strong> {result.reason}</div>}

    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header"><h2>Leveling activity</h2><span>Bot API data</span></div>
        {loading ? <div className="chart-empty"><div style={{width:"45%"}}><div className="loading-line"/><div className="loading-line" style={{width:"72%",marginTop:9}}/></div></div> : activity.length ? <><div className="activity-chart" role="img" aria-label="Leveling activity supplied by the bot API">{activity.map((point,index)=><div className="activity-bar" key={`${point.label}-${index}`} title={`${point.label}: ${format(point.value)}`} style={{height:`${point.value === 0 ? 0 : Math.max(4,(point.value / maximum) * 100)}%`}}/>)}</div><div className="activity-labels"><span>{activity[0]?.label}</span><span>{activity[activity.length-1]?.label}</span></div></> : <div className="chart-empty">No leveling activity has been returned by the bot API.</div>}
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Quick configuration</h2><span>Settings</span></div>
        <div className="shortcut-list">
          {activeNavigation.slice(0, 4).map((item) => <a className="shortcut" key={item.id} href={`/dashboard/${guild.id}?view=${item.id}`}><span>{item.label}</span><span>Configure <span aria-hidden="true">→</span></span></a>)}
        </div>
        <div className="permission-card"><Shield size={14}/><span>Changes are checked against your current Discord permissions and ELYRAX installation on every API request.</span></div>
      </section>
    </div>
  </>;
}

function Metric({ label, value, Icon, caption, loading }: { label: string; value: string; Icon: LucideIcon; caption: string; loading: boolean }) {
  return <div className="metric-card"><div className="metric-top">{label}<span className="metric-icon"><Icon size={14}/></span></div>{loading ? <div className="loading-line" style={{height:23,width:"50%",marginTop:16}}/> : <div className="metric-value">{value}</div>}<div className="metric-caption">{caption}</div></div>;
}
