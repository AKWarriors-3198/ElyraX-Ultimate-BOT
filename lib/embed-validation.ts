import type { EmbedDocument } from "@/lib/db";

const documentKeys = ["content", "authorName", "authorIconUrl", "title", "titleUrl", "description", "color", "thumbnailUrl", "imageUrl", "footer", "footerIconUrl", "timestampEnabled", "fields"] as const;

function validUrl(value: unknown, maxLength = 2048): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export function isEmbedDocument(value: unknown): value is EmbedDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (Object.keys(document).length !== documentKeys.length || Object.keys(document).some((key) => !(documentKeys as readonly string[]).includes(key))) return false;
  if (typeof document.content !== "string" || document.content.length > 2000) return false;
  if (typeof document.authorName !== "string" || document.authorName.length > 256 || !validUrl(document.authorIconUrl)) return false;
  if (typeof document.title !== "string" || document.title.length > 256 || !validUrl(document.titleUrl)) return false;
  if (typeof document.description !== "string" || document.description.length > 4096) return false;
  if (typeof document.color !== "string" || !/^#[0-9a-f]{6}$/i.test(document.color)) return false;
  if (!validUrl(document.thumbnailUrl) || !validUrl(document.imageUrl)) return false;
  if (typeof document.footer !== "string" || document.footer.length > 2048 || !validUrl(document.footerIconUrl)) return false;
  if (typeof document.timestampEnabled !== "boolean" || !Array.isArray(document.fields)) return false;
  const fields = document.fields as unknown[];
  if (fields.length > 25 || fields.some((field) => !field || typeof field !== "object" || Array.isArray(field)
    || typeof (field as Record<string, unknown>).name !== "string" || !(field as Record<string, unknown>).name
    || ((field as Record<string, unknown>).name as string).trim().length === 0 || ((field as Record<string, unknown>).name as string).length > 256
    || typeof (field as Record<string, unknown>).value !== "string" || ((field as Record<string, unknown>).value as string).trim().length === 0
    || ((field as Record<string, unknown>).value as string).length > 1024 || typeof (field as Record<string, unknown>).inline !== "boolean")) return false;
  const typedFields = fields as EmbedDocument["fields"];
  const textLength = document.authorName.length + document.title.length + document.description.length + document.footer.length + typedFields.reduce((total, field) => total + field.name.length + field.value.length, 0);
  const hasContent = Boolean(document.content.trim() || document.authorName.trim() || document.title.trim() || document.description.trim() || document.thumbnailUrl || document.imageUrl || document.footer.trim() || typedFields.length);
  return textLength <= 6000 && hasContent;
}

export type EmbedPayload = { name: string; document: EmbedDocument };

export function isEmbedPayload(value: unknown): value is EmbedPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 2 && typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 80 && isEmbedDocument(body.document);
}
