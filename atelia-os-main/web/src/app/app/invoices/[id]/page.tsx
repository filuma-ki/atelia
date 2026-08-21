"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Download, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import InvoiceFormModal, { InvoiceDraft } from "@/components/invoices/InvoiceFormModal";
import { LS_ACTIVE_BP } from "@/components/settings/settingsTypes";

type InvoiceStatus = "open" | "paid";

type InvoiceRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issued_at: string | null; // YYYY-MM-DD
  currency: string | null;
  subtotal: number | null; // EUR
  tax_total: number | null; // EUR
  total: number | null; // EUR
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;

  business_profile_id?: string | null;
  project_id?: string | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  kind: string | null;
  title: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null; // EUR
  tax_percent: number | null;
  line_total: number | null; // EUR (NET)
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatMoneyEURFromNumber(eur: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eur);
}

function formatDateLongFromISO(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(dt);
}

function safeFullName(first?: unknown, last?: unknown) {
  const f = String(first ?? "").trim();
  const l = String(last ?? "").trim();
  const full = `${f} ${l}`.trim();
  return full || "—";
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const isPaid = status === "paid";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1",
        "text-[12px] font-light leading-none",
        isPaid
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      )}
    >
      {isPaid ? "Paid" : "Open"}
    </span>
  );
}

function parseEuroToCents(input: string) {
  const s = (input ?? "").trim();
  if (!s) return 0;
  const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function euroToInputText(eur: number) {
  const n = Number(eur ?? 0);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function safePct(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Resolve business_profile_id safely
async function resolveBusinessProfileId(opts: { ownerId: string; projectId?: string | null }) {
  // 1) project -> use project's business_profile_id
  if (opts.projectId) {
    const { data: p, error: pErr } = await supabase
      .from("projects")
      .select("business_profile_id")
      .eq("id", opts.projectId)
      .eq("owner_id", opts.ownerId)
      .single();

    if (!pErr && p?.business_profile_id) return String(p.business_profile_id);
  }

  // 2) manual -> active from localStorage (and verify it belongs to owner)
  const lsId = typeof window !== "undefined" ? window.localStorage.getItem(LS_ACTIVE_BP) : null;
  if (lsId) {
    const { data: bp, error: bpErr } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("id", lsId)
      .eq("owner_id", opts.ownerId)
      .single();

    if (!bpErr && bp?.id) return String(bp.id);
  }

  // 3) fallback -> first business profile
  const { data: first, error: fErr } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", opts.ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fErr && first?.id) return String(first.id);

  return null;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [clientName, setClientName] = useState<string>("—");

  const [editOpen, setEditOpen] = useState(false);

  async function load() {
    setLoading(true);
    setNotFound(false);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = auth.user;
      if (!user) {
        setNotFound(true);
        return;
      }

      if (!invoiceId) {
        setNotFound(true);
        return;
      }

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select(
          "id, owner_id, client_id, invoice_number, status, issued_at, currency, subtotal, tax_total, total, notes, created_at, updated_at, business_profile_id, project_id"
        )
        .eq("id", invoiceId)
        .eq("owner_id", user.id)
        .single();

      if (invErr) {
        setNotFound(true);
        return;
      }

      const invRow = inv as any as InvoiceRow;
      setInvoice(invRow);

      const { data: it, error: itErr } = await supabase
        .from("invoice_items")
        .select("id, invoice_id, kind, title, description, quantity, unit_price, tax_percent, line_total")
        .eq("invoice_id", invRow.id)
        .order("id", { ascending: true });

      if (!itErr && Array.isArray(it)) setItems(it as any as InvoiceItemRow[]);
      else setItems([]);

      if (invRow.client_id) {
        const { data: c, error: cErr } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .eq("id", invRow.client_id)
          .single();

        if (!cErr && c) {
          const cr = c as any as ClientRow;
          setClientName(safeFullName(cr.first_name, cr.last_name));
        } else {
          setClientName("—");
        }
      } else {
        setClientName("—");
      }
    } catch (e) {
      console.error("[InvoiceDetailPage] load failed:", e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const subtotalEUR = useMemo(() => Number(invoice?.subtotal ?? 0), [invoice]);
  const taxEUR = useMemo(() => Number(invoice?.tax_total ?? 0), [invoice]);
  const totalEUR = useMemo(() => Number(invoice?.total ?? 0), [invoice]);

  const modalInitial = useMemo(() => {
    if (!invoice) return { number: "", client_id: "", status: "open", line_items: [], notes: "" } satisfies Partial<InvoiceDraft>;

    const line_items =
      items.length > 0
        ? items.map((it) => ({
            id: String(it.id ?? crypto.randomUUID()),
            description: (it.title ?? "").trim() || "Item",
            qty: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
            unit_price_text: euroToInputText(Number(it.unit_price ?? 0)),
            // ✅ DB -> UI
            tax_pct: safePct(it.tax_percent),
          }))
        : [{ id: crypto.randomUUID(), description: "", qty: 1, unit_price_text: "", tax_pct: 0 }];

    return {
      number: String(invoice.invoice_number ?? "").trim(),
      client_id: invoice.client_id ? String(invoice.client_id) : "",
      status: invoice.status ?? "open",
      line_items,
      notes: invoice.notes ?? "",
    } satisfies Partial<InvoiceDraft>;
  }, [invoice, items]);

  async function saveEdit(draft: InvoiceDraft) {
    try {
      const subtotalCents = (draft.line_items ?? []).reduce((sum, it: any) => {
        const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
        const unit = parseEuroToCents(it.unit_price_text ?? "");
        return sum + qty * unit; // NET
      }, 0);

      const taxCents = (draft.line_items ?? []).reduce((sum, it: any) => {
        const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
        const unit = parseEuroToCents(it.unit_price_text ?? "");
        const taxPct = safePct(it.tax_pct);
        const lineNet = qty * unit;
        return sum + Math.round(lineNet * (taxPct / 100));
      }, 0);

      const totalCents = subtotalCents + taxCents;

      const nextSubtotalEUR = subtotalCents / 100;
      const nextTaxEUR = taxCents / 100;
      const nextTotalEUR = totalCents / 100;

      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Not authenticated");
      if (!invoice) throw new Error("Invoice not loaded");

      // projectId: prefer invoice.project_id, fallback to ?project=
      const projectIdFromQuery = searchParams.get("project");
      const projectId =
        (invoice.project_id ? String(invoice.project_id) : null) ??
        (projectIdFromQuery ? String(projectIdFromQuery) : null);

      // business_profile_id: prefer invoice.business_profile_id; else resolve
      const bpId =
        (invoice.business_profile_id ? String(invoice.business_profile_id) : null) ??
        (await resolveBusinessProfileId({
          ownerId: user.id,
          projectId,
        }));

      if (!bpId) throw new Error("No business profile found for invoice.");

      // currency: keep existing, else from bp, else EUR
      let currency = String(invoice.currency ?? "").trim() || "EUR";
      if (!currency) currency = "EUR";
      if (!invoice.currency) {
        try {
          const { data: bpRow } = await supabase
            .from("business_profiles")
            .select("currency")
            .eq("id", bpId)
            .eq("owner_id", user.id)
            .single();

          if (bpRow?.currency) currency = String(bpRow.currency);
        } catch {
          // keep default
        }
      }

      const invoiceRow: any = {
        owner_id: user.id,
        business_profile_id: bpId,
        project_id: projectId,
        invoice_number: draft.number.trim(),
        client_id: draft.client_id ? draft.client_id : null,
        status: draft.status,
        issued_at: new Date().toISOString().slice(0, 10),
        currency,
        subtotal: nextSubtotalEUR,
        tax_total: nextTaxEUR,
        total: nextTotalEUR,
        notes: draft.notes?.trim() ? draft.notes.trim() : null,
        updated_at: new Date().toISOString(),
      };

      const idToUpdate = invoice.id;

      const { error: upErr } = await supabase
        .from("invoices")
        .update(invoiceRow)
        .eq("id", idToUpdate)
        .eq("owner_id", user.id);

      if (upErr) throw upErr;

      await supabase.from("invoice_items").delete().eq("invoice_id", idToUpdate);

      const newItems = (draft.line_items ?? []).map((it: any) => {
        const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 1;
        const unitCents = parseEuroToCents(it.unit_price_text ?? "");
        const unitEUR = unitCents / 100;

        const taxPct = safePct(it.tax_pct);
        const lineNetEUR = (qty * unitCents) / 100; // NET

        return {
          invoice_id: idToUpdate,
          kind: "service",
          title: (it.description ?? "").trim() || "Item",
          description: null,
          quantity: qty,
          unit_price: unitEUR,
          // ✅ UI -> DB
          tax_percent: taxPct,
          line_total: lineNetEUR,
        };
      });

      if (newItems.length > 0) {
        const { error: insErr } = await supabase.from("invoice_items").insert(newItems);
        if (insErr) throw insErr;
      }

      setEditOpen(false);
      await load();
    } catch (e) {
      console.error("[InvoiceDetailPage] edit save failed:", e);
      alert("Save failed — check console.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="w-full px-10 pt-10">
          <div className="text-[13px] font-light text-neutral-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="w-full px-10 pt-10">
          <button
            onClick={() => router.push("/app/invoices")}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
          >
            <ArrowLeft size={16} />
            Back to invoices
          </button>

          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-8">
            <div className="text-[18px] font-medium text-neutral-900">Invoice not found</div>
            <div className="mt-2 text-[13px] font-light text-neutral-500">
              Either this invoice doesn’t exist, or you don’t have access.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border-color: #e5e5e5 !important; }
        }
      `}</style>

      <div className="w-full px-10 pt-10">
        <div className="no-print flex items-center justify-between">
          <button
            onClick={() => router.push("/app/invoices")}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
            >
              <Pencil size={16} />
              Edit
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
            >
              <Printer size={16} />
              Print / Save as PDF
            </button>

            <button
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token;
                if (!token) throw new Error("Not authenticated");

                const res = await fetch(`/api/invoices/${invoice.id}/pdf?download=1`, {
                  headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                  const txt = await res.text();
                  throw new Error(`PDF failed (${res.status}): ${txt}`);
                }

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = `${invoice.invoice_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();

                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-[13px] font-light text-white hover:bg-neutral-900"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 print-card">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[28px] font-extralight tracking-tight text-neutral-950">{invoice.invoice_number}</div>
              <div className="mt-2 flex items-center gap-3">
                <StatusPill status={invoice.status} />
                <div className="text-[13px] font-light text-neutral-500">
                  Issued: {invoice.issued_at ? formatDateLongFromISO(invoice.issued_at) : "—"}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="text-[12px] font-light text-neutral-500">Client</div>
                <div className="text-[14px] font-light text-neutral-900">{clientName}</div>
              </div>

              {invoice.notes ? (
                <div className="mt-6">
                  <div className="text-[12px] font-light text-neutral-500">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap text-[13px] font-light text-neutral-800">{invoice.notes}</div>
                </div>
              ) : null}
            </div>

            <div className="w-[320px] rounded-2xl border border-neutral-200 bg-neutral-50/40 p-5">
              <div className="text-[12px] font-light text-neutral-500">Summary</div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-[13px] font-light">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="text-neutral-900">{formatMoneyEURFromNumber(subtotalEUR)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] font-light">
                  <span className="text-neutral-600">Tax</span>
                  <span className="text-neutral-900">{formatMoneyEURFromNumber(taxEUR)}</span>
                </div>
                <div className="h-px bg-neutral-200" />
                <div className="flex items-center justify-between text-[14px] font-light">
                  <span className="text-neutral-900">Total</span>
                  <span className="text-neutral-950">{formatMoneyEURFromNumber(totalEUR)}</span>
                </div>
              </div>

              <div className="mt-4 text-[12px] font-light text-neutral-500">
                Updated: {invoice.updated_at ? formatDateLongFromISO(invoice.updated_at) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-10">
            <div className="text-[13px] font-light text-neutral-500">Line items</div>

            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
              <div className="grid grid-cols-[1fr_120px_140px_140px] bg-neutral-50/50 px-5 py-3">
                <div className="text-[12px] font-light text-neutral-500">Item</div>
                <div className="text-[12px] font-light text-neutral-500 text-right">Qty</div>
                <div className="text-[12px] font-light text-neutral-500 text-right">Unit</div>
                <div className="text-[12px] font-light text-neutral-500 text-right">Total</div>
              </div>

              {items.length === 0 ? (
                <div className="px-5 py-6 text-[13px] font-light text-neutral-500">No line items.</div>
              ) : (
                items.map((it) => {
                  const qty = Number(it.quantity ?? 0);
                  const unit = Number(it.unit_price ?? 0);
                  const lineNet = it.line_total != null ? Number(it.line_total) : qty * unit;

                  return (
                    <div
                      key={it.id}
                      className="grid grid-cols-[1fr_120px_140px_140px] border-t border-neutral-200 px-5 py-4"
                    >
                      <div>
                        <div className="text-[13px] font-light text-neutral-900">{(it.title ?? "").trim() || "Item"}</div>
                        {it.description ? (
                          <div className="mt-1 text-[12px] font-light text-neutral-500">{it.description}</div>
                        ) : null}
                      </div>

                      <div className="text-[13px] font-light text-neutral-700 text-right">{qty || 0}</div>
                      <div className="text-[13px] font-light text-neutral-700 text-right">{formatMoneyEURFromNumber(unit)}</div>
                      <div className="text-[13px] font-light text-neutral-900 text-right">{formatMoneyEURFromNumber(lineNet)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-8 text-[11px] font-light text-neutral-400">
            Tip: Use “Print / Save as PDF” to export a PDF via your browser dialog.
          </div>
        </div>

        <InvoiceFormModal
          open={editOpen}
          mode="edit"
          initial={modalInitial}
          onClose={() => setEditOpen(false)}
          onSaved={saveEdit}
        />
      </div>
    </div>
  );
}