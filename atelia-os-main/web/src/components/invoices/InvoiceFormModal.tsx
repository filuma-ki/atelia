"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "create" | "edit";

type ClientOption = { id: string; label: string };

export type InvoiceLineItemDraft = {
  id: string;
  description: string;
  qty: number; // >= 1
  unit_price_text: string; // "123,45" (EUR)
  tax_pct: number; // 0..100

  // ✅ Step 2: keep these around so edits don't wipe DB values
  kind?: "service" | "product";
  markup_pct?: number; // 0..100
};

export type InvoiceDraft = {
  number: string;
  client_id: string;
  status: "open" | "paid";
  line_items: InvoiceLineItemDraft[];
  notes: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-light text-neutral-900">{children}</div>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-10 w-full rounded-lg",
        "border border-neutral-200 bg-white px-3",
        "text-[13px] font-light text-neutral-900",
        "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-[92px] w-full rounded-lg",
        "border border-neutral-200 bg-white px-3 py-2",
        "text-[13px] font-light text-neutral-900 placeholder:text-neutral-400",
        "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function SelectField({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg",
          "border border-neutral-200 bg-white px-3",
          "text-[13px] font-light text-neutral-900",
          "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        ].join(" ")}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="text-neutral-400">
          <ChevronDown size={16} strokeWidth={1.25} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={[
            "z-[99999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
            "border border-neutral-200 bg-white",
            "shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
          ].join(" ")}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={[
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2",
                  "text-[13px] font-light text-neutral-900 outline-none",
                  "data-[highlighted]:bg-neutral-100",
                ].join(" ")}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center text-neutral-900">
                  <Check size={16} strokeWidth={1.25} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseEuroToCents(input: string) {
  const s = (input ?? "").trim();
  if (!s) return 0;
  const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatMoneyEUR(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function clampPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function calcLineTotalCents(it: InvoiceLineItemDraft) {
  const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
  const unit = parseEuroToCents(it.unit_price_text);

  const base = qty * unit;

  const markupPct = clampPct(it.markup_pct ?? 0);
  const markup = Math.round(base * (markupPct / 100));

  // ✅ Tax should apply to (base + markup)
  const taxPct = clampPct(it.tax_pct);
  const taxBase = base + markup;
  const tax = Math.round(taxBase * (taxPct / 100));

  return taxBase + tax;
}

function pickClientLabel(c: any): string {
  const candidates = [c?.name, c?.full_name, c?.client_name, c?.display_name, c?.company, c?.title].filter(
    (x) => typeof x === "string" && x.trim().length > 0
  ) as string[];

  if (candidates.length > 0) return candidates[0];

  const first = typeof c?.first_name === "string" ? c.first_name.trim() : "";
  const last = typeof c?.last_name === "string" ? c.last_name.trim() : "";
  const combo = `${first} ${last}`.trim();
  if (combo) return combo;

  if (typeof c?.email === "string" && c.email.trim()) return c.email.trim();
  return "Unnamed client";
}

export default function InvoiceFormModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial?: Partial<InvoiceDraft> | null;
  onClose: () => void;
  onSaved: (draft: InvoiceDraft) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);

  // clients
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // form
  const [number, setNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<"open" | "paid">("open");
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => setMounted(true), []);

  // reset on open/mode
  useEffect(() => {
    if (!open) return;

    setNumber(initial?.number ?? "");
    setClientId(initial?.client_id ?? "");
    setStatus((initial?.status as any) ?? "open");

    const initialItems = (initial?.line_items ?? [
      { id: uid(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 },
    ]) as any[];

    setLineItems(
      (initialItems ?? []).map((it) => ({
        id: String(it?.id ?? uid()),
        description: String(it?.description ?? ""),
        qty: Number.isFinite(Number(it?.qty)) ? Number(it?.qty) : 1,
        unit_price_text: String(it?.unit_price_text ?? ""),
        tax_pct: clampPct(it?.tax_pct ?? 19),

        // ✅ Step 2: preserve kind/markup even if not shown in UI
        kind: it?.kind === "product" ? "product" : "service",
        markup_pct: clampPct(it?.markup_pct ?? 0),
      }))
    );

    setNotes((initial?.notes ?? "") as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // load clients when opened
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoadingClients(true);
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) {
          if (!cancelled) setClients([]);
          return;
        }

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped: ClientOption[] = (data ?? []).map((c: any) => ({
          id: c.id,
          label: pickClientLabel(c),
        }));

        if (!cancelled) setClients(mapped);
      } catch (e) {
        console.error("Load clients failed:", e);
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.label })), [clients]);

  const statusOptions = useMemo(
    () => [
      { value: "open", label: "Open" },
      { value: "paid", label: "Paid" },
    ],
    []
  );

  // ✅ Subtotal includes markup (base + markup), but not tax
  const subtotalCents = useMemo(() => {
    return lineItems.reduce((sum, it) => {
      const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
      const unit = parseEuroToCents(it.unit_price_text);
      const base = qty * unit;

      const markupPct = clampPct(it.markup_pct ?? 0);
      const markup = Math.round(base * (markupPct / 100));

      return sum + base + markup;
    }, 0);
  }, [lineItems]);

  // ✅ Tax applies to (base + markup)
  const taxCents = useMemo(() => {
    return lineItems.reduce((sum, it) => {
      const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
      const unit = parseEuroToCents(it.unit_price_text);
      const base = qty * unit;

      const markupPct = clampPct(it.markup_pct ?? 0);
      const markup = Math.round(base * (markupPct / 100));

      const taxPct = clampPct(it.tax_pct);
      const tax = Math.round((base + markup) * (taxPct / 100));

      return sum + tax;
    }, 0);
  }, [lineItems]);

  const totalCents = useMemo(() => {
    return lineItems.reduce((sum, it) => sum + calcLineTotalCents(it), 0);
  }, [lineItems]);

  const hasValidItems = useMemo(() => {
    return lineItems.some((it) => it.description.trim() && it.qty > 0 && parseEuroToCents(it.unit_price_text) > 0);
  }, [lineItems]);

  const canSubmit = Boolean(number.trim() && clientId && hasValidItems);

  function addItem() {
    setLineItems((prev) => [
      ...prev,
      { id: uid(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 },
    ]);
  }

  function removeItem(id: string) {
    setLineItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      return next.length > 0
        ? next
        : [{ id: uid(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 }];
    });
  }

  function updateItem(id: string, patch: Partial<InvoiceLineItemDraft>) {
    setLineItems((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              ...patch,
              tax_pct: patch.tax_pct !== undefined ? clampPct(patch.tax_pct) : x.tax_pct,
              markup_pct: patch.markup_pct !== undefined ? clampPct(patch.markup_pct) : x.markup_pct,
              kind: patch.kind !== undefined ? patch.kind : x.kind,
            }
          : x
      )
    );
  }

  async function submit() {
    if (!canSubmit) return;

    const cleaned: InvoiceLineItemDraft[] = lineItems.map((it) => ({
      ...it,
      description: it.description.trim(),
      qty: Number.isFinite(it.qty) && it.qty > 0 ? Math.floor(it.qty) : 1,
      unit_price_text: it.unit_price_text.trim(),
      tax_pct: clampPct(it.tax_pct),

      // ✅ keep safe defaults
      kind: it.kind === "product" ? "product" : "service",
      markup_pct: clampPct(it.markup_pct ?? 0),
    }));

    const draft: InvoiceDraft = {
      number: number.trim(),
      client_id: clientId,
      status,
      line_items: cleaned,
      notes: notes.trim() ? notes.trim() : null,
    };

    await onSaved(draft);
    onClose();
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[99998]",
        "flex items-center justify-center",
        "p-4 sm:p-6" // ✅ Abstand zum Rand auf kleinen Screens
      )}
      aria-modal="true"
      role="dialog"
    >
      {/* overlay */}
      <button type="button" className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />

      {/* modal */}
      <div
        className={cn(
          "relative z-[99999]",
          "w-[760px] max-w-full",
          "max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)]", // ✅ nie höher als Viewport (mit Padding)
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
          "flex flex-col overflow-hidden" // ✅ header/footer fix, body scrollt
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* header (fixed) */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="text-[22px] font-light text-neutral-950">{mode === "edit" ? "Edit Invoice" : "New Invoice"}</div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.25} />
          </button>
        </div>

        {/* ✅ scrollable content */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="pb-4">
            <div className="space-y-4">
              {/* Invoice Number */}
              <div className="space-y-2">
                <FieldLabel>
                  Invoice Number <span className="text-neutral-500">*</span>
                </FieldLabel>
                <TextInput value={number} onChange={(e) => setNumber(e.target.value)} placeholder="INV-003" />
              </div>

              {/* Client */}
              <div className="space-y-2">
                <FieldLabel>
                  Client <span className="text-neutral-500">*</span>
                </FieldLabel>

                <SelectField
                  value={clientId}
                  onValueChange={setClientId}
                  placeholder={loadingClients ? "Loading..." : "Select client"}
                  options={clientOptions}
                />

                {!loadingClients && clientOptions.length === 0 ? (
                  <div className="text-[12px] font-light text-neutral-500">No clients yet — create a client first.</div>
                ) : null}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <FieldLabel>Status</FieldLabel>
                <SelectField value={status} onValueChange={(v) => setStatus(v as any)} placeholder="Select status" options={statusOptions} />
              </div>

              {/* Line Items */}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-light text-neutral-900">Line Items</div>

                  <button
                    type="button"
                    onClick={addItem}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg",
                      "border border-neutral-200 bg-white px-3 py-2",
                      "text-[13px] font-light text-neutral-900",
                      "shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-neutral-50"
                    )}
                  >
                    <Plus size={16} strokeWidth={1.25} />
                    Add Item
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {lineItems.length === 0 ? (
                    <div className="py-6 text-center text-[13px] font-light text-neutral-400">No items added</div>
                  ) : (
                    lineItems.map((it) => (
                      <div
                        key={it.id}
                        className={cn(
                          "grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 bg-white p-2",
                          "sm:grid-cols-[1fr_84px_140px_96px_40px]"
                        )}
                      >
                        <TextInput
                          value={it.description}
                          onChange={(e) => updateItem(it.id, { description: e.target.value })}
                          placeholder="Description"
                        />

                        <TextInput
                          value={String(it.qty)}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateItem(it.id, { qty: Number.isFinite(v) ? v : 1 });
                          }}
                          inputMode="numeric"
                          placeholder="Qty"
                        />

                        <TextInput
                          value={it.unit_price_text}
                          onChange={(e) => updateItem(it.id, { unit_price_text: e.target.value })}
                          inputMode="decimal"
                          placeholder="Unit price (e.g. 120,00)"
                        />

                        <TextInput
                          value={String(it.tax_pct)}
                          onChange={(e) => updateItem(it.id, { tax_pct: clampPct(e.target.value) })}
                          inputMode="decimal"
                          placeholder="Tax %"
                          title="Tax %"
                        />

                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
                          aria-label="Remove item"
                          title="Remove item"
                        >
                          <Trash2 size={16} strokeWidth={1.25} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 text-[12px] font-light text-neutral-400">
                  Line total = (qty × unit price + markup) + tax (tax applies to base + markup).
                </div>
              </div>

              {/* Totals */}
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-light text-neutral-600">Subtotal</div>
                  <div className="text-[13px] font-light text-neutral-900 tabular-nums">{formatMoneyEUR(subtotalCents)}</div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[13px] font-light text-neutral-600">Tax</div>
                  <div className="text-[13px] font-light text-neutral-900 tabular-nums">{formatMoneyEUR(taxCents)}</div>
                </div>

                <div className="mt-3 h-px bg-neutral-200" />

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[14px] font-light text-neutral-700">Total Amount</div>
                  <div className="text-[18px] font-light text-neutral-900 tabular-nums">{formatMoneyEUR(totalCents)}</div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2 pt-2">
                <FieldLabel>Notes</FieldLabel>
                <TextArea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* extra bottom breathing room so last field isn't glued to footer */}
              <div className="h-4" />
            </div>
          </div>
        </div>

        {/* footer (fixed) */}
        <div className="border-t border-neutral-200 bg-white px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={[
                "h-10 rounded-lg px-4",
                "border border-neutral-200 bg-white",
                "text-[13px] font-light text-neutral-900",
                "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "hover:bg-neutral-50",
              ].join(" ")}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={[
                "h-10 rounded-lg px-5",
                "text-[13px] font-light text-white",
                canSubmit ? "bg-neutral-800 hover:bg-neutral-900" : "bg-neutral-400 cursor-not-allowed",
              ].join(" ")}
            >
              {mode === "edit" ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}