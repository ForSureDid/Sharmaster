import { readFile } from "node:fs/promises";
import path from "node:path";

const LEGAL_DIR = path.join(process.cwd(), "content", "legal");

export type LegalSlug =
  | "01-politika-konfidencialnosti-ru"
  | "02-publichnaya-oferta-ru"
  | "03-politika-dostavki-ru"
  | "04-politika-vozvrata-ru"
  | "05-politika-cookie-ru";

/** Reads a legal document's markdown source at request time. Content is static — no external calls. */
export async function getLegalMarkdown(slug: LegalSlug): Promise<string> {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`);
  return readFile(filePath, "utf-8");
}
