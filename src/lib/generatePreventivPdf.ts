import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import { PreventivLang, PREVENTIV_STRINGS } from "./preventivTranslations";

export interface QuoteItem {
  section: string;
  service: string;
  qty: string;
  unit_price: string;
  total: string;
  discountEnabled?: boolean;
  discountType?: "percent" | "fixed";
  discountValue?: string;
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface PreventivData {
  clinicName: string;
  clinicPhone?: string | null;
  clinicEmail?: string | null;
  clinicWebsite?: string | null;
  clinicAddress?: string | null;
  patientName: string;
  date: string; // already formatted, e.g. 30.06.2026
  validUntil?: string | null; // already formatted, e.g. 30.07.2026
  items: QuoteItem[];
  currency?: string;
  notes?: string | null;
  language?: PreventivLang;
  contactLine?: string | null;
  emailLine?: string | null;
  websiteLine?: string | null;
  servicesChecklist?: ChecklistItem[];
}

/** Computes the discounted total for an item. Falls back to the raw `total` field when no discount is enabled. */
function discountedTotal(it: QuoteItem): number {
  const base = Number(String(it.total).replace(/[^0-9.-]/g, "")) || 0;
  if (!it.discountEnabled || !it.discountValue) return base;
  const dv = Number(String(it.discountValue).replace(",", ".")) || 0;
  if (it.discountType === "fixed") return Math.max(0, base - dv);
  return Math.max(0, base - (base * dv) / 100);
}

function discountLabel(it: QuoteItem, currency: string): string {
  if (!it.discountEnabled || !it.discountValue) return "";
  const dv = Number(String(it.discountValue).replace(",", ".")) || 0;
  return it.discountType === "fixed" ? `-${money(dv, currency)}` : `-${dv}%`;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;

const INK = rgb(0.1, 0.1, 0.1);             // near-black text — high contrast for readability
const MUTED = rgb(0.32, 0.34, 0.38);         // secondary text — still dark enough to read easily
const NAVY = rgb(0.059, 0.141, 0.251);       // header band / section bands background
const GOLD = rgb(0.71, 0.53, 0.05);          // accent — used sparingly for totals/highlights
const LINE = rgb(0.82, 0.83, 0.85);
const WHITE = rgb(1, 1, 1);

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£" };

function money(v: string | number, currency: string) {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (!isFinite(n)) return String(v);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Token { text: string; bold: boolean }

/** Splits "some **bold** text" into alternating plain/bold tokens (words, spaces preserved as separators). */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      tokens.push({ text: part.slice(2, -2), bold: true });
    } else {
      tokens.push({ text: part, bold: false });
    }
  }
  return tokens;
}

/** Wraps a token stream into visual lines of {text, bold} words, each fitting within maxW. */
function wrapTokens(tokens: Token[], font: PDFFont, bold: PDFFont, size: number, maxW: number): Token[][] {
  const words: Token[] = [];
  for (const tok of tokens) {
    const parts = tok.text.split(/(\s+)/).filter((s) => s.length);
    for (const p of parts) words.push({ text: p, bold: tok.bold });
  }
  const lines: Token[][] = [];
  let cur: Token[] = [];
  let curW = 0;
  for (const word of words) {
    if (/^\s+$/.test(word.text) && cur.length === 0) continue; // skip leading spaces on a new line
    const f = word.bold ? bold : font;
    const w = f.widthOfTextAtSize(word.text, size);
    if (curW + w > maxW && cur.length) {
      // trim trailing space token before breaking
      while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)) cur.pop();
      lines.push(cur);
      cur = [];
      curW = 0;
      if (/^\s+$/.test(word.text)) continue;
    }
    cur.push(word);
    curW += w;
  }
  if (cur.length) {
    while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)) cur.pop();
    lines.push(cur);
  }
  return lines.length ? lines : [[]];
}

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = PAGE_H - MARGIN;

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  /** Draws a PNG image scaled to fit within maxW x maxH, anchored top-left at (x, topY), preserving aspect ratio. */
  drawImageFit(image: Awaited<ReturnType<PDFDocument["embedPng"]>>, x: number, topY: number, maxW: number, maxH: number) {
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    this.page.drawImage(image, { x, y: topY - h, width: w, height: h });
    return { width: w, height: h };
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensureSpace(h: number) {
    if (this.y - h < MARGIN + 60) this.newPage();
  }

  text(str: string, x: number, size: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    this.page.drawText(str, { x, y: this.y, size, font: opts.font ?? this.font, color: opts.color ?? INK });
  }

  /** Draw text right-aligned so it never overflows past `rightX`. */
  textRight(str: string, rightX: number, size: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    const font = opts.font ?? this.font;
    const w = font.widthOfTextAtSize(str, size);
    this.page.drawText(str, { x: rightX - w, y: this.y, size, font, color: opts.color ?? INK });
  }

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  lineH(x1: number, x2: number, y: number, color = LINE, thickness = 0.75) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  /** Draws a single already-wrapped line of mixed plain/bold tokens starting at x. */
  drawTokenLine(tokens: Token[], x: number, size: number, color: RGB) {
    let cx = x;
    for (const tok of tokens) {
      const f = tok.bold ? this.bold : this.font;
      this.page.drawText(tok.text, { x: cx, y: this.y, size, font: f, color });
      cx += f.widthOfTextAtSize(tok.text, size);
    }
  }
}

export async function generatePreventivPdf(data: PreventivData): Promise<Uint8Array> {
  const w = new Writer();
  await w.init();
  const currency = data.currency ?? "EUR";
  const contentW = PAGE_W - MARGIN * 2;
  const t = PREVENTIV_STRINGS[data.language ?? "en"];

  // ── Header band ──
  const HEADER_H = 165;
  w.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, NAVY);

  let logoDrawn = false;
  try {
    const logoBytes = await fetch("/logo-aura-vita.png").then((r) => r.arrayBuffer());
    const logoImage = await w.doc.embedPng(logoBytes);
    w.drawImageFit(logoImage, MARGIN, PAGE_H - 18, 220, HEADER_H - 30);
    logoDrawn = true;
  } catch {
    // fall back to text below if the logo can't be loaded/embedded
  }

  w.y = PAGE_H - 50;
  if (!logoDrawn) {
    w.text(data.clinicName.toUpperCase(), MARGIN, 28, { font: w.bold, color: WHITE });
  }
  w.y -= 24;
  const subParts = [data.clinicAddress, data.clinicPhone, data.clinicEmail].filter(Boolean);
  if (subParts.length) {
    w.text(subParts.join("   ·   "), MARGIN, 11.5, { color: rgb(0.85, 0.85, 0.85) });
  }
  w.y = PAGE_H - 50;
  w.textRight(t.quote, PAGE_W - MARGIN, 24, { font: w.bold, color: GOLD });

  w.y = PAGE_H - HEADER_H - 36;

  // ── Patient / Date / Valid-until block ──
  const colDateX = PAGE_W / 2;
  const colValidX = PAGE_W - MARGIN - 150;
  w.text(t.patient, MARGIN, 11, { font: w.bold, color: MUTED });
  w.text(t.date, colDateX, 11, { font: w.bold, color: MUTED });
  if (data.validUntil) w.text(t.validUntil, colValidX, 11, { font: w.bold, color: MUTED });
  w.y -= 21;
  w.text(data.patientName, MARGIN, 18.5, { font: w.bold });
  w.text(data.date, colDateX, 18.5, { font: w.bold });
  if (data.validUntil) w.text(data.validUntil, colValidX, 18.5, { font: w.bold, color: GOLD });
  w.y -= 24;
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, GOLD, 1.4);
  w.y -= 26;

  const hasDiscounts = data.items.some((it) => it.discountEnabled && it.discountValue);

  // ── Table columns ── built right-to-left so each numeric column gets just
  // enough room for its widest realistic value at large-print size, and the
  // service name keeps whatever space is left.
  const TABLE_RIGHT_PAD = 10;
  const colService = MARGIN;
  const colTotalRight = MARGIN + contentW - TABLE_RIGHT_PAD;
  const TOTAL_W = 105;
  const colDiscountRight = colTotalRight - TOTAL_W;
  const DISCOUNT_W = 85;
  const colUnitRight = hasDiscounts ? colDiscountRight - DISCOUNT_W : colTotalRight - TOTAL_W;
  const PRICE_W = 100;
  const colQtyRight = colUnitRight - PRICE_W;
  const QTY_W = 30;
  const colServiceMaxX = colQtyRight - QTY_W;

  const drawTableHeader = () => {
    w.rect(MARGIN, w.y - 11, contentW, 40, NAVY);
    w.text(t.service, colService + 8, 15.5, { font: w.bold, color: WHITE });
    w.textRight(t.qty, colQtyRight, 15.5, { font: w.bold, color: WHITE });
    w.textRight(t.price, colUnitRight, 15.5, { font: w.bold, color: WHITE });
    if (hasDiscounts) w.textRight(t.discount, colDiscountRight, 15.5, { font: w.bold, color: WHITE });
    w.textRight(t.total, colTotalRight, 15.5, { font: w.bold, color: WHITE });
    w.y -= 40;
  };

  const drawSectionHeader = (label: string) => {
    w.ensureSpace(44);
    const bandH = 40;
    w.rect(MARGIN, w.y - bandH, contentW, bandH, NAVY);
    w.y -= bandH - 13;
    w.text(label.toUpperCase(), colService + 8, 14, { font: w.bold, color: WHITE });
    w.y -= 13;
  };

  // group items by section, preserving order of first appearance
  const sections: { name: string; items: QuoteItem[] }[] = [];
  for (const it of data.items) {
    const key = it.section || t.defaultSectionName;
    let sec = sections.find((s) => s.name === key);
    if (!sec) { sec = { name: key, items: [] }; sections.push(sec); }
    sec.items.push(it);
  }

  w.ensureSpace(40);
  drawTableHeader();

  let grandTotal = 0;
  let zebraIdx = 0;
  const ROW_FONT = 20;
  const LINE_GAP = 27;       // gap between wrapped lines within a cell
  const ROW_VPAD = 17;       // vertical padding above + below text block, each side
  const ZEBRA_BG = rgb(0.965, 0.955, 0.935);

  for (const sec of sections) {
    if (sec.name) drawSectionHeader(sec.name);
    for (const it of sec.items) {
      // wrap long service text onto as many lines as needed
      const maxServiceW = colServiceMaxX - colService - 8;
      const words = it.service.split(" ");
      const serviceLines: string[] = [];
      let cur = "";
      for (const word of words) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (w.font.widthOfTextAtSize(candidate, ROW_FONT) <= maxServiceW) cur = candidate;
        else { if (cur) serviceLines.push(cur); cur = word; }
      }
      if (cur) serviceLines.push(cur);
      if (serviceLines.length === 0) serviceLines.push(it.service);

      // total row height = padding + text block height (text baseline-to-baseline)
      const textBlockH = (serviceLines.length - 1) * LINE_GAP;
      const rowH = ROW_VPAD * 2 + textBlockH + 18; // +18 ~ cap height above first baseline

      w.ensureSpace(rowH + 4);
      const rowTopY = w.y;
      const firstBaselineY = rowTopY - ROW_VPAD - 18;

      // zebra band spans the exact same box the text is drawn inside
      if (zebraIdx % 2 === 1) w.rect(MARGIN, rowTopY - rowH, contentW, rowH, ZEBRA_BG);
      zebraIdx++;

      const rowTotal = discountedTotal(it);
      const discLabel = discountLabel(it, currency);

      w.y = firstBaselineY;
      w.text(serviceLines[0], colService + 8, ROW_FONT);
      w.textRight(it.qty || "1", colQtyRight, ROW_FONT);
      w.textRight(money(it.unit_price, currency), colUnitRight, ROW_FONT);
      if (discLabel) w.textRight(discLabel, colDiscountRight, ROW_FONT, { color: GOLD });
      w.textRight(money(rowTotal, currency), colTotalRight, ROW_FONT, { font: w.bold });

      // remaining wrapped lines, each on its own line beneath the first
      for (let i = 1; i < serviceLines.length; i++) {
        w.y = firstBaselineY - i * LINE_GAP;
        w.text(serviceLines[i], colService + 8, ROW_FONT);
      }

      grandTotal += rowTotal;

      w.y = rowTopY - rowH;
    }
  }

  // thin rule closing off the table
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, LINE, 0.75);

  // ── Total ── box sits entirely below the closing rule, with a clear gap
  const TOTAL_GAP = 20;   // space between table rule and total box
  const totalBoxH = 58;
  w.ensureSpace(TOTAL_GAP + totalBoxH + 10);
  const totalBoxTop = w.y - TOTAL_GAP;
  const totalBoxW = 300;
  const totalBoxX = MARGIN + contentW - totalBoxW;
  w.rect(totalBoxX, totalBoxTop - totalBoxH, totalBoxW, totalBoxH, NAVY);
  w.y = totalBoxTop - totalBoxH / 2 - 7; // vertically center the label/value in the box
  w.text(t.total, totalBoxX + 18, 13, { font: w.bold, color: WHITE });
  w.textRight(money(grandTotal, currency), colTotalRight - 14, 22, { font: w.bold, color: WHITE });
  w.y = totalBoxTop - totalBoxH - 18;

  if (data.notes && data.notes.trim()) {
    w.ensureSpace(50);
    w.text(t.notes, MARGIN, 11.5, { font: w.bold, color: MUTED });
    w.y -= 19;
    const noteLines = wrapText(data.notes, w.font, 12.5, contentW);
    for (const line of noteLines) {
      w.ensureSpace(18);
      w.text(line, MARGIN, 12.5);
      w.y -= 18;
    }
    w.y -= 8;
  }

  // ── Footer informational sections ──
  w.ensureSpace(150);
  w.y -= 6;
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, LINE);
  w.y -= 20;

  const BULLET_INDENT = 18;
  const SIZE = 15;
  const LEADING = 20;

  /** Renders **bold**-marked, optionally "- "-bulleted paragraph lines under a gold title. */
  const footerSection = (title: string, lines: string[]) => {
    w.ensureSpace(26 + lines.length * LEADING);
    w.text(title.toUpperCase(), MARGIN, 15.5, { font: w.bold, color: NAVY });
    w.y -= 25;
    for (const raw of lines) {
      const isBullet = raw.startsWith("- ");
      const line = isBullet ? raw.slice(2) : raw;
      const x = isBullet ? MARGIN + BULLET_INDENT : MARGIN;
      const maxW = contentW - (isBullet ? BULLET_INDENT : 0);
      const wrapped = wrapTokens(tokenize(line), w.font, w.bold, SIZE, maxW);
      wrapped.forEach((tl, i) => {
        w.ensureSpace(20);
        if (isBullet && i === 0) w.text("•", MARGIN, SIZE, { color: INK });
        w.drawTokenLine(tl, x, SIZE, INK);
        w.y -= LEADING;
      });
      w.y -= 6; // paragraph gap
    }
    w.y -= 10;
  };

  const serviceLines = data.servicesChecklist
    ? data.servicesChecklist.filter((it) => it.checked).map((it) => it.text)
    : t.servicesLines;
  footerSection(t.servicesTitle, serviceLines);
  footerSection(t.paymentTitle, t.paymentLines);
  footerSection(t.warrantyTitle, t.warrantyLines);

  // Contact / email / website line, at the very end
  const infoLines = [data.contactLine, data.emailLine, data.websiteLine].filter((l): l is string => !!l && l.trim().length > 0);
  if (infoLines.length) {
    w.ensureSpace(16 + infoLines.length * 22);
    for (const line of infoLines) {
      w.text(line, MARGIN, 15, { font: w.bold, color: INK });
      w.y -= 22;
    }
    w.y -= 6;
  }

  return w.doc.save();
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) cur = candidate;
    else { if (cur) lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}
