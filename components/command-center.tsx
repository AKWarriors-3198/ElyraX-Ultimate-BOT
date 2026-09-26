"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, Search, Terminal, TriangleAlert } from "lucide-react";

type Guild = { id: string; name: string };
type OptionType = "string" | "integer" | "number" | "boolean" | "channel" | "role" | "user";
type OptionChoice = { name: string; value: string | number | boolean };
type CommandOption = { name: string; description: string; type: OptionType; required: boolean; min?: number; max?: number; channelTypes?: number[]; choices?: OptionChoice[] };
type BotCommand = { name: string; description: string; category?: string; options: CommandOption[] };
type GuildResource = { id: string; name: string; type?: number; position?: number };
type Resources = { channels: GuildResource[]; roles: GuildResource[]; botHighestRolePosition: number };
type Notice = { text: string; error?: boolean };

function baseValue(option: CommandOption) {
  if (option.type === "boolean") return false;
  return "";
}

function convertOption(option: CommandOption, value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  if (option.type === "integer" || option.type === "number") return Number(value);
  if (option.type === "boolean") return Boolean(value);
  return String(value);
}

export function CommandCenter({ guild }: { guild: Guild }) {
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [selected, setSelected] = useState<BotCommand | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [resources, setResources] = useState<Resources>({ channels: [], roles: [], botHighestRolePosition: -1 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/guilds/${guild.id}/commands`, { cache: "no-store" });
      const data = await response.json() as { available?: boolean; commands?: BotCommand[]; reason?: string };
      if (!response.ok || !data.available || !Array.isArray(data.commands)) throw new Error(data.reason || "The bot command catalog is unavailable.");
      const sorted = [...data.commands].sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other") || a.name.localeCompare(b.name));
      setCommands(sorted);
      if (sorted.length) {
        setSelected(sorted[0]);
        setValues(Object.fromEntries(sorted[0].options.map((option) => [option.name, baseValue(option)])));
      }
      const resourceResponse = await fetch(`/api/guilds/${guild.id}/resources`, { cache: "no-store" });
      if (resourceResponse.ok) setResources(await resourceResponse.json() as Resources);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The bot command catalog is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [guild.id]);

  function choose(command: BotCommand) {
    setSelected(command);
    setValues(Object.fromEntries(command.options.map((option) => [option.name, baseValue(option)])));
    setNotice(null);
  }

  useEffect(() => { void load(); }, [load]);

  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => `${command.name} ${command.description} ${command.category || ""}`.toLowerCase().includes(normalized));
  }, [commands, query]);

  async function runCommand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || running) return;
    setRunning(true);
    setNotice(null);
    const options = Object.fromEntries(selected.options.flatMap((option) => {
      const value = convertOption(option, values[option.name]);
      return value === undefined ? [] : [[option.name, value]];
    }));
    try {
      const response = await fetch(`/api/guilds/${guild.id}/commands/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: selected.name, options }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "The bot could not run this command.");
      setNotice({ text: data.message || `/${selected.name} was sent to the bot.` });
    } catch (reason) {
      setNotice({ text: reason instanceof Error ? reason.message : "The bot could not run this command.", error: true });
    } finally {
      setRunning(false);
    }
  }

  const categories = [...new Set(visibleCommands.map((command) => command.category || "Other"))];

  return <>
    <div className="dashboard-heading"><div><div className="eyebrow">Bot command center</div><h1>Run a command.</h1><p>Choose from commands published by the connected ELYRAX bot. Discord permission checks still apply when the bot runs it.</p></div><span className="save-state saved">{commands.length} available</span></div>
    {loading ? <div className="panel"><div className="loading-line" style={{ width: "40%" }}/><div className="loading-line" style={{ width: "75%", marginTop: 18 }}/></div> : error ? <div className="access-card command-empty"><TriangleAlert size={18}/><h2>Command catalog unavailable</h2><p>{error}</p><p>The dashboard reads the command list from the bot API so it can offer every command the bot supports.</p><button className="button button-accent button-small" onClick={() => void load()}>Try again</button></div> : commands.length === 0 ? <div className="empty-state"><Terminal size={22}/><strong>No commands are published yet</strong><p>Connect the bot API and return its available command catalog for this server.</p></div> : <div className="commands-layout">
      <section className="command-catalog panel">
        <label className="search-control command-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands" aria-label="Search bot commands"/></label>
        {categories.length === 0 ? <div className="role-hierarchy-empty">No commands match that search.</div> : categories.map((category) => <div className="command-category" key={category}><div className="sidebar-section-label">{category}</div>{visibleCommands.filter((command) => (command.category || "Other") === category).map((command) => <button type="button" className={`command-item ${selected?.name === command.name ? "active" : ""}`} key={command.name} onClick={() => choose(command)}><span><strong>/{command.name}</strong><small>{command.description || "No description provided."}</small></span><ArrowRight size={13}/></button>)}</div>)}
      </section>
      {selected && <form className="command-form panel" onSubmit={(event) => void runCommand(event)}>
        <div className="panel-header"><div><div className="eyebrow">{selected.category || "Command"}</div><h2>/{selected.name}</h2></div><span className="bot-status"><Terminal size={12}/> ELYRAX</span></div>
        <p className="command-description">{selected.description || "Configure the command options, then send it to the bot."}</p>
        {selected.options.length === 0 ? <div className="role-hierarchy-empty">This command has no options. Select Run command to send it to the bot.</div> : <div className="command-options">{selected.options.map((option) => <CommandOptionField key={option.name} option={option} value={values[option.name]} resources={resources} onChange={(value) => setValues((current) => ({ ...current, [option.name]: value }))}/>)}</div>}
        {notice && <div className={`overview-note ${notice.error ? "command-error" : "command-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
        <div className="form-actions"><span className="save-state">The bot checks command permissions before execution.</span><button className="button button-accent button-small" disabled={running}>{running ? "Sending…" : <><Play size={13}/> Run command</>}</button></div>
      </form>}
    </div>}
  </>;
}

function CommandOptionField({ option, value, resources, onChange }: { option: CommandOption; value: unknown; resources: Resources; onChange: (value: unknown) => void }) {
  const id = `command-option-${option.name}`;
  const label = `${option.name}${option.required ? " *" : ""}`;
  if (option.type === "boolean") return <div className="form-field"><div className="toggle-row"><div><label htmlFor={id}>{label}</label><p className="form-description">{option.description}</p></div><input id={id} className="toggle" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/></div></div>;

  const choices = option.choices?.map((choice) => ({ label: choice.name, value: String(choice.value) })) || [];
  const resourceChoices = option.type === "channel" ? resources.channels.filter((item) => (option.channelTypes?.length ? option.channelTypes : [0, 2, 4, 5, 13, 15, 16]).includes(item.type ?? -1)).map((item) => ({ label: `${item.type === 4 ? "Category" : item.type === 2 || item.type === 13 ? "Voice" : "#"} ${item.name}`, value: item.id })) : option.type === "role" ? resources.roles.filter((role) => (role.position ?? -1) < resources.botHighestRolePosition).map((item) => ({ label: `@ ${item.name}`, value: item.id })) : [];
  const selectChoices = choices.length ? choices : resourceChoices;
  return <div className="form-field"><label htmlFor={id}>{label}</label>{option.description && <p className="form-description">{option.description}</p>}{selectChoices.length ? <select id={id} className="select" required={option.required} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Choose an option</option>{selectChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : <input id={id} className="input" required={option.required} type={option.type === "integer" || option.type === "number" ? "number" : "text"} min={option.min} max={option.max} step={option.type === "integer" ? 1 : "any"} value={String(value ?? "")} placeholder={option.type === "user" || option.type === "channel" || option.type === "role" ? "Discord ID" : "Enter a value"} onChange={(event) => onChange(option.type === "integer" || option.type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)}/>}</div>;
}
