// src/app/api/invoices/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function sanitizeFileName(name: string) {
  const base = safeStr(name || "invoice").trim();
  return base
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function formatMoney(eur: number, currency = "EUR", locale = "de-DE") {
  const n = Number(eur ?? 0);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function formatDate(d?: string | null, locale = "de-DE") {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 10);
  }
}

function joinLine(...parts: Array<string | null | undefined>) {
  return parts.map((p) => safeStr(p).trim()).filter(Boolean).join(" ");
}

function drawRightText(page: any, text: string, xRight: number, y: number, size: number, font: any, color = rgb(0, 0, 0)) {
  const t = safeStr(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: xRight - w, y, size, font, color });
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number) {
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(w, fontSize) > maxWidth) {
        let chunk = "";
        for (const ch of w) {
          const test2 = chunk + ch;
          if (font.widthOfTextAtSize(test2, fontSize) <= maxWidth) chunk = test2;
          else {
            if (chunk) lines.push(chunk + "–");
            chunk = ch;
          }
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
}

function clampPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

type PdfItem = {
  kind: "service" | "product";
  title: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_percent: number;
  markup_percent: number;
};

async function buildInvoicePdf(input: {
  invoiceNumber: string;
  issuedAt: string | null;
  currency: string;
  locale: string;

  business: {
    legal_name?: string | null;
    trade_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;

    email?: string | null;
    phone?: string | null;
    website?: string | null;

    vat_id?: string | null;
    tax_id?: string | null;

    iban?: string | null;
    bic?: string | null;
    bank_name?: string | null;
  };

  client: {
    name: string;
    address_lines: string[];
  };

  items: PdfItem[];
  totals: { subtotal: number; tax_total: number; total: number };

  subtotalsByKind: { services: number; products: number };

  footer?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const margin = 48;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.40, 0.40, 0.40);
  const light = rgb(0.92, 0.92, 0.92);
  const headerBg = rgb(0.97, 0.97, 0.97);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - margin;

  const tableX = margin;
  const tableW = PAGE_W - margin * 2;

  // columns
  const xItem = tableX + 0;
  const xQtyR = tableX + tableW - 220;
  const xUnitR = tableX + tableW - 120;
  const xTotalR = tableX + tableW;

  const titleFont = 10.5;
  const subFont = 9.2;
  const itemMaxWidth = (xQtyR - 18) - xItem;

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - margin;
    drawHeader(true);
    drawTableHeader();
  }

  function drawHeader(isCont = false) {
    const businessName = safeStr(input.business.trade_name || input.business.legal_name).trim() || "—";

    page.drawText(businessName, { x: margin, y, size: 16, font: fontBold, color: black });
    drawRightText(page, isCont ? "INVOICE (cont.)" : "INVOICE", PAGE_W - margin, y, 16, fontBold, black);
    y -= 18;

    const contactParts = [
      safeStr(input.business.website).trim(),
      safeStr(input.business.email).trim(),
      safeStr(input.business.phone).trim(),
    ].filter(Boolean);

    if (contactParts.length) {
      page.drawText(contactParts.join(" • "), { x: margin, y, size: 9.2, font, color: gray });
      y -= 14;
    } else {
      y -= 8;
    }

    const invNo = safeStr(input.invoiceNumber).trim() || "—";
    drawRightText(page, "Invoice #", PAGE_W - margin, y, 9.2, font, gray);
    y -= 12;
    drawRightText(page, invNo, PAGE_W - margin, y, 12, fontBold, black);
    y -= 16;

    drawRightText(page, "Issued", PAGE_W - margin, y, 9.2, font, gray);
    y -= 12;
    drawRightText(page, formatDate(input.issuedAt, input.locale), PAGE_W - margin, y, 10.5, font, black);
    y -= 14;

    page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 1, color: light });
    y -= 18;

    const colGap = 32;
    const colW = (PAGE_W - margin * 2 - colGap) / 2;

    const fromLines = [
      safeStr(input.business.address_line1).trim(),
      safeStr(input.business.address_line2).trim(),
      joinLine(input.business.postal_code, input.business.city),
      safeStr(input.business.country).trim(),
    ].filter(Boolean);

    const billToLines = [safeStr(input.client.name).trim() || "—", ...(input.client.address_lines ?? [])]
      .map((l) => safeStr(l).trim())
      .filter(Boolean);

    page.drawText("From", { x: margin, y, size: 9.5, font: fontBold, color: gray });
    page.drawText("Bill To", { x: margin + colW + colGap, y, size: 9.5, font: fontBold, color: gray });
    y -= 12;

    const startY = y;
    let yL = startY;
    for (const line of fromLines) {
      page.drawText(line, { x: margin, y: yL, size: 10.2, font, color: black });
      yL -= 12.5;
    }

    let yR = startY;
    for (const line of billToLines) {
      page.drawText(line, { x: margin + colW + colGap, y: yR, size: 10.2, font, color: black });
      yR -= 12.5;
    }

    y = Math.min(yL, yR) - 14;

    page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 1, color: light });
    y -= 14;
  }

  function drawTableHeader() {
    page.drawRectangle({
      x: tableX,
      y: y - 14,
      width: tableW,
      height: 20,
      color: headerBg,
      borderColor: light,
      borderWidth: 0,
    });

    const headerY = y - 9;
    page.drawText("Item", { x: xItem, y: headerY, size: 9.5, font: fontBold, color: gray });
    drawRightText(page, "Qty", xQtyR, headerY, 9.5, fontBold, gray);
    drawRightText(page, "Unit", xUnitR, headerY, 9.5, fontBold, gray);
    drawRightText(page, "Total", xTotalR, headerY, 9.5, fontBold, gray);

    y -= 26;
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 1, color: light });
    y -= 12;
  }

  function drawSectionHeader(label: string) {
    // keep space
    if (y < 240) newPage();

    page.drawText(label, { x: xItem, y, size: 10.0, font: fontBold, color: gray });
    y -= 12;
  }

  function drawSubtotalRow(label: string, amount: number) {
    if (y < 220) newPage();

    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 1, color: light });
    y -= 14;

    page.drawText(label, { x: xItem, y, size: 10.0, font: fontBold, color: gray });
    drawRightText(page, formatMoney(amount, input.currency, input.locale), xTotalR, y, 10.0, fontBold, black);
    y -= 18;
  }

  // start
  drawHeader(false);
  drawTableHeader();

  // items grouped by kind
  const items = input.items ?? [];
  const ordered = [...items].sort((a, b) => {
    const ak = a.kind === "product" ? 1 : 0;
    const bk = b.kind === "product" ? 1 : 0;
    return ak - bk;
  });

  let currentKind: "service" | "product" | null = null;
  let runningSubtotal = 0;

  for (const it of ordered) {
    const kind = it.kind ?? "service";

    if (currentKind !== kind) {
      if (currentKind === "service") drawSubtotalRow("Services Subtotal", input.subtotalsByKind.services);
      if (currentKind === "product") drawSubtotalRow("Products Subtotal", input.subtotalsByKind.products);

      currentKind = kind;
      runningSubtotal = 0;

      drawSectionHeader(kind === "product" ? "Products" : "Services");
    }

    const title = safeStr(it.title || "Item").trim() || "Item";
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unit_price ?? 0);
    const lineTotal = Number(it.line_total ?? 0);

    const taxPct = clampPct(it.tax_percent);
    const markupPct = clampPct(it.markup_percent);

    const metaParts: string[] = [];
    metaParts.push(`${qty} × ${formatMoney(unit, input.currency, input.locale)}`);
    if (taxPct > 0) metaParts.push(`(${taxPct}% tax)`);
    if (markupPct > 0) metaParts.push(`(+${markupPct}% markup)`);
    const metaLine = metaParts.join(" ");

    const titleLines = wrapText(title, itemMaxWidth, font, titleFont).slice(0, 2);
    const metaLines = wrapText(metaLine, itemMaxWidth, font, subFont).slice(0, 1);

    const rowHeight = Math.max(18, titleLines.length * 12.8 + metaLines.length * 11.5);

    // keep room for totals block
    if (y - rowHeight < 210) newPage();

    // title lines
    let yy = y;
    for (const ln of titleLines) {
      page.drawText(ln, { x: xItem, y: yy, size: titleFont, font, color: black });
      yy -= 12.8;
    }

    // meta line (subtle)
    if (metaLines.length) {
      page.drawText(metaLines[0], { x: xItem, y: yy, size: subFont, font, color: rgb(0.55, 0.55, 0.55) });
      yy -= 11.5;
    }

    drawRightText(page, String(qty), xQtyR, y, titleFont, font, black);
    drawRightText(page, formatMoney(unit, input.currency, input.locale), xUnitR, y, titleFont, font, black);
    drawRightText(page, formatMoney(lineTotal, input.currency, input.locale), xTotalR, y, titleFont, font, black);

    y -= rowHeight + 6;
    runningSubtotal += lineTotal;
  }

  // final subtotal for last group
  if (currentKind === "service") drawSubtotalRow("Services Subtotal", input.subtotalsByKind.services);
  if (currentKind === "product") drawSubtotalRow("Products Subtotal", input.subtotalsByKind.products);

  // totals block
  const labelX = tableX + tableW - 220;
  const valueXR = tableX + tableW;

  page.drawText("Subtotal", { x: labelX, y, size: 10.2, font, color: gray });
  drawRightText(page, formatMoney(input.totals.subtotal, input.currency, input.locale), valueXR, y, 10.2, font, black);
  y -= 14;

  page.drawText("Tax", { x: labelX, y, size: 10.2, font, color: gray });
  drawRightText(page, formatMoney(input.totals.tax_total, input.currency, input.locale), valueXR, y, 10.2, font, black);
  y -= 18;

  page.drawText("Total", { x: labelX, y, size: 12.5, font: fontBold, color: black });
  drawRightText(page, formatMoney(input.totals.total, input.currency, input.locale), valueXR, y, 12.5, fontBold, black);

  // footer
  const footerY = 72;
  const footerParts: string[] = [];

  const extraFooter = safeStr(input.footer).trim();
  if (extraFooter) footerParts.push(extraFooter);

  const iban = safeStr(input.business.iban).trim();
  const bic = safeStr(input.business.bic).trim();
  const bank = safeStr(input.business.bank_name).trim();
  const vat = safeStr(input.business.vat_id).trim();
  const taxId = safeStr(input.business.tax_id).trim();

  const payLine = [bank ? `Bank: ${bank}` : "", iban ? `IBAN: ${iban}` : "", bic ? `BIC: ${bic}` : ""].filter(Boolean).join("   ");
  const idsLine = [vat ? `VAT ID: ${vat}` : "", taxId ? `Tax ID: ${taxId}` : ""].filter(Boolean).join(" • ");

  if (payLine) footerParts.push(payLine);
  if (idsLine) footerParts.push(idsLine);

  const footerText = footerParts.filter(Boolean).join("\n").trim();
  if (footerText) {
    page.drawLine({
      start: { x: margin, y: footerY + 20 },
      end: { x: PAGE_W - margin, y: footerY + 20 },
      thickness: 1,
      color: light,
    });

    const lines = footerText.split("\n").slice(0, 5);
    let yy = footerY;
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y: yy, size: 9.0, font, color: rgb(0.35, 0.35, 0.35) });
      yy -= 12;
    }
  }

  return await pdf.save();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { data: inv, error: invErr } = await sb
      .from("invoices")
      .select("id, owner_id, business_profile_id, client_id, invoice_number, issued_at, currency, subtotal, tax_total, total")
      .eq("id", id)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: items, error: itErr } = await sb
      .from("invoice_items")
      .select("title, quantity, unit_price, line_total, tax_percent, markup_percent, kind")
      .eq("invoice_id", id)
      .order("id", { ascending: true });

    if (itErr) {
      return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
    }

    // locale
    const bpId = (inv.business_profile_id as string | null) ?? null;
    let locale = "de-DE";
    if (bpId) {
      const { data: bp } = await sb.from("business_profiles").select("locale").eq("id", bpId).maybeSingle();
      if (bp?.locale) locale = String(bp.locale);
    }

    // business info + settings
    let businessInfo: any = {};
    let footer: string | null = null;

    if (bpId) {
      const { data: bi } = await sb.from("business_info").select("*").eq("business_profile_id", bpId).maybeSingle();
      if (bi) businessInfo = bi;

      const { data: iset } = await sb
        .from("invoice_settings")
        .select("default_footer")
        .eq("business_profile_id", bpId)
        .maybeSingle();

      footer = (iset?.default_footer ?? null) as any;
    }

    // client
    let clientName = "—";
    const clientAddressLines: string[] = [];

    if (inv.client_id) {
      const { data: c } = await sb
        .from("clients")
        .select("first_name, last_name, billing_street, billing_house_number, billing_postal_code, billing_city, billing_country")
        .eq("id", inv.client_id)
        .maybeSingle();

      const full = `${safeStr(c?.first_name).trim()} ${safeStr(c?.last_name).trim()}`.trim();
      if (full) clientName = full;

      const streetLine = joinLine(c?.billing_street, c?.billing_house_number);
      const cityLine = joinLine(c?.billing_postal_code, c?.billing_city);
      const countryLine = safeStr(c?.billing_country).trim();

      if (streetLine) clientAddressLines.push(streetLine);
      if (cityLine) clientAddressLines.push(cityLine);
      if (countryLine) clientAddressLines.push(countryLine);
    }

    const currency = safeStr(inv.currency).trim() || "EUR";

    const mappedItems: PdfItem[] = (items ?? []).map((it: any) => {
      const qty = Number(it.quantity ?? 0);
      const unit = Number(it.unit_price ?? 0);
      const lt =
        it.line_total != null
          ? Number(it.line_total)
          : qty * unit;

      const kindRaw = safeStr(it.kind).trim().toLowerCase();
      const kind: "service" | "product" = kindRaw === "product" ? "product" : "service";

      return {
        kind,
        title: safeStr(it.title || "Item"),
        quantity: qty,
        unit_price: unit,
        line_total: lt,
        tax_percent: clampPct(it.tax_percent),
        markup_percent: clampPct(it.markup_percent),
      };
    });

    const servicesSubtotal = mappedItems
      .filter((x) => x.kind === "service")
      .reduce((s, x) => s + Number(x.line_total ?? 0), 0);

    const productsSubtotal = mappedItems
      .filter((x) => x.kind === "product")
      .reduce((s, x) => s + Number(x.line_total ?? 0), 0);

    const pdfBytes = await buildInvoicePdf({
      invoiceNumber: safeStr(inv.invoice_number),
      issuedAt: inv.issued_at,
      currency,
      locale,
      business: businessInfo,
      client: { name: clientName, address_lines: clientAddressLines },
      items: mappedItems,
      subtotalsByKind: {
        services: servicesSubtotal,
        products: productsSubtotal,
      },
      totals: {
        subtotal: Number(inv.subtotal ?? 0),
        tax_total: Number(inv.tax_total ?? 0),
        total: Number(inv.total ?? 0),
      },
      footer,
    });

    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";

    const rawName = safeStr(inv.invoice_number || "invoice");
    const safeName = sanitizeFileName(rawName);
    const fileName = `${safeName}.pdf`;
    const encoded = encodeURIComponent(fileName);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (e: any) {
    console.error("[pdf route] failed:", e?.message ?? e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}