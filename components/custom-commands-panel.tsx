"use client";

import { useCallback, useEffect, useState } from "react";
import { Code2, Plus, Save, Trash2 } from "lucide-react";
import { EmbedFieldsEditor } from "@/components/embed-fields-editor";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

type Guild = { id: string; name: string };
type EmbedField = { name: string; value: string; inline: boolean };
type CustomCommand = { id: string; name: string; description: string; response: string; embedEnabled: boolean; embedTitle: string; embedDescription: string; embedColor: string; embedFields: EmbedField[] };
type Notice = { text: string; error?: boolean };

function makeNewCommand(): CustomCommand {
  return { id: crypto.randomUUID(), name: "welcome", description: "A helpful custom command", response: "Hello {user}, welcome to {server}!", embedEnabled: false, embedTitle: "", embedDescription: "", embedColor: "#FFFFFF", embedFields: [] };
}

function renderVariables(value: string, guild: Guild) {
  return value.replaceAll("{user}", "@Sample Member").replaceAll("{username}", "Sample Member").replaceAll("{server}", guild.name).replaceAll("{membercount}", "sample");
}

export function CustomCommandsPanel({ guild }: { guild: Guild }) {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [editing, setEditing] = useState<CustomCommand | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCommand | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/commands/custom`, { cache: "no-store" });
      const data = await response.json() as { commands?: CustomCommand[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load custom commands.");
      const loaded = Array.isArray(data.commands) ? data.commands.map((command) => ({ ...command, embedFields: Array.isArray(command.embedFields) ? command.embedFields : [] })) : [];
      setCommands(loaded);
      setEditing(loaded[0] ? { ...loaded[0], embedFields: Array.isArray(loaded[0].embedFields) ? loaded[0].embedFields : [] } : null);
      setOriginalId(loaded[0]?.id ?? null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not load custom commands.", error: true });
    } finally {
      setLoading(false);
    }
  }, [guild.id]);

  useEffect(() => { void load(); }, [load]);

  function beginNew() {
    setEditing(makeNewCommand());
    setOriginalId(null);
    setNotice(null);
  }

  function editCommand(command: CustomCommand) {
    setEditing({ ...command, embedFields: Array.isArray(command.embedFields) ? command.embedFields.map((field) => ({ ...field })) : [] });
    setOriginalId(command.id);
    setNotice(null);
  }

  function change<K extends keyof CustomCommand>(key: K, value: CustomCommand[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function persist(next: CustomCommand[], successCommandId?: string): Promise<boolean> {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/commands/custom`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commands: next }) });
      const data = await response.json() as { commands?: CustomCommand[]; sync?: { status: string; message: string }; error?: string };
      if (!response.ok || !Array.isArray(data.commands)) throw new Error(data.error || "Could not save custom commands.");
      setCommands(data.commands);
      if (successCommandId) {
        const saved = data.commands.find((command) => command.id === successCommandId) || null;
        setEditing(saved);
        setOriginalId(saved?.id ?? null);
      } else {
        setEditing(data.commands[0] ?? null);
        setOriginalId(data.commands[0]?.id ?? null);
      }
      const syncError = data.sync?.status === "error";
      setNotice({ text: data.sync?.message || "Custom commands saved.", error: syncError });
      return true;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not save custom commands.", error: true });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const normalized = editing.name.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(normalized)) {
      setNotice({ text: "Use a command name starting with a letter, followed by letters, numbers, _ or -.", error: true });
      return;
    }
    if (!editing.response.trim() && (!editing.embedEnabled || (!editing.embedTitle.trim() && !editing.embedDescription.trim()))) {
      setNotice({ text: "Add a text response or enable an embed with a title or description.", error: true });
      return;
    }
    const command = { ...editing, name: normalized };
    const next = originalId ? commands.map((item) => item.id === originalId ? command : item) : [...commands, command];
    await persist(next, command.id);
  }

  async function remove(command: CustomCommand) {
    const next = commands.filter((item) => item.id !== command.id);
    if (await persist(next)) setDeleteTarget(null);
  }

  const previewTitle = editing ? renderVariables(editing.embedTitle, guild) : "";
  const previewDescription = editing ? renderVariables(editing.embedDescription, guild) : "";

  return <>
    <div className="dashboard-heading"><div><div className="eyebrow">Bot command builder</div><h1>Custom commands.</h1><p>Create slash commands that respond with text or a rich embed. Saved commands sync to the connected ELYRAX bot.</p></div><span className="save-state saved">{commands.length} / 50 created</span></div>
    {notice && <div className={`overview-note ${notice.error ? "command-error" : "command-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
    {loading ? <div className="panel"><div className="loading-line" style={{ width: "40%" }}/><div className="loading-line" style={{ width: "70%", marginTop: 18 }}/></div> : <div className="custom-command-layout">
      <aside className="custom-command-list panel"><div className="panel-header"><h2>Your commands</h2><button type="button" className="icon-button" aria-label="Create a custom command" title="Create a custom command" disabled={commands.length >= 50} onClick={beginNew}><Plus size={15}/></button></div>
        {commands.length === 0 ? <div className="role-hierarchy-empty">Your custom commands appear here after you save them.</div> : commands.map((command) => <div className={`custom-command-row ${editing?.id === command.id ? "active" : ""}`} key={command.id}><button type="button" className="custom-command-pick" onClick={() => editCommand(command)}><strong>/{command.name}</strong><span>{command.description || "No description"}</span></button><button type="button" className="icon-button custom-command-delete" aria-label={`Delete /${command.name}`} title="Delete command" onClick={() => setDeleteTarget(command)}><Trash2 size={13}/></button></div>)}
      </aside>
      {!editing ? <div className="empty-state custom-command-empty"><Code2 size={22}/><strong>Start with your first command</strong><p>Add a short response, a rich embed or both. Placeholders are rendered by the bot when members use the command.</p><button type="button" className="button button-accent button-small" onClick={beginNew}><Plus size={13}/> Create command</button></div> : <div className="custom-command-editor">
        <form className="feature-form panel" onSubmit={(event) => void save(event)}>
          <div className="feature-form-top"><strong>Command setup</strong><span>/{editing.name || "command"}</span></div>
          <div className="feature-fields">
            <div className="form-field"><label htmlFor="custom-command-name">Command name</label><input id="custom-command-name" className="input" value={editing.name} maxLength={32} pattern="[A-Za-z][A-Za-z0-9_-]{0,31}" required onChange={(event) => change("name", event.target.value)}/></div>
            <div className="form-field"><label htmlFor="custom-command-description">Description</label><input id="custom-command-description" className="input" value={editing.description} maxLength={100} required onChange={(event) => change("description", event.target.value)}/><div className="character-count">{editing.description.length} / 100</div></div>
            <div className="form-field full"><label htmlFor="custom-command-response">Text response</label><p className="form-description">Variables: {`{user}`}, {`{username}`}, {`{server}`}, {`{membercount}`}</p><textarea id="custom-command-response" className="textarea" rows={4} value={editing.response} maxLength={2000} placeholder="Welcome {user} to {server}!" onChange={(event) => change("response", event.target.value)}/><div className="character-count">{editing.response.length} / 2000</div></div>
            <div className="form-field full"><div className="toggle-row"><div><label htmlFor="custom-command-embed">Include a rich embed</label><p className="form-description">The text response and embed can be used together.</p></div><input id="custom-command-embed" className="toggle" type="checkbox" checked={editing.embedEnabled} onChange={(event) => change("embedEnabled", event.target.checked)}/></div></div>
            {editing.embedEnabled && <><div className="form-field"><label htmlFor="custom-embed-title">Embed title</label><input id="custom-embed-title" className="input" value={editing.embedTitle} maxLength={256} onChange={(event) => change("embedTitle", event.target.value)}/></div><div className="form-field"><label htmlFor="custom-embed-color">Embed color</label><div className="color-row"><input id="custom-embed-color" type="color" value={/^#[0-9a-f]{6}$/i.test(editing.embedColor) ? editing.embedColor : "#FFFFFF"} onChange={(event) => change("embedColor", event.target.value)}/><input className="input" value={editing.embedColor} maxLength={7} onChange={(event) => change("embedColor", event.target.value)}/></div></div><div className="form-field full"><label htmlFor="custom-embed-description">Embed description</label><textarea id="custom-embed-description" className="textarea" rows={4} value={editing.embedDescription} maxLength={4096} onChange={(event) => change("embedDescription", event.target.value)}/><div className="character-count">{editing.embedDescription.length} / 4096</div></div><EmbedFieldsEditor id="custom-embed-fields" label="Embed fields" value={editing.embedFields} onChange={(value) => change("embedFields", value)}/></>}
          </div>
          <div className="form-actions"><span className="save-state">{originalId ? "Editing saved command" : "New command"}</span><button className="button button-accent button-small" disabled={saving || commands.length >= 50 && !originalId}><Save size={13}/>{saving ? "Saving…" : "Save command"}</button></div>
        </form>
        <aside className="side-card custom-command-preview"><h3>Live preview</h3><p>Example output using this server name and sample member details.</p>
          {editing.response && <div className="welcome-preview-message">{renderVariables(editing.response, guild)}</div>}
          {editing.embedEnabled && <div className="preview-embed welcome-preview-embed" style={{ borderLeftColor: /^#[0-9a-f]{6}$/i.test(editing.embedColor) ? editing.embedColor : "#FFFFFF" }}>
            {previewTitle && <div className="preview-embed-title welcome-preview-title">{previewTitle}</div>}{previewDescription && <div className="preview-embed-text">{previewDescription}</div>}
            {editing.embedFields.length > 0 && <div className="welcome-preview-fields">{editing.embedFields.slice(0, 25).map((field, index) => <div className={field.inline ? "inline" : ""} key={`${index}-${field.name}`}><strong>{renderVariables(field.name, guild)}</strong><span>{renderVariables(field.value, guild)}</span></div>)}</div>}
          </div>}
        </aside>
      </div>}
    </div>}
    {deleteTarget && <ConfirmationDialog title={`Delete /${deleteTarget.name}?`} description="This removes the command from this server's dashboard configuration and asks the bot API to sync the updated list." confirmLabel="Delete command" pending={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove(deleteTarget)}/>}
  </>;
}
