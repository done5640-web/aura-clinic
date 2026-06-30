import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";

export interface QuoteItem {
  section: string;
  service: string;
  qty: string;
  unit_price: string;
  total: string;
}

export interface PreventivData {
  clinicName: string;
  clinicPhone?: string | null;
  clinicEmail?: string | null;
  clinicWebsite?: string | null;
  clinicAddress?: string | null;
  patientName: string;
  date: string; // already formatted, e.g. 30.06.2026
  items: QuoteItem[];
  currency?: string;
  notes?: string | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;

const INK = rgb(0.13, 0.12, 0.11);          // near-black warm ink
const MUTED = rgb(0.45, 0.43, 0.4);
const GOLD = rgb(0.72, 0.55, 0.18);          // accent matching sidebar amber
const GOLD_LIGHT = rgb(0.97, 0.94, 0.86);
const LINE = rgb(0.85, 0.83, 0.79);
const SECTION_BG = rgb(0.96, 0.95, 0.93);
const WHITE = rgb(1, 1, 1);

function money(v: string | number, currency: string) {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (!isFinite(n)) return String(v);
  const symbol = currency === "EUR" ? "€" : currency;
  return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
}

export async function generatePreventivPdf(data: PreventivData): Promise<Uint8Array> {
  const w = new Writer();
  await w.init();
  const currency = data.currency ?? "EUR";
  const contentW = PAGE_W - MARGIN * 2;

  // ── Header band ──
  w.rect(0, PAGE_H - 110, PAGE_W, 110, INK);
  w.y = PAGE_H - 46;
  w.text(data.clinicName.toUpperCase(), MARGIN, 20, { font: w.bold, color: WHITE });
  w.y -= 18;
  const subParts = [data.clinicAddress, data.clinicPhone, data.clinicEmail].filter(Boolean);
  if (subParts.length) {
    w.text(subParts.join("   ·   "), MARGIN, 8.5, { color: rgb(0.85, 0.85, 0.85) });
  }
  w.y = PAGE_H - 46;
  w.textRight("QUOTE", PAGE_W - MARGIN, 18, { font: w.bold, color: GOLD });

  w.y = PAGE_H - 140;

  // ── Patient / Date block ──
  w.text("PATIENT", MARGIN, 8, { font: w.bold, color: MUTED });
  w.text("DATE", PAGE_W / 2, 8, { font: w.bold, color: MUTED });
  w.y -= 16;
  w.text(data.patientName, MARGIN, 13, { font: w.bold });
  w.text(data.date, PAGE_W / 2, 13, { font: w.bold });
  w.y -= 18;
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, GOLD, 1.4);
  w.y -= 24;

  // ── Table columns ── numeric columns are right edges so values never overflow
  const TABLE_RIGHT_PAD = 10;
  const colService = MARGIN;
  const colQtyRight = MARGIN + contentW - 190;
  const colUnitRight = MARGIN + contentW - 95;
  const colTotalRight = MARGIN + contentW - TABLE_RIGHT_PAD;
  const colServiceMaxX = colQtyRight - 50; // leave room for the qty column

  const drawTableHeader = () => {
    w.rect(MARGIN, w.y - 6, contentW, 22, INK);
    w.text("SERVICE", colService + 8, 8.5, { font: w.bold, color: WHITE });
    w.textRight("QTY", colQtyRight, 8.5, { font: w.bold, color: WHITE });
    w.textRight("PRICE", colUnitRight, 8.5, { font: w.bold, color: WHITE });
    w.textRight("TOTAL", colTotalRight, 8.5, { font: w.bold, color: WHITE });
    w.y -= 22;
  };

  const drawSectionHeader = (label: string) => {
    w.ensureSpace(24);
    const bandH = 20;
    w.rect(MARGIN, w.y - bandH, contentW, bandH, SECTION_BG);
    w.y -= bandH - 7;
    w.text(label.toUpperCase(), colService + 8, 6, { font: w.bold, color: GOLD });
    w.y -= 7;
  };

  // group items by section, preserving order of first appearance
  const sections: { name: string; items: QuoteItem[] }[] = [];
  for (const it of data.items) {
    const key = it.section || "Services";
    let sec = sections.find((s) => s.name === key);
    if (!sec) { sec = { name: key, items: [] }; sections.push(sec); }
    sec.items.push(it);
  }

  w.ensureSpace(40);
  drawTableHeader();

  let grandTotal = 0;
  let zebraIdx = 0;
  const LINE_GAP = 12;       // gap between wrapped lines within a cell
  const ROW_VPAD = 9;        // vertical padding above + below text block, each side
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
        if (w.font.widthOfTextAtSize(candidate, 9.5) <= maxServiceW) cur = candidate;
        else { if (cur) serviceLines.push(cur); cur = word; }
      }
      if (cur) serviceLines.push(cur);
      if (serviceLines.length === 0) serviceLines.push(it.service);

      // total row height = padding + text block height (text baseline-to-baseline)
      const textBlockH = (serviceLines.length - 1) * LINE_GAP;
      const rowH = ROW_VPAD * 2 + textBlockH + 8; // +8 ~ cap height above first baseline

      w.ensureSpace(rowH + 4);
      const rowTopY = w.y;
      const firstBaselineY = rowTopY - ROW_VPAD - 8;

      // zebra band spans the exact same box the text is drawn inside
      if (zebraIdx % 2 === 1) w.rect(MARGIN, rowTopY - rowH, contentW, rowH, ZEBRA_BG);
      zebraIdx++;

      w.y = firstBaselineY;
      w.text(serviceLines[0], colService + 8, 7.5);
      w.textRight(it.qty || "1", colQtyRight, 7.5);
      w.textRight(money(it.unit_price, currency), colUnitRight, 7.5);
      w.textRight(money(it.total, currency), colTotalRight, 7.5, { font: w.bold });

      // remaining wrapped lines, each on its own line beneath the first
      for (let i = 1; i < serviceLines.length; i++) {
        w.y = firstBaselineY - i * LINE_GAP;
        w.text(serviceLines[i], colService + 8, 7.5);
      }

      const n = Number(String(it.total).replace(/[^0-9.-]/g, ""));
      if (isFinite(n)) grandTotal += n;

      w.y = rowTopY - rowH;
    }
  }

  // thin rule closing off the table
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, LINE, 0.75);

  // ── Total ── box sits entirely below the closing rule, with a clear gap
  const TOTAL_GAP = 14;   // space between table rule and total box
  const totalBoxH = 28;
  w.ensureSpace(TOTAL_GAP + totalBoxH + 10);
  const totalBoxTop = w.y - TOTAL_GAP;
  const totalBoxW = 220;
  const totalBoxX = MARGIN + contentW - totalBoxW;
  w.rect(totalBoxX, totalBoxTop - totalBoxH, totalBoxW, totalBoxH, INK);
  w.y = totalBoxTop - totalBoxH / 2 - 3; // vertically center the label/value in the box
  w.text("TOTAL", totalBoxX + 14, 6, { font: w.bold, color: WHITE });
  w.textRight(money(grandTotal, currency), colTotalRight - 14, 6, { font: w.bold, color: GOLD });
  w.y = totalBoxTop - totalBoxH - 12;

  if (data.notes && data.notes.trim()) {
    w.ensureSpace(40);
    w.text("NOTES", MARGIN, 8, { font: w.bold, color: MUTED });
    w.y -= 14;
    const noteLines = wrapText(data.notes, w.font, 9, contentW);
    for (const line of noteLines) {
      w.ensureSpace(13);
      w.text(line, MARGIN, 9);
      w.y -= 13;
    }
    w.y -= 8;
  }

  // ── Footer informational sections ──
  w.ensureSpace(150);
  w.y -= 6;
  w.lineH(MARGIN, PAGE_W - MARGIN, w.y, LINE);
  w.y -= 20;

  const footerSection = (title: string, lines: string[]) => {
    w.ensureSpace(16 + lines.length * 12);
    w.text(title.toUpperCase(), MARGIN, 9, { font: w.bold, color: GOLD });
    w.y -= 14;
    for (const line of lines) {
      const wrapped = wrapText(line, w.font, 8.5, contentW);
      for (const wl of wrapped) {
        w.ensureSpace(12);
        w.text(wl, MARGIN, 8.5, { color: MUTED });
        w.y -= 11.5;
      }
    }
    w.y -= 10;
  };

  footerSection("Warranty", [
    "All our interventions are guaranteed. The guarantee covers the costs of a new intervention, free, therefore entirely paid by the clinic.",
    "In case of problems, the patient will only have to cover travel expenses. The guarantee is valid in the event of compliance with all the instructions received from our medical staff.",
    "The dental products we use are top-quality. We operate in compliance with international dental protocols and strict hygiene regulations (ISO 9001 Standard).",
    "We can demonstrate the origin of the materials through the implant passport and traceability document.",
  ]);

  footerSection("Payment", [
    "You can pay in cash, with POS directly in the clinic (a 3% commission is charged), or by bank transfer.",
    "In the latter case, it is necessary to inform your own bank of the intention to make a transfer from Albania, so that there are no unpleasant inconveniences, blocking, or various restrictions regarding the issuing of a bank transfer via mobile application from abroad (Albania).",
    "Checks and American Express are not accepted.",
  ]);

  footerSection("Services Included in the Package", [
    "Accommodation   ·   Airport pick-up and drop-off service   ·   Assistance throughout the entire stay",
    "Final consultation and check-up   ·   Certified CE products (European standards)   ·   Written guarantee with implant passport",
  ]);

  // Footer contact bar on last page
  const contactParts = [data.clinicPhone, data.clinicEmail, data.clinicWebsite].filter(Boolean);
  if (contactParts.length) {
    w.page.drawText(contactParts.join("   ·   "), {
      x: MARGIN, y: 28, size: 8, font: w.font, color: MUTED,
    });
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
