// Files for the AI analysis: what Predict can read, what the browser converts, the Pictures PDF, the blank picture.
// Adapted from Business Map (analyseFiles.ts and officeDoc.ts, 2026-11-15), with Peter's permission.
// Predict reads PDF, PNG and JPG only (Business Map's lab test, 2026-11-15; Word and PowerPoint were refused), under 25 MB
// and 50 pages. So a PDF or picture goes as a file input (one per call); Word, PowerPoint, Excel, OpenDocument and text
// files are read in the browser and their text goes as text (its quotes can then be checked); GIF, BMP and WebP pictures
// become a JPEG in the browser (the caller's canvas). Old binary Office files have no open text: save them again first.
// Pure code: unzipping needs an inflate function (the browser's DecompressionStream, or zlib in the tests).

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp,.docx,.docm,.pptx,.pptm,.ppsx,.xlsx,.xlsm,.odt,.odp,.ods,.txt,.csv,.md,.tsv,.json,.xml,.html,.htm,.eml,.log";

/** A file input as Predict takes it. */
export interface FileInput { "@odata.type": "#Microsoft.Dynamics.CRM.expando"; mimeType: string; base64Encoded: string }
export const fileInput = (mimeType: string, base64Encoded: string): FileInput => ({ "@odata.type": "#Microsoft.Dynamics.CRM.expando", mimeType, base64Encoded });
/**
 * File inputs are mandatory, so "none" is a blank 1×1 white PNG (Business Map: Predict answered 200 with this one on
 * 2026-11-15, while a hand-typed one was refused with "image_parse_error"). The unit tests check its CRCs.
 */
export const BLANK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC";
export const blankInput = () => fileInput("image/png", BLANK_PNG);

/** How an upload goes: as a file (PDF, PNG, JPEG), as text read in the browser, or as a picture converted to JPEG. */
export type UploadWay = { ok: true; way: "file"; mimeType: string } | { ok: true; way: "text"; kind: OfficeKind } | { ok: true; way: "picture" } | { ok: false; why: string };
export function uploadWay(name: string, type: string, size: number): UploadWay {
  const n = (name || "").toLowerCase(), t = (type || "").toLowerCase();
  if (LEGACY_OFFICE.test(n)) return { ok: false, why: "This is an old binary Office file. Save it as .docx, .pptx, .xlsx or PDF first." };
  if (size > MAX_FILE_BYTES) return { ok: false, why: "The file is larger than 25 MB." };
  const kind = officeKind(n, t);
  if (kind) return { ok: true, way: "text", kind };
  if (t === "application/pdf" || n.endsWith(".pdf")) return { ok: true, way: "file", mimeType: "application/pdf" };
  if (t === "image/png" || n.endsWith(".png")) return { ok: true, way: "file", mimeType: "image/png" };
  if (t === "image/jpeg" || /\.jpe?g$/.test(n)) return { ok: true, way: "file", mimeType: "image/jpeg" };
  if (/\.(gif|bmp|webp)$/.test(n) || /^image\/(gif|bmp|webp)$/.test(t)) return { ok: true, way: "picture" };
  return { ok: false, why: "This file type can't be read. Use PDF, a picture, Word, PowerPoint, Excel or a text file." };
}
/** Pages of a PDF, counted from its page objects; 0 when it is no PDF. */
export function pdfPages(bytes: Uint8Array): number {
  let text = "";
  for (let i = 0; i < bytes.length; i += 65536) text += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 65536)));
  if (!text.startsWith("%PDF")) return 0;
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
}
/** A PDF's own check: readable, under 50 pages. */
export function pdfProblem(bytes: Uint8Array): string | null {
  const pages = pdfPages(bytes);
  if (!pages) return "The file is not a readable PDF.";
  if (pages >= MAX_PDF_PAGES) return "The PDF has " + pages + " pages; the analysis reads fewer than 50. Split it first.";
  return null;
}

export const toBase64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 32768)));
  return (globalThis as any).btoa ? (globalThis as any).btoa(s) : (globalThis as any).Buffer.from(bytes).toString("base64");
};
export const fromBase64 = (b64: string): Uint8Array => {
  const bin = (globalThis as any).atob ? (globalThis as any).atob(b64) : (globalThis as any).Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// ---------- The Pictures PDF ----------

/** A page: a heading, then text lines or one JPEG picture with its pixel size. */
export interface PdfPage { heading: string; lines?: string[]; jpeg?: Uint8Array; width?: number; height?: number }
/** "Page 2 = line L0026": the heading the prompt reads. */
export const pageHeading = (n: number, line: string, what: string) => "Page " + n + " = line " + line + " (" + what + ")";

/** WinAnsi for the PDF's Helvetica: Latin-1 letters as octal escapes, € and quotes mapped, others "?". */
const WIN: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };
const latin = (s: string) => Array.from(s).map(ch => {
  if (ch === "(" || ch === ")" || ch === "\\") return "\\" + ch;
  const c = ch.codePointAt(0)!;
  if (c >= 0x20 && c <= 0x7e) return ch;
  const w = WIN[ch] ?? (c >= 0xa0 && c <= 0xff ? c : c === 9 ? 32 : -1);
  return w < 0 ? "?" : "\\" + w.toString(8).padStart(3, "0");
}).join("");
/** A PDF of A4 landscape pages: a heading, then text lines (10 pt) or one picture scaled to fit. Plain PDF 1.4, no library. */
export function documentPdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const put = (x: string | Uint8Array) => { const b = typeof x === "string" ? enc.encode(x) : x; chunks.push(b); size += b.length; };
  const obj = (n: number, body: (string | Uint8Array)[]) => { offsets[n] = size; put(n + " 0 obj\n"); body.forEach(put); put("\nendobj\n"); };
  const W = 842, H = 595, M = 28, HEAD = 22;
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, ["<< /Type /Pages /Kids [" + pages.map((_, i) => (4 + i * 3) + " 0 R").join(" ") + "] /Count " + pages.length + " >>"]);
  obj(3, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]);
  pages.forEach((p, i) => {
    const page = 4 + i * 3, content = page + 1, image = page + 2;
    const boxW = W - 2 * M, boxH = H - 2 * M - HEAD - 8;
    const head = "BT /F1 14 Tf " + M + " " + (H - M - 14) + " Td (" + latin(p.heading) + ") Tj ET";
    let stream: string;
    if (p.jpeg && p.width && p.height) {
      const k = Math.min(boxW / p.width, boxH / p.height), w = p.width * k, h = p.height * k;
      stream = head + "\nq " + w.toFixed(2) + " 0 0 " + h.toFixed(2) + " " + (M + (boxW - w) / 2).toFixed(2) + " " + (M + (boxH - h)).toFixed(2) + " cm /Im" + i + " Do Q";
    } else stream = head + "\nBT /F1 10 Tf 11 TL " + M + " " + (H - M - HEAD - 18) + " Td " + (p.lines || []).map(l => "(" + latin(l) + ") Tj T*").join(" ") + " ET";
    obj(page, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 3 0 R >>" + (p.jpeg ? " /XObject << /Im" + i + " " + image + " 0 R >>" : "") + " >> /Contents " + content + " 0 R >>"]);
    obj(content, ["<< /Length " + enc.encode(stream).length + " >>\nstream\n" + stream + "\nendstream"]);
    if (p.jpeg) obj(image, ["<< /Type /XObject /Subtype /Image /Width " + p.width + " /Height " + p.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n", p.jpeg, "\nendstream"]);
    else obj(image, ["<< >>"]);
  });
  const n = 4 + pages.length * 3, xref = size;
  put("xref\n0 " + n + "\n0000000000 65535 f \n" + Array.from({ length: n - 1 }, (_, i) => String(offsets[i + 1]).padStart(10, "0") + " 00000 n \n").join(""));
  put("trailer\n<< /Size " + n + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
/** The size of a JPEG from its SOF marker; null when it is no JPEG. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}

// ---------- Office, OpenDocument and text files: their text ----------

export type OfficeKind = "docx" | "pptx" | "xlsx" | "odt" | "odp" | "ods" | "text";
export function officeKind(name: string, type = ""): OfficeKind | null {
  const ext = (/\.([a-z0-9]+)$/.exec((name || "").toLowerCase()) || [])[1] || "";
  if (["docx", "docm", "dotx"].includes(ext)) return "docx";
  if (["pptx", "pptm", "ppsx", "potx"].includes(ext)) return "pptx";
  if (["xlsx", "xlsm", "xltx"].includes(ext)) return "xlsx";
  if (ext === "odt" || ext === "odp" || ext === "ods") return ext;
  if (["txt", "csv", "md", "tsv", "json", "xml", "html", "htm", "eml", "log"].includes(ext) || /^text\//.test(type)) return "text";
  return null;
}
export const LEGACY_OFFICE = /\.(doc|ppt|xls|pps|dot|xlt|pot|msg|rtf)$/i;

export type Inflate = (raw: Uint8Array) => Promise<Uint8Array>;
/** The files of a zip (stored or deflated entries), by name. */
export async function unzip(b: Uint8Array, inflateRaw: Inflate): Promise<Map<string, Uint8Array>> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let k = 0; k < count && v.getUint32(p, true) === 0x02014b50; k++) {
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = b.subarray(start, start + csize);
    if (name.endsWith("/")) continue;
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, await inflateRaw(data));
  }
  return out;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const unescape = (t: string) => t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m));
/** The text runs of each block (paragraph, row) in order. */
function blocks(xml: string, block: string, run: string): string[] {
  const out: string[] = [];
  const re = new RegExp("<" + block + "[\\s>][\\s\\S]*?</" + block + ">|<" + block + "/>", "g");
  const rr = new RegExp("<" + run + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + run + ">", "g");
  for (const m of xml.match(re) || []) {
    let t = "";
    m.replace(rr, (_, x: string) => { t += unescape(x); return ""; });
    out.push(t.replace(/\s+/g, " ").trim());
  }
  return out.filter(Boolean);
}
const text = (files: Map<string, Uint8Array>, name: string) => (files.has(name) ? new TextDecoder().decode(files.get(name)!) : "");
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** One part of a document: a heading and its lines. `pictures` counts embedded pictures (not read: see the note). */
export interface DocSection { heading: string; lines: string[] }
export interface Extracted { sections: DocSection[]; pictures: number }
const MEDIA = /\.(png|jpe?g|gif|bmp|webp|emf|wmf)$/i;
const countMedia = (files: Map<string, Uint8Array>, folder: RegExp) => Array.from(files.keys()).filter(n => folder.test(n) && MEDIA.test(n)).length;

/** The text of an Office or OpenDocument file, by its kind. */
export function extract(kind: Exclude<OfficeKind, "text">, files: Map<string, Uint8Array>): Extracted {
  if (kind === "docx") {
    const body = blocks(text(files, "word/document.xml"), "w:p", "w:t");
    const notes = ["word/footnotes.xml", "word/comments.xml"].flatMap(n => blocks(text(files, n), "w:p", "w:t"));
    return { sections: [{ heading: "Text", lines: body }].concat(notes.length ? [{ heading: "Footnotes and comments", lines: notes }] : []), pictures: countMedia(files, /^word\/media\//) };
  }
  if (kind === "pptx") {
    const slides = Array.from(files.keys()).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(natural);
    const sections = slides.map((n, i) => {
      const notes = blocks(text(files, n.replace("slides/slide", "notesSlides/notesSlide")), "a:p", "a:t");
      return { heading: "Slide " + (i + 1), lines: blocks(text(files, n), "a:p", "a:t").concat(notes.length ? ["Speaker notes: " + notes.join(" ")] : []) };
    });
    return { sections, pictures: countMedia(files, /^ppt\/media\//) };
  }
  if (kind === "xlsx") {
    const shared = blocks(text(files, "xl/sharedStrings.xml"), "si", "t");
    const names: string[] = [];
    text(files, "xl/workbook.xml").replace(/<sheet [^>]*name="([^"]*)"/g, (_, n: string) => { names.push(unescape(n)); return ""; });
    const sheets = Array.from(files.keys()).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(natural);
    const sections = sheets.map((n, i) => ({
      heading: "Sheet " + (names[i] || i + 1),
      lines: (text(files, n).match(/<row[\s>][\s\S]*?<\/row>/g) || []).map(row => (row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map(c => {
        const t = (/\bt="(\w+)"/.exec(c) || [])[1], val = (/<v>([\s\S]*?)<\/v>/.exec(c) || [])[1], inline = (/<t[^>]*>([\s\S]*?)<\/t>/.exec(c) || [])[1];
        return unescape(t === "s" && val != null ? shared[Number(val)] ?? "" : t === "inlineStr" ? inline ?? "" : val ?? "");
      }).filter(x => x !== "").join(" | ")).filter(Boolean),
    }));
    return { sections, pictures: countMedia(files, /^xl\/media\//) };
  }
  const content = text(files, "content.xml");
  const lines = (content.match(/<text:(p|h)[\s>][\s\S]*?<\/text:\1>/g) || [])
    .map(p => unescape(p.replace(/<text:(?:s|tab)\/>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()).filter(Boolean);
  return { sections: [{ heading: kind === "odp" ? "Slides" : kind === "ods" ? "Sheets" : "Text", lines }], pictures: countMedia(files, /^Pictures\//) };
}
/** A plain-text file: its lines (HTML without its tags). */
export function extractText(name: string, raw: string): Extracted {
  const t = /\.html?$/i.test(name) ? raw.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ") : raw;
  return { sections: [{ heading: "Text", lines: unescape(t).split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim()) }], pictures: 0 };
}
/** An extracted document as the prompt reads it, section by section. */
export const extractedText = (ex: Extracted) => ex.sections.filter(s => s.lines.length).map(s => "## " + s.heading + "\n" + s.lines.join("\n")).join("\n\n");
/** Read any text-kind upload. */
export async function readTextUpload(name: string, kind: OfficeKind, bytes: Uint8Array, inflate: Inflate): Promise<Extracted> {
  if (kind === "text") return extractText(name, new TextDecoder().decode(bytes));
  return extract(kind, await unzip(bytes, inflate));
}
