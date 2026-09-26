"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

type EmbedField = { name: string; value: string; inline: boolean };

export function EmbedFieldsEditor({ id, label, description, value, onChange }: { id: string; label: string; description?: string; value: unknown; onChange: (value: EmbedField[]) => void }) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const fields: EmbedField[] = Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.value !== "string") return [];
    return [{ name: row.name.slice(0, 256), value: row.value.slice(0, 1024), inline: Boolean(row.inline) }];
  }).slice(0, 25) : [];
  const update = (index: number, key: "name" | "value" | "inline", next: string | boolean) => onChange(fields.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: next } : item));
  const move = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return <div className="form-field full embed-fields-builder"><div className="embed-fields-heading"><div><label>{label}</label>{description && <p className="form-description">{description}</p>}</div><span>{fields.length} / 25</span></div>
    {fields.map((item, index) => <div className={`embed-field-row ${draggingIndex === index ? "dragging" : ""}`} key={index} draggable onDragStart={(event) => { setDraggingIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }} onDragOver={(event) => { if (draggingIndex !== null) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData("text/plain")); if (Number.isInteger(from) && from >= 0 && from < fields.length && from !== index) { const next = [...fields]; const [field] = next.splice(from, 1); next.splice(index, 0, field); onChange(next); } setDraggingIndex(null); }} onDragEnd={() => setDraggingIndex(null)}><div className="embed-field-row-top"><span>Field {index + 1} <small>Drag to reorder</small></span><div className="embed-field-actions"><button type="button" className="icon-button" aria-label={`Move field ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13}/></button><button type="button" className="icon-button" aria-label={`Move field ${index + 1} down`} title="Move down" disabled={index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13}/></button><button type="button" className="text-button" onClick={() => onChange(fields.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div><div className="embed-field-inputs"><div><label htmlFor={`${id}-${index}-name`}>Name</label><input id={`${id}-${index}-name`} className="input" value={item.name} maxLength={256} placeholder="Member" onChange={(event) => update(index, "name", event.target.value)}/></div><div><label htmlFor={`${id}-${index}-value`}>Value</label><textarea id={`${id}-${index}-value`} className="textarea" rows={2} value={item.value} maxLength={1024} placeholder="{username}" onChange={(event) => update(index, "value", event.target.value)}/></div></div><label className="embed-inline-control"><input type="checkbox" checked={item.inline} onChange={(event) => update(index, "inline", event.target.checked)}/> Display inline</label></div>)}
    <button type="button" className="button button-secondary button-small embed-add-field" disabled={fields.length >= 25} onClick={() => onChange([...fields, { name: "", value: "", inline: false }])}><span aria-hidden="true">+</span> Add embed field</button>
  </div>;
}
