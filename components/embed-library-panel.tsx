"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Layers, Plus, Save, Search, Trash2, TriangleAlert } from "lucide-react";
import { EmbedFieldsEditor } from "@/components/embed-fields-editor";
import type { EmbedDocument } from "@/lib/db";

type Guild = { id: string; name: string };
type EmbedTemplate = { id: string; name: string; document: EmbedDocument; createdAt: number; updatedAt: number };
type Notice = { text: string; error?: boolean };

function blankDocument(): EmbedDocument {
  return { content: "", authorName: "", authorIconUrl: "", title: "New embed", titleUrl: "", description: "", color: "#FFFFFF", thumbnailUrl: "", imageUrl: "", footer: "", footerIconUrl: "", timestampEnabled: false, fields: [] };
}

function blankDraft() { return { name: "New embed", document: blankDocument() }; }

function sample(value: string, guild: Guild) {
  return value
    .replaceAll("{user}", "@Alex Morgan")
    .replaceAll("{username}", "alexmorgan")
    .replaceAll("{displayname}", "Alex Morgan")
    .replaceAll("{user.id}", "123456789012345678")
    .replaceAll("{server}", guild.name)
    .replaceAll("{server.name}", guild.name)
    .replaceAll("{server.id}", guild.id)
    .replaceAll("{member.count}", "1,284")
    .replaceAll("{channel.name}", "general")
    .replaceAll("{channel}", "#general");
}

function normalizeTemplate(template: EmbedTemplate): EmbedTemplate {
  const document = template.document;
  return { ...template, document: { ...blankDocument(), ...document, fields: Array.isArray(document.fields) ? document.fields : [] } };
}

export function EmbedLibraryPanel({ guild }: { guild: Guild }) {
  const router = useRouter();
  const [embeds, setEmbeds] = useState<EmbedTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blankDraft);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/guilds/${guild.id}/embeds`, { cache: "no-store" });
      const data = await response.json() as { embeds?: EmbedTemplate[]; error?: string };
      if (!response.ok || !Array.isArray(data.embeds)) throw new Error(data.error || "Could not load this server's embed templates.");
      const rows = data.embeds.map(normalizeTemplate);
      setEmbeds(rows);
      if (rows.length) {
        const first = rows[0];
        setSelectedId(first.id);
        const next = { name: first.name, document: first.document };
        setDraft(next);
        setSavedSnapshot(JSON.stringify(next));
      } else {
        setSelectedId(null);
        setDraft(blankDraft());
        setSavedSnapshot("");
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load this server's embed templates.");
    } finally {
      setLoading(false);
    }
  }, [guild.id]);

  useEffect(() => { void load(); }, [load]);

  const visibleEmbeds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return embeds.filter((embed) => !needle || `${embed.name} ${embed.document.title} ${embed.document.description}`.toLocaleLowerCase().includes(needle));
  }, [embeds, query]);

  function selectEmbed(embed: EmbedTemplate) {
    const normalized = normalizeTemplate(embed);
    const next = { name: normalized.name, document: normalized.document };
    setSelectedId(embed.id);
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
    setNotice(null);
  }

  function updateDocument<K extends keyof EmbedDocument>(key: K, value: EmbedDocument[K]) {
    setDraft((current) => ({ ...current, document: { ...current.document, [key]: value } }));
  }

  function createNew() {
    setSelectedId(null);
    const next = blankDraft();
    setDraft(next);
    setSavedSnapshot("");
    setNotice(null);
  }

  function duplicate() {
    setSelectedId(null);
    setDraft((current) => ({ ...current, name: `${current.name.trim() || "Embed"} copy`, document: { ...current.document, fields: current.document.fields.map((field) => ({ ...field })) } }));
    setSavedSnapshot("");
    setNotice({ text: "Copy created. Save it to add a separate template." });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(selectedId ? `/api/guilds/${guild.id}/embeds/${selectedId}` : `/api/guilds/${guild.id}/embeds`, {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json() as { embed?: EmbedTemplate; error?: string };
      if (!response.ok || !data.embed) throw new Error(data.error || "This embed could not be saved.");
      const saved = normalizeTemplate(data.embed);
      const next = { name: saved.name, document: saved.document };
      setEmbeds((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id);
      setDraft(next);
      setSavedSnapshot(JSON.stringify(next));
      setNotice({ text: selectedId ? "Embed updated for this server." : "Embed saved for this server." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "This embed could not be saved.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmbed() {
    if (!selectedId || deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/guilds/${guild.id}/embeds/${selectedId}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "This embed could not be deleted.");
      setEmbeds((current) => current.filter((item) => item.id !== selectedId));
      setConfirmDelete(false);
      createNew();
      setNotice({ text: "Embed deleted." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "This embed could not be deleted.", error: true });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const normalizedColor = /^#[0-9a-f]{6}$/i.test(draft.document.color) ? draft.document.color : "#FFFFFF";
  const openWelcome = () => {
    if (!selectedId || dirty) return;
    router.push(`/dashboard/${guild.id}?view=welcome&template=${encodeURIComponent(selectedId)}`);
  };

  if (loading) return <><div className="dashboard-heading"><div><div className="eyebrow">Reusable message design</div><h1>Embeds.</h1><p>Load server templates.</p></div></div><div className="panel" style={{ minHeight: 360 }}><div className="loading-line" style={{ width: "36%" }}/><div className="loading-line" style={{ width: "70%", marginTop: 18 }}/></div></>;
  if (loadError) return <><div className="dashboard-heading"><div><div className="eyebrow">Reusable message design</div><h1>Embeds.</h1></div></div><div className="access-card"><TriangleAlert size={18}/><h2>Embed templates could not be loaded.</h2><p>{loadError}</p><button className="button button-accent button-small" onClick={() => void load()}>Try again</button></div></>;

  return <>
    <div className="dashboard-heading"><div><div className="eyebrow">Reusable message design</div><h1>Embeds.</h1><p>Build server-scoped message templates, preview them, then apply one to Welcome.</p></div><span className={`save-state ${dirty ? "dirty" : "saved"}`}>{dirty ? "Unsaved changes" : `${embeds.length} saved`}</span></div>
    {notice && <div className={`overview-note ${notice.error ? "command-error" : "command-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
    <div className="embed-library-layout">
      <aside className="embed-library-list panel">
        <div className="panel-header"><h2>Your embeds</h2><button type="button" className="icon-button" title="Create an embed" aria-label="Create an embed" onClick={createNew}><Plus size={15}/></button></div>
        <label className="search-control embed-library-search"><Search size={13}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search embeds" aria-label="Search embed templates"/></label>
        {visibleEmbeds.length ? visibleEmbeds.map((embed) => <button type="button" className={`embed-template-item ${selectedId === embed.id ? "active" : ""}`} key={embed.id} onClick={() => selectEmbed(embed)}><span className="embed-template-swatch" style={{ backgroundColor: embed.document.color }}/><span><strong>{embed.name}</strong><small>{embed.document.title || "Untitled embed"}</small></span></button>) : <div className="role-hierarchy-empty">{embeds.length ? "No embeds match this search." : "No saved embeds yet. Create one to get started."}</div>}
      </aside>

      <form className="embed-builder panel" onSubmit={(event) => void save(event)}>
        <div className="panel-header"><div><div className="eyebrow">Editor</div><h2>{selectedId ? "Edit template" : "New template"}</h2></div>{selectedId && <span className="save-state saved">Saved to this server</span>}</div>
        <div className="embed-builder-fields">
          <div className="form-field full"><label htmlFor="embed-template-name">Template name</label><input id="embed-template-name" className="input" value={draft.name} maxLength={80} required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}/></div>
          <div className="form-field full"><label htmlFor="embed-template-content">Message content</label><textarea id="embed-template-content" className="textarea" rows={2} value={draft.document.content} maxLength={2000} placeholder="Optional text above the embed" onChange={(event) => updateDocument("content", event.target.value)}/><div className="character-count">{draft.document.content.length} / 2000</div></div>
          <div className="form-field"><label htmlFor="embed-template-author">Author</label><input id="embed-template-author" className="input" value={draft.document.authorName} maxLength={256} onChange={(event) => updateDocument("authorName", event.target.value)}/></div>
          <div className="form-field"><label htmlFor="embed-template-author-icon">Author icon URL</label><input id="embed-template-author-icon" className="input" type="url" value={draft.document.authorIconUrl} maxLength={2048} onChange={(event) => updateDocument("authorIconUrl", event.target.value)}/></div>
          <div className="form-field"><label htmlFor="embed-template-title">Title</label><input id="embed-template-title" className="input" value={draft.document.title} maxLength={256} onChange={(event) => updateDocument("title", event.target.value)}/></div>
          <div className="form-field"><label htmlFor="embed-template-title-url">Title URL</label><input id="embed-template-title-url" className="input" type="url" value={draft.document.titleUrl} maxLength={2048} onChange={(event) => updateDocument("titleUrl", event.target.value)}/></div>
          <div className="form-field full"><label htmlFor="embed-template-description">Description</label><textarea id="embed-template-description" className="textarea" rows={4} value={draft.document.description} maxLength={4096} onChange={(event) => updateDocument("description", event.target.value)}/><div className="character-count">{draft.document.description.length} / 4096</div></div>
          <div className="form-field"><label htmlFor="embed-template-color">Embed color</label><div className="color-row"><input id="embed-template-color" type="color" value={normalizedColor} onChange={(event) => updateDocument("color", event.target.value)}/><input className="input" value={draft.document.color} maxLength={7} aria-label="Embed color hex value" onChange={(event) => updateDocument("color", event.target.value)}/></div></div>
          <div className="form-field"><label htmlFor="embed-template-thumbnail">Thumbnail URL</label><input id="embed-template-thumbnail" className="input" type="url" value={draft.document.thumbnailUrl} maxLength={2048} onChange={(event) => updateDocument("thumbnailUrl", event.target.value)}/></div>
          <div className="form-field full"><label htmlFor="embed-template-image">Main image URL</label><input id="embed-template-image" className="input" type="url" value={draft.document.imageUrl} maxLength={2048} onChange={(event) => updateDocument("imageUrl", event.target.value)}/></div>
          <EmbedFieldsEditor id="embed-template-fields" label="Fields" value={draft.document.fields} onChange={(fields) => updateDocument("fields", fields)}/>
          <div className="form-field"><label htmlFor="embed-template-footer">Footer</label><input id="embed-template-footer" className="input" value={draft.document.footer} maxLength={2048} onChange={(event) => updateDocument("footer", event.target.value)}/></div>
          <div className="form-field"><label htmlFor="embed-template-footer-icon">Footer icon URL</label><input id="embed-template-footer-icon" className="input" type="url" value={draft.document.footerIconUrl} maxLength={2048} onChange={(event) => updateDocument("footerIconUrl", event.target.value)}/></div>
          <div className="form-field full"><div className="toggle-row"><div><label htmlFor="embed-template-timestamp">Show timestamp</label><p className="form-description">Discord inserts the current send time when the bot publishes this message.</p></div><input id="embed-template-timestamp" className="toggle" type="checkbox" checked={draft.document.timestampEnabled} onChange={(event) => updateDocument("timestampEnabled", event.target.checked)}/></div></div>
        </div>
        <div className="form-actions embed-builder-actions"><span className={`save-state ${dirty ? "dirty" : "saved"}`}>{dirty ? "Review before saving" : "All changes saved"}</span><div className="form-action-group">{selectedId && <button type="button" className="button button-danger button-small" onClick={() => setConfirmDelete(true)}><Trash2 size={13}/> Delete</button>}<button type="button" className="button button-secondary button-small" onClick={duplicate} disabled={!draft.name.trim()}><Copy size={13}/> Duplicate</button><button type="submit" className="button button-accent button-small" disabled={!dirty || saving || !draft.name.trim()}><Save size={13}/>{saving ? "Saving…" : "Save embed"}</button></div></div>
      </form>

      <aside className="side-card embed-live-preview"><div className="preview-heading"><div><div className="eyebrow">Live preview</div><h3>{draft.name || "Untitled embed"}</h3></div><Layers size={15}/></div><p>Illustrative Discord-style rendering with sample variable values. It is not a sent Discord message.</p>
        <div className="discord-preview-message"><div className="discord-preview-avatar">E</div><div><div className="discord-preview-author-line"><strong>ELYRAX</strong><span>Today at 12:00 PM</span></div>{draft.document.content && <div className="discord-preview-content">{sample(draft.document.content, guild)}</div>}
          <div className="preview-embed welcome-preview-embed" style={{ borderLeftColor: normalizedColor }}>
            {draft.document.authorName && <div className="welcome-preview-author">{draft.document.authorIconUrl && <img src={draft.document.authorIconUrl} alt=""/>}<span>{sample(draft.document.authorName, guild)}</span></div>}
            {draft.document.thumbnailUrl && <img className="welcome-preview-thumbnail" src={draft.document.thumbnailUrl} alt="Embed thumbnail preview"/>}
            {draft.document.title && (draft.document.titleUrl ? <a className="preview-embed-title welcome-preview-title" href={draft.document.titleUrl} target="_blank" rel="noreferrer">{sample(draft.document.title, guild)}</a> : <div className="preview-embed-title welcome-preview-title">{sample(draft.document.title, guild)}</div>)}
            {draft.document.description && <div className="preview-embed-text">{sample(draft.document.description, guild)}</div>}
            {draft.document.fields.length > 0 && <div className="welcome-preview-fields">{draft.document.fields.map((field, index) => <div className={field.inline ? "inline" : ""} key={`${index}-${field.name}`}><strong>{sample(field.name, guild)}</strong><span>{sample(field.value, guild)}</span></div>)}</div>}
            {draft.document.imageUrl && <img className="welcome-preview-image" src={draft.document.imageUrl} alt="Embed image preview"/>}
            {(draft.document.footer || draft.document.footerIconUrl || draft.document.timestampEnabled) && <div className="welcome-preview-footer">{draft.document.footerIconUrl && <img src={draft.document.footerIconUrl} alt=""/>}{draft.document.footer && <span>{sample(draft.document.footer, guild)}</span>}{draft.document.timestampEnabled && <span className="welcome-preview-time">Today at 12:00 PM</span>}</div>}
          </div>
        </div></div>
        <div className="embed-variable-note"><strong>Supported sample variables</strong><span>{"{user}, {username}, {displayname}, {user.id}, {server}, {server.name}, {server.id}, {member.count}, {channel}, {channel.name}"}</span></div>
        <button type="button" className="button button-secondary button-small embed-use-welcome" disabled={!selectedId || dirty} onClick={openWelcome}>Apply saved embed to Welcome</button>
      </aside>
    </div>
    {confirmDelete && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirmDelete(false); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="embed-delete-title" aria-describedby="embed-delete-description"><div className="confirm-icon"><TriangleAlert size={17}/></div><h2 id="embed-delete-title">Delete this embed?</h2><p id="embed-delete-description">“{draft.name}” will be removed from this the server library. This does not alter messages already sent in Discord.</p><div className="confirm-actions"><button type="button" className="button button-secondary button-small" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep embed</button><button type="button" className="button button-danger button-small" disabled={deleting} onClick={() => void deleteEmbed()}>{deleting ? "Deleting…" : "Delete embed"}</button></div></section></div>}
  </>;
}
