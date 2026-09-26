"use client";

import { AlertTriangle, Info, RotateCcw, Save, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getFeature, type FeatureField } from "@/lib/features";
import { EmbedFieldsEditor } from "@/components/embed-fields-editor";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

type Guild = { id: string; name: string };
type User = { id: string; username: string; global_name: string | null };
type Config = Record<string, unknown>;
type ResourceData = {
  channels: Array<{ id: string; name: string; type: number }>;
  roles: Array<{ id: string; name: string; color: number; position: number; icon: string | null }>;
  botHighestRolePosition: number;
};
type Toast = { message: string; error?: boolean };

function valueText(value: unknown) { return typeof value === "string" ? value : ""; }
function validImageUrl(value: string) { return /^https?:\/\//i.test(value) ? value : ""; }

export function FeaturePanel({ guild, user, module }: { guild: Guild; user: User; module: string }) {
  const router = useRouter();
  const definition = getFeature(module);
  const [config, setConfig] = useState<Config>(() => ({ ...definition.defaults }));
  const [saved, setSaved] = useState<Config>(() => ({ ...definition.defaults }));
  const [resources, setResources] = useState<ResourceData>({ channels: [], roles: [], botHighestRolePosition: -1 });
  const [resourceError, setResourceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWelcome, setTestingWelcome] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const appliedTemplateRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{ kind: "feature" | "guild" | "leave"; href?: string } | null>(null);
  const [resettingGuild, setResettingGuild] = useState(false);
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(saved), [config, saved]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const settingsUrl = `/api/guilds/${guild.id}/settings/${module}`;
    const resourcesUrl = `/api/guilds/${guild.id}/resources`;
    const [settingsResult, resourcesResult] = await Promise.allSettled([
      fetch(settingsUrl, { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { config?: Config; updatedAt?: number | null; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load this feature.");
        return data;
      }),
      fetch(resourcesUrl, { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as ResourceData & { error?: string };
        if (!response.ok) throw new Error(data.error || "Channels and roles are unavailable.");
        return data;
      }),
    ]);

    if (settingsResult.status === "fulfilled") {
      const merged = { ...definition.defaults, ...settingsResult.value.config };
      setConfig(merged);
      setSaved(merged);
      setUpdatedAt(typeof settingsResult.value.updatedAt === "number" ? settingsResult.value.updatedAt : null);
    } else {
      setLoadError(settingsResult.reason instanceof Error ? settingsResult.reason.message : "Could not load this feature.");
    }
    if (resourcesResult.status === "fulfilled") {
      setResources({ channels: resourcesResult.value.channels, roles: resourcesResult.value.roles, botHighestRolePosition: resourcesResult.value.botHighestRolePosition });
      setResourceError("");
    } else {
      setResourceError(resourcesResult.reason instanceof Error ? resourcesResult.reason.message : "Channel and role options could not be loaded.");
    }
    setLoading(false);
  }, [definition, guild.id, module]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const interceptDashboardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || !destination.pathname.startsWith("/dashboard")) return;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;
      event.preventDefault();
      setConfirmation({ kind: "leave", href: next });
    };
    document.addEventListener("click", interceptDashboardNavigation, true);
    return () => document.removeEventListener("click", interceptDashboardNavigation, true);
  }, [dirty]);
  useEffect(() => {
    if (loading || loadError || module !== "welcome" || appliedTemplateRef.current) return;
    const url = new URL(window.location.href);
    const templateId = url.searchParams.get("template");
    if (!templateId) return;
    appliedTemplateRef.current = true;
    url.searchParams.delete("template");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    void (async () => {
      try {
        const response = await fetch(`/api/guilds/${guild.id}/embeds`, { cache: "no-store" });
        const data = await response.json() as { embeds?: Array<{ id: string; name: string; document: Record<string, unknown> }>; error?: string };
        if (!response.ok || !Array.isArray(data.embeds)) throw new Error(data.error || "Embed templates are unavailable.");
        const template = data.embeds.find((item) => item.id === templateId);
        if (!template) throw new Error("That embed template is no longer available for this server.");
        const document = template.document;
        setConfig((current) => ({
          ...current,
          embedEnabled: true,
          embedAuthorName: document.authorName ?? "",
          embedAuthorIconUrl: document.authorIconUrl ?? "",
          embedTitle: document.title ?? "",
          embedTitleUrl: document.titleUrl ?? "",
          embedDescription: document.description ?? "",
          embedColor: document.color ?? "#FFFFFF",
          embedFields: document.fields ?? [],
          thumbnailUrl: document.thumbnailUrl ?? "",
          imageUrl: document.imageUrl ?? "",
          footer: document.footer ?? "",
          footerIconUrl: document.footerIconUrl ?? "",
          timestampEnabled: document.timestampEnabled ?? false,
        }));
        setToast({ message: `“${template.name}” added to the welcome draft. Save changes to apply it.` });
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : "Could not apply this embed.", error: true });
      }
    })();
  }, [guild.id, loadError, loading, module]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function change(key: string, value: unknown) { setConfig((current) => ({ ...current, [key]: value })); }

  async function save() {
    if (saving || loading || !dirty) return;
    setSaving(true);
    setToast(null);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/settings/${module}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json() as { config?: Config; updatedAt?: number; sync?: { status: string; message: string }; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save these settings.");
      const next = data.config ?? config;
      setConfig(next);
      setSaved(next);
      setUpdatedAt(typeof data.updatedAt === "number" ? data.updatedAt : Date.now());
      setToast({ message: data.sync?.message || "Settings saved in the dashboard.", error: data.sync?.status === "error" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Could not save these settings.", error: true });
    } finally {
      setSaving(false);
    }
  }

  function resetFeature() {
    const defaults = { ...definition.defaults };
    setConfig(defaults);
    setToast({ message: "Default values loaded. Save changes to apply them." });
    setConfirmation(null);
  }

  async function resetGuild() {
    setResettingGuild(true);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/settings`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not reset server settings.");
      setConfig({ ...definition.defaults });
      setSaved({ ...definition.defaults });
      setUpdatedAt(null);
      setToast({ message: "All dashboard settings for this server were reset." });
      setConfirmation(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Could not reset server settings.", error: true });
    } finally {
      setResettingGuild(false);
    }
  }

  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "feature") { resetFeature(); return; }
    if (confirmation.kind === "guild") { void resetGuild(); return; }
    const href = confirmation.href;
    setConfirmation(null);
    if (href) router.push(href);
  }

  async function testWelcome() {
    if (dirty || !updatedAt || testingWelcome) {
      setToast({ message: dirty ? "Save the current welcome design before testing it." : "Save your welcome settings before sending a test.", error: true });
      return;
    }
    setTestingWelcome(true);
    setToast(null);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/settings/welcome/test`, { method: "POST" });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not send the welcome test.");
      setToast({ message: data.message || "Welcome test sent to Discord." });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Could not send the welcome test.", error: true });
    } finally {
      setTestingWelcome(false);
    }
  }

  if (loading) return <>
    <div className="dashboard-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.title}</h1><div className="loading-line" style={{width:320,marginTop:12}}/></div></div>
    <div className="panel" style={{minHeight:360}}><div className="loading-line" style={{width:"38%"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:28}}>{Array.from({length:8},(_,index)=><div key={index}><div className="loading-line" style={{width:"55%"}}/><div className="loading-line" style={{height:38,marginTop:10}}/></div>)}</div></div>
  </>;

  if (loadError) return <>
    <div className="dashboard-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.title}</h1></div></div>
    <div className="access-card"><TriangleAlert size={19} color="#c2c2c5"/><h1>Settings could not be loaded.</h1><p>{loadError}</p><div className="access-card-actions"><button className="button button-accent" onClick={() => void load()}>Try again</button><a className="button button-secondary" href={`/dashboard/${guild.id}`}>Back to overview</a></div></div>
  </>;

  return <>
    <div className="dashboard-heading">
      <div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.title}</h1><p>{definition.description}</p></div>
      <span className={`save-state ${dirty ? "dirty" : "saved"}`}><span className="status-dot" style={{background:dirty?"#c2c2c5":"#e4e4e6"}}/>{dirty ? "Unsaved changes" : updatedAt ? `Saved ${new Date(updatedAt).toLocaleString()}` : "No changes saved yet"}</span>
    </div>
    <div className="feature-layout">
      <section className="feature-form">
        <div className="feature-form-top"><strong style={{fontSize:12}}>Configuration</strong><span>{resources.channels.length ? `${resources.channels.length} channels · ${resources.roles.length} roles` : "Server resources"}</span></div>
        {resourceError && <div className="overview-note" style={{margin:"14px 17px 0"}}>Discord channel and role lists are unavailable. {resourceError} You can enter IDs directly where a selector is unavailable.</div>}
        <div className="feature-fields">
          {definition.fields.map((field) => <Field key={field.key} field={field} value={config[field.key]} onChange={(value) => change(field.key,value)} resources={resources}/>) }
        </div>
        <div className="form-actions">
          <div className={`save-state ${dirty ? "dirty" : ""}`}><span className="status-dot" style={{background:dirty?"#c2c2c5":"#72747e",boxShadow:"none"}}/>{dirty ? "Review before saving" : "All changes saved"}</div>
          <div className="form-action-group"><button className="button button-secondary button-small" onClick={() => setConfirmation({ kind: "feature" })} disabled={!dirty}><RotateCcw size={13}/> Reset</button><button className="button button-accent button-small" onClick={() => void save()} disabled={!dirty || saving}><Save size={13}/>{saving ? "Saving…" : "Save changes"}</button></div>
        </div>
      </section>
      <aside className="feature-aside">
        <PreviewCard module={module} config={config} guild={guild} user={user} onTestWelcome={module === "welcome" ? () => void testWelcome() : undefined} testWelcomeDisabled={dirty || !updatedAt || testingWelcome} testingWelcome={testingWelcome}/>
        {module === "roles" && <RoleHierarchyCard guildId={guild.id} resources={resources}/>}
        <div className="side-card"><h3>Permissions & integration</h3><p>{definition.integration}</p><div className="permission-card"><ShieldCheck size={13}/><span>You need Manage Server or Administrator. ELYRAX must be installed and have the requested channel or role permissions.</span></div></div>
        {module === "settings" && <div className="side-card danger-card"><h3>Danger zone</h3><p>Reset every ELYRAX dashboard setting stored for this server. This does not remove the bot from Discord.</p><button className="button button-danger button-small" style={{marginTop:14}} onClick={() => setConfirmation({ kind: "guild" })}><AlertTriangle size={13}/> Reset server configuration</button></div>}
      </aside>
    </div>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.message}</div>}
    {confirmation?.kind === "feature" && <ConfirmationDialog title={`Reset ${definition.title} settings?`} description="This loads the default values into the editor. They do not take effect until you save." confirmLabel="Load defaults" onCancel={() => setConfirmation(null)} onConfirm={confirmAction}/>}
    {confirmation?.kind === "guild" && <ConfirmationDialog title={`Reset all settings for ${guild.name}?`} description="This permanently removes every saved ELYRAX dashboard setting for this server. The bot keeps its current behavior until new settings are saved." confirmLabel="Reset server" requiredText="RESET" pending={resettingGuild} onCancel={() => setConfirmation(null)} onConfirm={confirmAction}/>}
    {confirmation?.kind === "leave" && <ConfirmationDialog title="Unsaved changes" description="You have changes that have not been saved. Leave this page and discard them?" confirmLabel="Leave page" onCancel={() => setConfirmation(null)} onConfirm={confirmAction}/>}
  </>;
}

function RoleHierarchyCard({ guildId, resources }: { guildId: string; resources: ResourceData }) {
  const roles = [...resources.roles].sort((a, b) => b.position - a.position).slice(0, 8);
  return <div className="side-card role-hierarchy-card">
    <h3>Role hierarchy</h3>
    <p>ELYRAX can assign roles below its highest role. Move its role above roles you want it to manage.</p>
    <div className="role-hierarchy-top"><span className="role-position-mark">E</span><span><strong>ELYRAX</strong><small>Highest position {resources.botHighestRolePosition < 0 ? "unavailable" : resources.botHighestRolePosition}</small></span><ShieldCheck size={14}/></div>
    {roles.length ? <div className="role-hierarchy-list">{roles.map((role) => {
      const assignable = resources.botHighestRolePosition >= 0 && role.position < resources.botHighestRolePosition;
      const color = `#${Math.max(0, role.color).toString(16).padStart(6, "0").slice(-6)}`;
      const icon = role.icon ? `https://cdn.discordapp.com/role-icons/${guildId}/${role.icon}.png?size=48` : "";
      return <div className={`role-hierarchy-item ${assignable ? "assignable" : "above-bot"}`} key={role.id}>
        {icon ? <img className="role-icon" src={icon} alt="" loading="lazy"/> : <span className="role-color-swatch" style={{ backgroundColor: color }}/>}<span className="role-name" title={role.name}>{role.name}</span><span className="role-position">{role.position}</span>
      </div>;
    })}</div> : <div className="role-hierarchy-empty">{resources.botHighestRolePosition < 0 ? "Role order will appear when Discord roles are available." : "No assignable roles were returned by Discord."}</div>}
    {resources.roles.length > 8 && <p className="role-hierarchy-footnote">Showing the 8 highest roles · selectors include every assignable role.</p>}
  </div>;
}

function Field({ field, value, onChange, resources }: { field: FeatureField; value: unknown; onChange: (value: unknown) => void; resources: ResourceData }) {
  const stringValue = valueText(value);
  const full = field.type === "textarea" || field.type === "roles";
  const id = `setting-${field.key}`;
  const description = field.description ? <p className="form-description">{field.description}</p> : null;

  if (field.type === "toggle") return <div className="form-field"><div className="toggle-row"><div className="toggle-copy"><label htmlFor={id}>{field.label}</label>{description}</div><input id={id} className="toggle" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/></div></div>;
  if (field.type === "textarea") return <div className={`form-field ${full ? "full" : ""}`}><label htmlFor={id}>{field.label}</label>{description}<textarea id={id} className="textarea" value={stringValue} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)} rows={4}/>{field.maxLength && <div className="character-count">{stringValue.length} / {field.maxLength}</div>}</div>;
  if (field.type === "number") return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<input id={id} className="input" type="number" min={field.min} max={field.max} step={1} value={typeof value === "number" ? value : 0} onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}/></div>;
  if (field.type === "color") return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<div className="color-row"><input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(stringValue) ? stringValue : "#FFFFFF"} onChange={(event) => onChange(event.target.value)}/><input className="input" value={stringValue} onChange={(event) => onChange(event.target.value)} maxLength={7} aria-label={`${field.label} hex value`}/></div></div>;
  if (field.type === "url") return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<input id={id} className="input" type="url" value={stringValue} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)}/></div>;
  if (field.type === "embed-fields") return <EmbedFieldsEditor id={id} label={field.label} description={field.description} value={value} onChange={onChange}/>;
  if (field.type === "channel" || field.type === "role") {
    const options = field.type === "channel"
      ? resources.channels.filter((item) => (field.channelTypes ?? [0, 5, 15]).includes(item.type)).map((item) => ({ label: `${item.type === 4 ? "Category" : item.type === 2 || item.type === 13 ? "Voice" : "#"} ${item.name}`, value: item.id }))
      : resources.roles.filter((item) => item.position < resources.botHighestRolePosition).map((item) => ({ label: `${item.name} · position ${item.position}`, value: item.id }));
    if (options.length === 0) return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<input id={id} className="input" value={stringValue} placeholder={field.type === "channel" ? "Paste a Discord channel ID" : "Paste a Discord role ID"} onChange={(event) => onChange(event.target.value)}/></div>;
    const isKnown = options.some((option) => option.value === stringValue);
    return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<select id={id} className="select" value={stringValue} onChange={(event) => onChange(event.target.value)}><option value="">Choose {field.type === "channel" ? "a channel" : "a role"}</option>{!isKnown && stringValue && <option value={stringValue}>Current selection ({stringValue})</option>}{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
  }
  if (field.type === "roles") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const assignableRoles = resources.roles.filter((role) => role.position < resources.botHighestRolePosition);
    return <div className={`form-field ${full ? "full" : ""}`}><label htmlFor={id}>{field.label}</label>{description}{assignableRoles.length ? <select id={id} className="select multi-select" multiple value={selected} onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}>{assignableRoles.map((role)=><option key={role.id} value={role.id}>{role.name} · position {role.position}</option>)}</select> : <textarea id={id} className="textarea" value={selected.join("\n")} placeholder="One Discord role ID per line" onChange={(event) => onChange(event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))}/>}</div>;
  }
  if (field.type === "select") {
    const options = field.options ?? [];
    return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<select id={id} className="select" value={stringValue} onChange={(event) => onChange(event.target.value)}>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
  }
  return <div className="form-field"><label htmlFor={id}>{field.label}</label>{description}<input id={id} className="input" value={stringValue} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)}/>{field.maxLength && <div className="character-count">{stringValue.length} / {field.maxLength}</div>}</div>;
}

function PreviewCard({ module, config, guild, user, onTestWelcome, testWelcomeDisabled, testingWelcome }: { module: string; config: Config; guild: Guild; user: User; onTestWelcome?: () => void; testWelcomeDisabled?: boolean; testingWelcome?: boolean }) {
  if (module === "welcome") return <WelcomePreview config={config} guild={guild} user={user} onTestWelcome={onTestWelcome} testWelcomeDisabled={testWelcomeDisabled} testingWelcome={testingWelcome}/>;
  if (module === "joindm") {
    const name = user.global_name || user.username;
    const rawMessage = valueText(config.message);
    const message = rawMessage.replaceAll("{user}", `@${name}`).replaceAll("{username}", name).replaceAll("{server}", guild.name).replaceAll("{membercount}", "—").replaceAll("{userid}", user.id);
    const title = valueText(config.title);
    const description = message;
    const color = valueText(config.embedColor);
    const footer = valueText(config.footer);
    const thumbnail = validImageUrl(valueText(config.thumbnailUrl));
    const image = validImageUrl(valueText(config.imageUrl));
    return <div className="side-card"><h3>Live preview</h3><p>Preview uses your current Discord account and server name. Member count is shown as unavailable here.</p><div className="preview-embed" style={{borderLeftColor:/^#[0-9a-f]{6}$/i.test(color)?color:"#f1f1f2"}}>{title && <div className="preview-embed-title">{title}</div>}<div className="preview-embed-text">{description}</div>{thumbnail && <img src={thumbnail} alt="Configured thumbnail preview" style={{maxWidth:90,maxHeight:90,marginTop:10,borderRadius:7}}/>}{image && <img src={image} alt="Configured image preview" style={{width:"100%",maxHeight:120,marginTop:10,borderRadius:7,objectFit:"cover"}}/>}{footer && <div className="preview-footer">{footer}</div>}</div></div>;
  }
  if (module === "tickets") return <div className="side-card"><h3>Ticket preview</h3><p>Based on the current text settings. Channel creation remains a bot action.</p><div className="preview-embed"><div className="preview-embed-title">{guild.name} · support</div><div className="preview-embed-text">{valueText(config.welcomeMessage) || "Your opening message will appear here."}</div><div className="preview-footer">Channel: {valueText(config.channelNameTemplate) || "ticket-{username}"}</div><div className="preview-footer">Open ticket limit: {String(config.ticketLimit ?? "—")}</div></div></div>;
  if (module === "antinuke") {
    const rules = ["massBanEnabled", "massKickEnabled", "channelDeleteEnabled", "roleDeleteEnabled", "webhookDeleteEnabled", "botAddEnabled"];
    const active = rules.filter((key) => Boolean(config[key])).length;
    return <div className="side-card"><h3>Security status</h3><div className="permission-card" style={{marginTop:0}}><span className="status-dot" style={{background:config.enabled?"#e4e4e6":"#c2c2c5"}}/><span>{config.enabled ? `Protection enabled · ${active} rule${active === 1 ? "" : "s"} active` : "Protection is currently disabled"}</span></div><p style={{marginTop:12}}>Default punishment: <strong style={{color:"#ddd"}}>{valueText(config.punishment) || "—"}</strong></p><p style={{marginTop:5}}>Whitelist IDs are stored only in this server&apos;s configuration.</p></div>;
  }
  if (module === "leveling") return <div className="side-card"><h3>XP progression model</h3><p>Configured message XP range · {String(config.xpMin ?? 0)}–{String(config.xpMax ?? 0)} XP, with a {String(config.cooldownSeconds ?? 0)} second cooldown.</p><div className="feature-preview-bar"><span style={{width:`${Math.min(100,Math.max(4,Number(config.xpMax||0)/10))}%`}}/></div><p style={{marginTop:9,color:"#777982"}}>Illustrative rule preview, not member progress.</p></div>;
  if (module === "logging") {
    const selected = Object.entries(config).filter(([key,value]) => key.endsWith("ChannelId") && typeof value === "string" && value.length > 0).length;
    return <div className="side-card"><h3>Logging coverage</h3><p>{config.enabled ? `${selected} event categories have a channel selected.` : "Logging is currently disabled."}</p><div className="permission-card"><Info size={13}/><span>Channel access is checked by Discord when the bot sends an event.</span></div></div>;
  }
  if (module === "settings") return <div className="side-card"><h3>Configuration status</h3><p>Prefix: <strong style={{color:"#ddd"}}>{valueText(config.prefix) || "—"}</strong></p><p style={{marginTop:7}}>Language: <strong style={{color:"#ddd"}}>{valueText(config.language) || "—"}</strong></p><p style={{marginTop:7}}>Timezone: <strong style={{color:"#ddd"}}>{valueText(config.timezone) || "—"}</strong></p></div>;
  return <div className="side-card"><h3>Configuration preview</h3><p>Feature settings are saved per server and sent to the bot API when that integration is configured.</p><div className="preview-embed"><div className="preview-embed-title">{String(config.enabled ? "Enabled" : "Disabled")}</div><div className="preview-embed-text">Review permissions and selected channels before turning this feature on.</div></div></div>;
}

function replaceWelcomeVariables(value: string, guild: Guild, user: User) {
  const name = user.global_name || user.username;
  return value.replaceAll("{mention}", `@${name}`).replaceAll("{user}", `@${name}`).replaceAll("{username}", name).replaceAll("{server}", guild.name).replaceAll("{membercount}", "sample").replaceAll("{userid}", user.id);
}

function WelcomePreview({ config, guild, user, onTestWelcome, testWelcomeDisabled, testingWelcome }: { config: Config; guild: Guild; user: User; onTestWelcome?: () => void; testWelcomeDisabled?: boolean; testingWelcome?: boolean }) {
  const color = valueText(config.embedColor);
  const message = replaceWelcomeVariables(valueText(config.message), guild, user);
  const author = replaceWelcomeVariables(valueText(config.embedAuthorName), guild, user);
  const title = replaceWelcomeVariables(valueText(config.embedTitle), guild, user);
  const description = replaceWelcomeVariables(valueText(config.embedDescription), guild, user);
  const footer = replaceWelcomeVariables(valueText(config.footer), guild, user);
  const authorUrl = validImageUrl(valueText(config.embedAuthorUrl));
  const authorIcon = validImageUrl(valueText(config.embedAuthorIconUrl));
  const titleUrl = validImageUrl(valueText(config.embedTitleUrl));
  const thumbnail = validImageUrl(valueText(config.thumbnailUrl));
  const image = validImageUrl(valueText(config.imageUrl));
  const footerIcon = validImageUrl(valueText(config.footerIconUrl));
  const fields = Array.isArray(config.embedFields)
    ? config.embedFields.filter((field): field is { name: string; value: string; inline?: boolean } => Boolean(field) && typeof field === "object" && typeof (field as { name?: unknown }).name === "string" && typeof (field as { value?: unknown }).value === "string").slice(0, 25)
    : [];
  const embedEnabled = config.embedEnabled !== false;

  return <div className="side-card"><h3>Live Discord preview</h3><p>Preview updates as you type. Sample account values stand in for a new member.</p>
    {message && <div className="welcome-preview-message">{message}</div>}
    {embedEnabled && <div className="preview-embed welcome-preview-embed" style={{ borderLeftColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "#f1f1f2" }}>
      {author && <div className="welcome-preview-author">{authorIcon && <img src={authorIcon} alt=""/>}{authorUrl ? <a href={authorUrl} target="_blank" rel="noreferrer">{author}</a> : <span>{author}</span>}</div>}
      {thumbnail && <img className="welcome-preview-thumbnail" src={thumbnail} alt="Embed thumbnail"/>}
      {title && (titleUrl ? <a className="preview-embed-title welcome-preview-title" href={titleUrl} target="_blank" rel="noreferrer">{title}</a> : <div className="preview-embed-title welcome-preview-title">{title}</div>)}
      {description && <div className="preview-embed-text">{description}</div>}
      {fields.length > 0 && <div className="welcome-preview-fields">{fields.map((field, index) => <div className={field.inline ? "inline" : ""} key={`${index}-${field.name}`}><strong>{replaceWelcomeVariables(field.name, guild, user)}</strong><span>{replaceWelcomeVariables(field.value, guild, user)}</span></div>)}</div>}
      {image && <img className="welcome-preview-image" src={image} alt="Embed image"/>}
      {(footer || footerIcon || Boolean(config.timestampEnabled)) && <div className="welcome-preview-footer">{footerIcon && <img src={footerIcon} alt=""/>}{footer && <span>{footer}</span>}{Boolean(config.timestampEnabled) && <span className="welcome-preview-time">Today at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}</div>}
    </div>}
    {!message && !embedEnabled && <div className="role-hierarchy-empty">Add a message or turn on the rich embed to start your welcome.</div>}
    <div className="welcome-preview-sample">For: {user.global_name || user.username} · {guild.name}</div>
    <button type="button" className="button button-secondary button-small welcome-test-button" onClick={onTestWelcome} disabled={testWelcomeDisabled || !onTestWelcome}><Send size={12}/>{testingWelcome ? "Sending test…" : "Send test to Discord"}</button>
  </div>;
}
