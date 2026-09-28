import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PreventivLang, PREVENTIV_STRINGS, PreventivStrings } from "./preventivTranslations";
import { UPPER_TEETH, LOWER_TEETH, TOOTH_PATH, TOOTH_VIEWBOX } from "./toothChart";

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
  selectedTeeth?: number[];
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

/**
 * Standard fonts (WinAnsi) only cover Latin-1. Text containing Hebrew, Cyrillic-adjacent
 * extras, or other characters outside that range needs a Unicode font instead, else pdf-lib
 * throws "WinAnsi cannot encode". We embed Noto Sans (broad Unicode coverage: Latin, Cyrillic,
 * Greek, etc.) as the default and fall back to Noto Sans Hebrew per run of Hebrew-script text.
 */
interface FontSet { latin: PDFFont; latinBold: PDFFont; hebrew: PDFFont; hebrewBold: PDFFont }

function isHebrewCodePoint(cp: number): boolean {
  return cp >= 0x0591 && cp <= 0x05f4; // Hebrew block (letters, points, punctuation)
}

/** Splits text into runs of consecutive Hebrew vs. non-Hebrew characters, preserving order. */
function splitScriptRuns(str: string): { text: string; hebrew: boolean }[] {
  if (!str) return [];
  const runs: { text: string; hebrew: boolean }[] = [];
  let cur = "";
  let curHebrew: boolean | null = null;
  for (const ch of str) {
    const heb = isHebrewCodePoint(ch.codePointAt(0) ?? 0);
    if (curHebrew === null || heb === curHebrew) {
      cur += ch;
      curHebrew = heb;
    } else {
      runs.push({ text: cur, hebrew: curHebrew });
      cur = ch;
      curHebrew = heb;
    }
  }
  if (cur) runs.push({ text: cur, hebrew: curHebrew ?? false });
  return runs;
}

function fontFor(fonts: FontSet, hebrew: boolean, bold: boolean): PDFFont {
  if (hebrew) return bold ? fonts.hebrewBold : fonts.hebrew;
  return bold ? fonts.latinBold : fonts.latin;
}

function widthOfMixedText(str: string, fonts: FontSet, size: number, bold: boolean): number {
  let w = 0;
  for (const run of splitScriptRuns(str)) {
    w += fontFor(fonts, run.hebrew, bold).widthOfTextAtSize(run.text, size);
  }
  return w;
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
function wrapTokens(tokens: Token[], fonts: FontSet, size: number, maxW: number): Token[][] {
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
    const w = widthOfMixedText(word.text, fonts, size, word.bold);
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
  fonts!: FontSet;
  y = PAGE_H - MARGIN;

  async init() {
    this.doc = await PDFDocument.create();
    this.doc.registerFontkit(fontkit);
    const [latinReg, latinBold, hebReg, hebBold] = await Promise.all([
      fetch("/fonts/NotoSans-Regular.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/NotoSans-Bold.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/NotoSansHebrew-Regular.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/NotoSansHebrew-Bold.ttf").then((r) => r.arrayBuffer()),
    ]);
    this.fonts = {
      latin: await this.doc.embedFont(latinReg),
      latinBold: await this.doc.embedFont(latinBold),
      hebrew: await this.doc.embedFont(hebReg),
      hebrewBold: await this.doc.embedFont(hebBold),
    };
    this.newPage();
  }

  widthOfText(str: string, size: number, bold = false): number {
    return widthOfMixedText(str, this.fonts, size, bold);
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

  /** Draws text left-to-right starting at x, splitting into per-script runs so any Unicode text renders correctly. */
  text(str: string, x: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
    let cx = x;
    for (const run of splitScriptRuns(str)) {
      const font = fontFor(this.fonts, run.hebrew, opts.bold ?? false);
      this.page.drawText(run.text, { x: cx, y: this.y, size, font, color: opts.color ?? INK });
      cx += font.widthOfTextAtSize(run.text, size);
    }
  }

  /** Draw text right-aligned so it never overflows past `rightX`. */
  textRight(str: string, rightX: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
    const w = widthOfMixedText(str, this.fonts, size, opts.bold ?? false);
    this.text(str, rightX - w, size, opts);
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
      for (const run of splitScriptRuns(tok.text)) {
        const font = fontFor(this.fonts, run.hebrew, tok.bold);
        this.page.drawText(run.text, { x: cx, y: this.y, size, font, color });
        cx += font.widthOfTextAtSize(run.text, size);
      }
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
    w.text(data.clinicName.toUpperCase(), MARGIN, 28, { bold: true, color: WHITE });
  }
  w.y -= 24;
  const subParts = [data.clinicAddress, data.clinicPhone, data.clinicEmail].filter(Boolean);
  if (subParts.length) {
    w.text(subParts.join("   ·   "), MARGIN, 11.5, { color: rgb(0.85, 0.85, 0.85) });
  }
  w.y = PAGE_H - 50;
  w.textRight(t.quote, PAGE_W - MARGIN, 24, { bold: true, color: GOLD });

  w.y = PAGE_H - HEADER_H - 36;

  // ── Patient / Date / Valid-until block ──
  const colDateX = PAGE_W / 2;
  const colValidX = PAGE_W - MARGIN - 150;
  w.text(t.patient, MARGIN, 11, { bold: true, color: MUTED });
  w.text(t.date, colDateX, 11, { bold: true, color: MUTED });
  if (data.validUntil) w.text(t.validUntil, colValidX, 11, { bold: true, color: MUTED });
  w.y -= 21;
  w.text(data.patientName, MARGIN, 18.5, { bold: true });
  w.text(data.date, colDateX, 18.5, { bold: true });
  if (data.validUntil) w.text(data.validUntil, colValidX, 18.5, { bold: true, color: GOLD });
  w.y -= 24;
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, GOLD, 1.4);
  w.y -= 26;

  if (data.selectedTeeth && data.selectedTeeth.length) {
    drawToothChart(w, data.selectedTeeth, t, contentW);
  }

  const hasDiscounts = data.items.some((it) => it.discountEnabled && it.discountValue);
  const ROW_FONT = 20;
  const MIN_ROW_FONT = 12;

  /** A font size <= baseSize that keeps `str` within maxW — shrinks only for outlier-long
   *  values (e.g. an unusually large price), so columns never overlap regardless of magnitude. */
  const fitFontSize = (str: string, maxW: number, baseSize: number, bold = false): number => {
    const naturalW = w.widthOfText(str, baseSize, bold);
    if (naturalW <= maxW) return baseSize;
    return Math.max(MIN_ROW_FONT, baseSize * (maxW / naturalW));
  };

  // ── Table columns ── built right-to-left with generous fixed widths that comfortably
  // fit realistic clinic amounts (up to 6-figure totals) at large-print size; widened
  // further if a header label needs more room, and any outlier value that still doesn't
  // fit gets its own font shrunk (via fitFontSize below) rather than overlapping. The
  // service column always keeps at least MIN_SERVICE_W — if long translated headers
  // (e.g. Italian "QUANTITÀ") would otherwise starve it, the other four columns (and
  // their header text) shrink proportionally instead.
  const COL_PAD = 14;
  const HEADER_FONT = 15.5;
  const MIN_SERVICE_W = 150;

  let qtyW = Math.max(50, w.widthOfText(t.qty, HEADER_FONT, true) + COL_PAD);
  let priceW = Math.max(120, w.widthOfText(t.price, HEADER_FONT, true) + COL_PAD);
  let discountW = hasDiscounts ? Math.max(105, w.widthOfText(t.discount, HEADER_FONT, true) + COL_PAD) : 0;
  let totalW = Math.max(135, w.widthOfText(t.total, HEADER_FONT, true) + COL_PAD);

  const TABLE_RIGHT_PAD = 10;
  const colService = MARGIN;
  const colTotalRight = MARGIN + contentW - TABLE_RIGHT_PAD;

  const numericColsW = qtyW + priceW + discountW + totalW;
  const availableForCols = contentW - TABLE_RIGHT_PAD - MIN_SERVICE_W - 8;
  if (numericColsW > availableForCols && availableForCols > 0) {
    const scale = availableForCols / numericColsW;
    qtyW *= scale; priceW *= scale; discountW *= scale; totalW *= scale;
  }
  const headerFontSize = (label: string, colW: number) => fitFontSize(label, colW - COL_PAD, HEADER_FONT, true);

  const colDiscountRight = colTotalRight - totalW;
  const colUnitRight = hasDiscounts ? colDiscountRight - discountW : colTotalRight - totalW;
  const colQtyRight = colUnitRight - priceW;
  const colServiceMaxX = colQtyRight - qtyW;

  const drawTableHeader = () => {
    w.rect(MARGIN, w.y - 11, contentW, 40, NAVY);
    w.text(t.service, colService + 8, HEADER_FONT, { bold: true, color: WHITE });
    w.textRight(t.qty, colQtyRight, headerFontSize(t.qty, qtyW), { bold: true, color: WHITE });
    w.textRight(t.price, colUnitRight, headerFontSize(t.price, priceW), { bold: true, color: WHITE });
    if (hasDiscounts) w.textRight(t.discount, colDiscountRight, headerFontSize(t.discount, discountW), { bold: true, color: WHITE });
    w.textRight(t.total, colTotalRight, headerFontSize(t.total, totalW), { bold: true, color: WHITE });
    w.y -= 40;
  };

  const drawSectionHeader = (label: string) => {
    w.ensureSpace(44);
    const bandH = 40;
    w.rect(MARGIN, w.y - bandH, contentW, bandH, NAVY);
    w.y -= bandH - 13;
    w.text(label.toUpperCase(), colService + 8, 14, { bold: true, color: WHITE });
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
        if (w.widthOfText(candidate, ROW_FONT) <= maxServiceW) { cur = candidate; continue; }
        if (cur) { serviceLines.push(cur); cur = ""; }
        if (w.widthOfText(word, ROW_FONT) <= maxServiceW) { cur = word; continue; }
        // a single word wider than the whole column (e.g. no spaces) — break by character
        // instead of overflowing into the QTY column next to it
        let chunk = "";
        for (const ch of word) {
          const candidateChunk = chunk + ch;
          if (!chunk || w.widthOfText(candidateChunk, ROW_FONT) <= maxServiceW) chunk = candidateChunk;
          else { serviceLines.push(chunk); chunk = ch; }
        }
        cur = chunk;
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
      const qtyStr = it.qty || "1";
      const priceStr = money(it.unit_price, currency);
      const totalStr = money(rowTotal, currency);

      w.y = firstBaselineY;
      w.text(serviceLines[0], colService + 8, ROW_FONT);
      w.textRight(qtyStr, colQtyRight, fitFontSize(qtyStr, qtyW - COL_PAD, ROW_FONT));
      w.textRight(priceStr, colUnitRight, fitFontSize(priceStr, priceW - COL_PAD, ROW_FONT));
      if (discLabel) {
        w.textRight(discLabel, colDiscountRight, fitFontSize(discLabel, discountW - COL_PAD, ROW_FONT), { color: GOLD });
      }
      w.textRight(totalStr, colTotalRight, fitFontSize(totalStr, totalW - COL_PAD, ROW_FONT, true), { bold: true });

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
  w.text(t.total, totalBoxX + 18, 13, { bold: true, color: WHITE });
  const grandTotalStr = money(grandTotal, currency);
  const grandTotalMaxW = totalBoxW - 130; // leave room for the "TOTAL" label on the left
  w.textRight(grandTotalStr, colTotalRight - 14, fitFontSize(grandTotalStr, grandTotalMaxW, 22, true), { bold: true, color: WHITE });
  w.y = totalBoxTop - totalBoxH - 18;

  if (data.notes && data.notes.trim()) {
    w.ensureSpace(50);
    w.text(t.notes, MARGIN, 11.5, { bold: true, color: MUTED });
    w.y -= 19;
    const noteLines = wrapText(data.notes, w.fonts, 12.5, contentW);
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
    w.text(title.toUpperCase(), MARGIN, 15.5, { bold: true, color: NAVY });
    w.y -= 25;
    for (const raw of lines) {
      const isBullet = raw.startsWith("- ");
      const line = isBullet ? raw.slice(2) : raw;
      const x = isBullet ? MARGIN + BULLET_INDENT : MARGIN;
      const maxW = contentW - (isBullet ? BULLET_INDENT : 0);
      const wrapped = wrapTokens(tokenize(line), w.fonts, SIZE, maxW);
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
      w.text(line, MARGIN, 15, { bold: true, color: INK });
      w.y -= 22;
    }
    w.y -= 6;
  }

  // ── Reserve-your-treatment deposit box, always the very last thing on the PDF ──
  drawReservePromo(w, t, currency, contentW);

  return w.doc.save();
}

/** Draws the FDI upper/lower tooth chart with the selected teeth highlighted in gold. */
function drawToothChart(w: Writer, selectedTeeth: number[], t: PreventivStrings, contentW: number) {
  const GAP = 6;
  const MID_GAP = 14;
  const LABEL_SIZE = 8;
  const LABEL_GAP = 4;
  const slotW = (contentW - GAP * 14 - MID_GAP) / 16;
  const iconW = slotW * 0.62;
  const scale = iconW / TOOTH_VIEWBOX.width;
  const iconH = TOOTH_VIEWBOX.height * scale;
  const rowH = iconH + LABEL_GAP + LABEL_SIZE;
  const rowGap = 14;

  const SELECTED_STROKE = rgb(0.55, 0.4, 0.03);
  const UNSELECTED_FILL = rgb(0.98, 0.98, 0.98);

  w.ensureSpace(15 + 20 + rowH * 2 + rowGap + 34);
  w.text(t.selectedTeethTitle.toUpperCase(), MARGIN, 13, { bold: true, color: NAVY });
  w.y -= 20;

  const drawRow = (row: number[]) => {
    const topY = w.y;
    let x = MARGIN;
    for (let idx = 0; idx < row.length; idx++) {
      if (idx === 8) x += MID_GAP;
      const tooth = row[idx];
      const selected = selectedTeeth.includes(tooth);
      const slotCenterX = x + slotW / 2;
      w.page.drawSvgPath(TOOTH_PATH, {
        x: slotCenterX - iconW / 2,
        y: topY,
        scale,
        color: selected ? GOLD : UNSELECTED_FILL,
        borderColor: selected ? SELECTED_STROKE : LINE,
        borderWidth: 1,
      });
      const label = String(tooth);
      const font = w.fonts.latinBold;
      const tw = font.widthOfTextAtSize(label, LABEL_SIZE);
      w.page.drawText(label, {
        x: slotCenterX - tw / 2,
        y: topY - iconH - LABEL_GAP - LABEL_SIZE * 0.75,
        size: LABEL_SIZE,
        font,
        color: selected ? SELECTED_STROKE : MUTED,
      });
      x += slotW + GAP;
    }
    w.y = topY - rowH;
  };

  drawRow(UPPER_TEETH);
  w.y -= rowGap;
  drawRow(LOWER_TEETH);
  // drawTableHeader's navy band extends ~29pt above the y it's called at (it straddles
  // the header text's baseline), so leave more than that here or the band clips the chart.
  w.y -= 34;
}

/** Draws the "reserve your treatment / secure a deposit" promo box at the bottom of the PDF. */
function drawReservePromo(w: Writer, t: PreventivStrings, currency: string, contentW: number) {
  const DEPOSIT_AMOUNT = 100;
  const DEPOSIT_DEDUCT = 50;
  const PAD = 16;
  const COL_GAP = 18;
  const RIGHT_W = 160;
  const leftW = contentW - PAD * 2 - COL_GAP - RIGHT_W;

  const BODY_SIZE = 11;
  const LEAD = 15.5;
  const AMBER_SIZE = 10.5;
  const AMBER_LEAD = 14;

  const bullets = t.depositBullets.map((b) => b.replace("{amount}", money(DEPOSIT_DEDUCT, currency)));
  const bulletWrapped = bullets.map((b) => wrapTokens(tokenize(b), w.fonts, BODY_SIZE, leftW - 14));
  const amberLines = wrapTokens(tokenize(`**${t.limitedTimeLabel}** ${t.limitedTimeText}`), w.fonts, AMBER_SIZE, contentW - PAD * 2 - 20);
  const confirmLines = wrapTokens(tokenize(t.reserveConfirm), w.fonts, AMBER_SIZE, contentW - PAD * 2 - 20);

  const AMBER_BORDER = rgb(0.87, 0.62, 0.18);
  const AMBER_BG = rgb(1, 0.96, 0.87);
  const AMBER_TEXT = rgb(0.5, 0.32, 0.04);
  const GREEN_BG = rgb(0.902, 0.957, 0.918);
  const GREEN = rgb(0.114, 0.478, 0.298);
  const BOX_BG = rgb(0.965, 0.972, 0.984);
  const BOX_BORDER = rgb(0.78, 0.84, 0.92);

  // ── measure every section's height up front, from the same numbers used to draw it ──
  const headerH = 14 + 18 + 14 + 18; // title offset + gap + subtitle gap + divider gap
  const leftColH = 20 + bulletWrapped.reduce((sum, lines) => sum + lines.length * LEAD + 5, 0);
  const rightColH = 18 + 26 + 18 + t.paymentMethods.length * 15 + 10;
  const bodyH = Math.max(leftColH, rightColH);
  const amberInnerH = amberLines.length * AMBER_LEAD + 6 + confirmLines.length * AMBER_LEAD;
  const amberBoxH = 20 + amberInnerH;
  const totalH = PAD + headerH + bodyH + 16 + amberBoxH + PAD;

  w.ensureSpace(totalH + 10);
  const boxTop = w.y;
  const boxX = MARGIN;

  w.page.drawRectangle({
    x: boxX, y: boxTop - totalH, width: contentW, height: totalH,
    color: BOX_BG, borderColor: BOX_BORDER, borderWidth: 1,
  });

  // ── header ──
  w.y = boxTop - PAD - 14;
  const titleW = w.widthOfText(t.reserveTitle, 15, true);
  w.text(t.reserveTitle, boxX + (contentW - titleW) / 2, 15, { bold: true, color: NAVY });
  w.y -= 18;
  const subW = w.widthOfText(t.reserveSubtitle, 10.5);
  w.text(t.reserveSubtitle, boxX + (contentW - subW) / 2, 10.5, { color: MUTED });
  w.y -= 14;
  w.lineH(boxX + PAD, boxX + contentW - PAD, w.y, LINE, 0.75);
  w.y -= 18;

  // ── left column: deposit bullet list ──
  const colTop = w.y;
  const leftX = boxX + PAD;
  w.text(t.depositIntro, leftX, BODY_SIZE, { bold: true, color: INK });
  w.y -= 20;
  for (const lines of bulletWrapped) {
    lines.forEach((line, i) => {
      if (i === 0) w.text("•", leftX, BODY_SIZE, { color: GOLD });
      w.drawTokenLine(line, leftX + 12, BODY_SIZE, INK);
      w.y -= LEAD;
    });
    w.y -= 5;
  }

  // ── right column: green deposit-amount box ──
  const rightX = leftX + leftW + COL_GAP;
  const rightTop = colTop;
  w.page.drawRectangle({
    x: rightX, y: rightTop - rightColH, width: RIGHT_W, height: rightColH,
    color: GREEN_BG, borderColor: GREEN, borderWidth: 1,
  });
  w.y = rightTop - 18;
  const labelW = w.widthOfText(t.depositAmountLabel.toUpperCase(), 9.5, true);
  w.text(t.depositAmountLabel.toUpperCase(), rightX + (RIGHT_W - labelW) / 2, 9.5, { bold: true, color: GREEN });
  w.y -= 26;
  const amountStr = money(DEPOSIT_AMOUNT, currency);
  const amountW = w.widthOfText(amountStr, 22, true);
  w.text(amountStr, rightX + (RIGHT_W - amountW) / 2, 22, { bold: true, color: GREEN });
  w.y -= 18;
  for (const method of t.paymentMethods) {
    const mW = w.widthOfText(method, 9.5);
    w.text(method, rightX + (RIGHT_W - mW) / 2, 9.5, { color: rgb(0.2, 0.35, 0.27) });
    w.y -= 15;
  }

  // ── amber "limited time" notice, full width, below both columns ──
  const amberTop = colTop - bodyH - 16;
  w.page.drawRectangle({
    x: leftX, y: amberTop - amberBoxH, width: contentW - PAD * 2, height: amberBoxH,
    color: AMBER_BG, borderColor: AMBER_BORDER, borderWidth: 1,
  });
  w.y = amberTop - 14;
  for (const line of amberLines) {
    w.drawTokenLine(line, leftX + 10, AMBER_SIZE, AMBER_TEXT);
    w.y -= AMBER_LEAD;
  }
  w.y -= 6;
  for (const line of confirmLines) {
    w.drawTokenLine(line, leftX + 10, AMBER_SIZE, AMBER_TEXT);
    w.y -= AMBER_LEAD;
  }

  w.y = boxTop - totalH - 10;
}

function wrapText(text: string, fonts: FontSet, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (widthOfMixedText(candidate, fonts, size, false) <= maxW) cur = candidate;
    else { if (cur) lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}
