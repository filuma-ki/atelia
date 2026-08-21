"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, MoreVertical, Check, ChevronDown } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import InvoiceFormModal, { InvoiceDraft } from "@/components/invoices/InvoiceFormModal";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams, useRouter } from "next/navigation";
import { LS_ACTIVE_BP } from "@/components/settings/settingsTypes";

type StatusFilter = "all" | "open" | "paid";

export type Invoice = {
  id: string;
  number: string;
  client_id: string | null;
  client_name: string;
  date: string; // ISO
  status: "open" | "paid";
  amount_cents: number;
  notes?: string | null;
  updated_at?: string | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  kind: "service" | "product" | null;
  title: string | null;
  quantity: number | null;
  unit_price: number | null; // EUR
  tax_percent: number | null; // DB column
  markup_percent: number | null; // ✅ DB column
  line_total: number | null; // ✅ DB column (EUR)
};

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatMoneyEUR(cents: number) {
  const value = cents / 100;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateLong(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function euroToInputText(eur: number) {
  const n = Number(eur ?? 0);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function clampPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function StatusPill({ status }: { status: "open" | "paid" }) {
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

function SelectField({
  value,
  onValueChange,
  options,
  widthClass = "w-[160px]",
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  widthClass?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-10 items-center justify-between rounded-lg",
          widthClass,
          "border border-neutral-200 bg-white px-3 text-[13px] font-light text-neutral-900",
          "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="text-neutral-400">
          <ChevronDown size={16} strokeWidth={1.25} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-[9999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
            "border border-neutral-200 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2",
                  "text-[13px] font-light text-neutral-900 outline-none",
                  "data-[highlighted]:bg-neutral-100"
                )}
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

type MenuPos = { top: number; left: number };

function nextInvoiceNumber(existing: Invoice[]) {
  let max = 0;
  for (const inv of existing) {
    const m = inv.number.match(/^INV-(\d{3,})$/i);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `INV-${String(max + 1).padStart(3, "0")}`;
}

function parseEuroToCents(input: string) {
  const s = (input ?? "").trim();
  if (!s) return 0;
  const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

async function resolveBusinessProfileId(opts: { ownerId: string; projectId?: string | null }) {
  async function fromLocalStorage() {
    const lsId = typeof window !== "undefined" ? window.localStorage.getItem(LS_ACTIVE_BP) : null;
    if (!lsId) return null;

    const { data: bp, error: bpErr } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("id", lsId)
      .eq("owner_id", opts.ownerId)
      .maybeSingle();

    if (!bpErr && bp?.id) return String(bp.id);
    return null;
  }

  if (opts.projectId) {
    const { data: p, error: pErr } = await supabase
      .from("projects")
      .select("id, business_profile_id")
      .eq("id", opts.projectId)
      .eq("owner_id", opts.ownerId)
      .maybeSingle();

    if (!pErr && p?.business_profile_id) return String(p.business_profile_id);

    if (!pErr && p?.id && !p?.business_profile_id) {
      const lsBpId = await fromLocalStorage();
      if (lsBpId) {
        await supabase
          .from("projects")
          .update({ business_profile_id: lsBpId, updated_at: new Date().toISOString() })
          .eq("id", p.id)
          .eq("owner_id", opts.ownerId);

        return lsBpId;
      }
    }
  }

  const lsId = await fromLocalStorage();
  if (lsId) return lsId;

  const { data: first, error: fErr } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", opts.ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fErr && first?.id) {
    if (opts.projectId) {
      await supabase
        .from("projects")
        .update({ business_profile_id: String(first.id), updated_at: new Date().toISOString() })
        .eq("id", opts.projectId)
        .eq("owner_id", opts.ownerId);
    }
    return String(first.id);
  }

  return null;
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const [editInitial, setEditInitial] = useState<Partial<InvoiceDraft> | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPos(null);
  }

  function openMenuFor(id: string) {
    const btn = btnRefs.current[id];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const width = 192;
    const left = Math.max(12, r.right - width);
    const top = r.bottom + gap;
    setOpenMenuId(id);
    setMenuPos({ top, left });
  }

  async function refresh() {
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) {
        setInvoices([]);
        return;
      }

      const { data: invRows, error: invErr } = await supabase
        .from("invoices")
        .select("id, owner_id, client_id, invoice_number, status, issued_at, total, notes, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (invErr) throw invErr;

      const clientIds = Array.from(new Set((invRows ?? []).map((r: any) => r.client_id).filter(Boolean))) as string[];

      let clientMap = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients, error: cErr } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .in("id", clientIds);

        if (!cErr && Array.isArray(clients)) {
          for (const c of clients as any[]) {
            const id = String(c?.id ?? "");
            if (!id) continue;
            const full = `${String(c?.first_name ?? "").trim()} ${String(c?.last_name ?? "").trim()}`.trim();
            clientMap.set(id, full || "—");
          }
        } else {
          console.warn("[InvoicesPage] clients lookup failed (ok):", cErr);
        }
      }

      const mapped: Invoice[] = (invRows ?? [])
        .map((row: any) => {
          const cid = row.client_id ? String(row.client_id) : null;
          return {
            id: String(row.id),
            number: String(row.invoice_number ?? ""),
            client_id: cid,
            client_name: cid ? (clientMap.get(cid) ?? "—") : "—",
            date: String(row.issued_at ?? row.created_at ?? new Date().toISOString()),
            status: row.status === "paid" ? "paid" : "open",
            amount_cents: Math.round(Number(row.total ?? 0) * 100),
            notes: row.notes ?? null,
            updated_at: row.updated_at ?? row.created_at ?? null,
          };
        })
        .filter((x) => x.id && x.number);

      setInvoices(mapped);
    } catch (e: any) {
      console.error("[InvoicesPage] load failed:", e?.message ?? e, e);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ ?open=<invoiceId> => open modal + PREFILL (inkl. tax + markup + kind)
  useEffect(() => {
    if (!openId) return;

    (async () => {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) return;

        const { data: invRow, error: invErr } = await supabase
          .from("invoices")
          .select("id, owner_id, client_id, invoice_number, status, notes, issued_at, total, created_at, updated_at")
          .eq("id", openId)
          .eq("owner_id", user.id)
          .single();

        if (invErr || !invRow) throw invErr;

        // ✅ include markup_percent + kind + line_total
        const { data: itRows, error: itErr } = await supabase
          .from("invoice_items")
          .select("id, invoice_id, kind, title, quantity, unit_price, tax_percent, markup_percent, line_total")
          .eq("invoice_id", openId)
          .order("id", { ascending: true });

        if (itErr) throw itErr;

        const selectedInvoice: Invoice = {
          id: String((invRow as any).id),
          number: String((invRow as any).invoice_number ?? ""),
          client_id: (invRow as any).client_id ? String((invRow as any).client_id) : null,
          client_name: "—",
          date: String((invRow as any).issued_at ?? (invRow as any).created_at ?? new Date().toISOString()),
          status: (invRow as any).status === "paid" ? "paid" : "open",
          amount_cents: Math.round(Number((invRow as any).total ?? 0) * 100),
          notes: (invRow as any).notes ?? null,
          updated_at: (invRow as any).updated_at ?? (invRow as any).created_at ?? null,
        };

        const line_items =
          Array.isArray(itRows) && itRows.length > 0
            ? (itRows as any as InvoiceItemRow[]).map((it) => ({
                id: crypto.randomUUID(),
                description: (it.title ?? "").trim() || "Item",
                qty: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
                unit_price_text: euroToInputText(Number(it.unit_price ?? 0)),
                tax_pct: clampPct(it.tax_percent ?? 19),

                // ✅ preserve these even if modal doesn't show them
                kind: it.kind === "product" ? "product" : "service",
                markup_pct: clampPct(it.markup_percent ?? 0),
              }))
            : [
                {
                  id: crypto.randomUUID(),
                  description: "",
                  qty: 1,
                  unit_price_text: "",
                  tax_pct: 19,
                  kind: "service",
                  markup_pct: 0,
                },
              ];

        setMode("edit");
        setSelected(selectedInvoice);
        setEditInitial({
          number: selectedInvoice.number,
          client_id: selectedInvoice.client_id ?? "",
          status: selectedInvoice.status,
          line_items,
          notes: selectedInvoice.notes ?? "",
        });

        setModalOpen(true);
        setModalKey((k) => k + 1);
      } catch (e) {
        console.error("[InvoicesPage] ?open prefill failed:", e);
      } finally {
        router.replace("/app/invoices");
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    if (!openMenuId) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    function onDown(e: MouseEvent) {
      const btn = btnRefs.current[openMenuId];
      if (btn && btn.contains(e.target as Node)) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeMenu();
    }
    function updatePos() {
      const btn = btnRefs.current[openMenuId];
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const gap = 8;
      const width = 192;
      const left = Math.max(12, r.right - width);
      const top = r.bottom + gap;
      setMenuPos({ top, left });
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [openMenuId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "all" ? true : inv.status === statusFilter;
      if (!matchStatus) return false;

      if (!query) return true;
      const d = new Date(inv.date);
      const hay = `${inv.number} ${inv.client_name} ${inv.status} ${formatDateLong(d)} ${formatMoneyEUR(inv.amount_cents)}`.toLowerCase();
      return hay.includes(query);
    });
  }, [invoices, q, statusFilter]);

  const openTotal = useMemo(
    () => filtered.filter((x) => x.status === "open").reduce((sum, x) => sum + x.amount_cents, 0),
    [filtered]
  );
  const paidTotal = useMemo(
    () => filtered.filter((x) => x.status === "paid").reduce((sum, x) => sum + x.amount_cents, 0),
    [filtered]
  );

  function openCreateModal() {
    setMode("create");
    setSelected(null);
    setEditInitial(null);
    setModalOpen(true);
    setModalKey((k) => k + 1);
  }

  // ✅ dropdown Edit => lädt invoice + invoice_items inkl. tax + markup + kind
  async function openEditModal(inv: Invoice) {
    setMode("edit");
    setSelected(inv);
    setEditInitial(null);

    setModalOpen(true);
    setModalKey((k) => k + 1);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      const { data: invRow, error: invErr } = await supabase
        .from("invoices")
        .select("id, owner_id, client_id, invoice_number, status, notes")
        .eq("id", inv.id)
        .eq("owner_id", user.id)
        .single();

      if (invErr) throw invErr;

      const { data: itRows, error: itErr } = await supabase
        .from("invoice_items")
        .select("id, invoice_id, kind, title, quantity, unit_price, tax_percent, markup_percent, line_total")
        .eq("invoice_id", inv.id)
        .order("id", { ascending: true });

      if (itErr) throw itErr;

      const line_items =
        Array.isArray(itRows) && itRows.length > 0
          ? (itRows as any as InvoiceItemRow[]).map((it) => ({
              id: crypto.randomUUID(),
              description: (it.title ?? "").trim() || "Item",
              qty: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
              unit_price_text: euroToInputText(Number(it.unit_price ?? 0)),
              tax_pct: clampPct(it.tax_percent ?? 19),

              kind: it.kind === "product" ? "product" : "service",
              markup_pct: clampPct(it.markup_percent ?? 0),
            }))
          : [
              {
                id: crypto.randomUUID(),
                description: "",
                qty: 1,
                unit_price_text: "",
                tax_pct: 19,
                kind: "service",
                markup_pct: 0,
              },
            ];

      setEditInitial({
        number: String((invRow as any).invoice_number ?? "").trim(),
        client_id: (invRow as any).client_id ? String((invRow as any).client_id) : "",
        status: (invRow as any).status === "paid" ? "paid" : "open",
        line_items,
        notes: (invRow as any).notes ?? "",
      });

      setModalKey((k) => k + 1);
    } catch (e) {
      console.error("[InvoicesPage] openEditModal prefill failed:", e);

      setEditInitial({
        number: inv.number,
        client_id: inv.client_id ?? "",
        status: inv.status,
        line_items: [
          { id: crypto.randomUUID(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 },
        ],
        notes: inv.notes ?? "",
      });
      setModalKey((k) => k + 1);
    }
  }

  async function handleDelete(inv: Invoice) {
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      await supabase.from("invoice_items").delete().eq("invoice_id", inv.id);

      const { error } = await supabase.from("invoices").delete().eq("id", inv.id).eq("owner_id", user.id);
      if (error) throw error;

      await refresh();
    } catch (e) {
      console.error("[InvoicesPage] delete failed:", e);
    } finally {
      closeMenu();
    }
  }

  async function togglePaid(inv: Invoice) {
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      const nextStatus = inv.status === "paid" ? "open" : "paid";

      const { error } = await supabase
        .from("invoices")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", inv.id)
        .eq("owner_id", user.id);

      if (error) throw error;

      await refresh();
    } catch (e) {
      console.error("[InvoicesPage] toggle paid failed:", e);
    } finally {
      closeMenu();
    }
  }

  const renderMenu = (inv: Invoice) => {
    if (!openMenuId || openMenuId !== inv.id || !menuPos) return null;

    return createPortal(
      <div
        ref={(el) => {
          menuRef.current = el;
        }}
        className={cn(
          "fixed z-[99999] w-48 overflow-hidden",
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
        )}
        style={{ top: menuPos.top, left: menuPos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn("w-full px-4 py-3 text-left", "text-[13px] font-light text-neutral-900", "hover:bg-neutral-50 transition")}
          onClick={() => {
            closeMenu();
            openEditModal(inv);
          }}
        >
          Edit
        </button>

        <button
          type="button"
          className={cn("w-full px-4 py-3 text-left", "text-[13px] font-light text-neutral-900", "hover:bg-neutral-50 transition")}
          onClick={() => togglePaid(inv)}
        >
          Mark as {inv.status === "paid" ? "Open" : "Paid"}
        </button>

        <div className="h-px bg-neutral-200" />

        <button
          type="button"
          className={cn("w-full px-4 py-3 text-left", "text-[13px] font-light text-red-600", "hover:bg-red-50 transition")}
          onClick={() => handleDelete(inv)}
        >
          Delete
        </button>
      </div>,
      document.body
    );
  };

  const modalInitial = useMemo(() => {
    if (mode === "edit") {
      if (editInitial) return editInitial;
      return {
        number: selected?.number ?? "",
        client_id: selected?.client_id ?? "",
        status: selected?.status ?? "open",
        line_items: [
          { id: crypto.randomUUID(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 },
        ],
        notes: selected?.notes ?? "",
      } satisfies Partial<InvoiceDraft>;
    }

    const num = nextInvoiceNumber(invoices);
    return {
      number: num,
      client_id: "",
      status: "open",
      line_items: [
        { id: crypto.randomUUID(), description: "", qty: 1, unit_price_text: "", tax_pct: 19, kind: "service", markup_pct: 0 },
      ],
      notes: "",
    } satisfies Partial<InvoiceDraft>;
  }, [mode, editInitial, selected, invoices]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="w-full px-10 pt-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[40px] font-extralight leading-none tracking-tight text-neutral-950">Invoices</div>
            <div className="mt-2 text-sm font-light text-neutral-500">{invoices.length} total invoices</div>
          </div>

          <button
            onClick={openCreateModal}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-neutral-950",
              "px-5 py-3 text-[13px] font-light text-white",
              "transition hover:bg-neutral-900",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:ring-offset-2 focus:ring-offset-neutral-50"
            )}
          >
            <Plus size={16} />
            Add Invoice
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className={cn("rounded-2xl border border-amber-200 bg-amber-50/40 px-6 py-5", CARD_SHADOW)}>
            <div className="text-[13px] font-light text-amber-700">Open Invoices</div>
            <div className="mt-2 text-[28px] font-light text-amber-800">{formatMoneyEUR(openTotal)}</div>
          </div>

          <div className={cn("rounded-2xl border border-emerald-200 bg-emerald-50/40 px-6 py-5", CARD_SHADOW)}>
            <div className="text-[13px] font-light text-emerald-700">Paid Invoices</div>
            <div className="mt-2 text-[28px] font-light text-emerald-800">{formatMoneyEUR(paidTotal)}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex w-[520px] items-center gap-3 rounded-lg",
                "border border-neutral-200 bg-white px-3 py-2",
                "transition",
                "focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-200"
              )}
            >
              <Search size={16} className="text-neutral-400" />
              <input
                className="w-full bg-transparent text-[13px] font-light text-neutral-900 placeholder:font-light placeholder:text-neutral-400 outline-none"
                placeholder="Search invoices..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="rounded-lg px-2 py-1 text-[11px] font-light text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <SelectField
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: "all", label: "All Status" },
                { value: "open", label: "Open" },
                { value: "paid", label: "Paid" },
              ]}
              widthClass="w-[180px]"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className={cn("rounded-xl border border-neutral-200 bg-white", CARD_SHADOW)}>
            <div className="grid grid-cols-[180px_1fr_220px_160px_180px_52px] border-b border-neutral-200 bg-neutral-50/40 px-6 py-3">
              <div className="text-[13px] font-light text-neutral-500">Invoice</div>
              <div className="text-[13px] font-light text-neutral-500">Client</div>
              <div className="text-[13px] font-light text-neutral-500">Date</div>
              <div className="text-[13px] font-light text-neutral-500">Status</div>
              <div className="text-[13px] font-light text-neutral-500 text-right">Amount</div>
              <div />
            </div>

            {loading ? (
              <div className="px-6 py-6 text-[13px] font-light text-neutral-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="text-[13px] font-medium text-neutral-900">No invoices found</div>
                <div className="mt-2 text-[13px] font-light text-neutral-500">
                  Try another search, change status filter, or add a new invoice.
                </div>
              </div>
            ) : (
              filtered.map((inv) => {
                const d = new Date(inv.date);

                return (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/app/invoices/${inv.id}`)}
                    className={cn(
                      "relative grid grid-cols-[180px_1fr_220px_160px_180px_52px]",
                      "px-6 py-4 cursor-pointer",
                      "border-b border-neutral-100 last:border-b-0",
                      "hover:bg-neutral-50/60 transition"
                    )}
                  >
                    <div className="text-[14px] font-light text-neutral-950">{inv.number}</div>
                    <div className="text-[14px] font-light text-neutral-700">{inv.client_name}</div>
                    <div className="text-[14px] font-light text-neutral-500">{formatDateLong(d)}</div>
                    <div className="flex items-center">
                      <StatusPill status={inv.status} />
                    </div>
                    <div className="text-[14px] font-light text-neutral-900 text-right">{formatMoneyEUR(inv.amount_cents)}</div>

                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        ref={(el) => {
                          btnRefs.current[inv.id] = el;
                        }}
                        type="button"
                        className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        onClick={() => {
                          if (openMenuId === inv.id) closeMenu();
                          else openMenuFor(inv.id);
                        }}
                        aria-label="Actions"
                      >
                        <MoreVertical size={16} strokeWidth={1.25} />
                      </button>
                      {renderMenu(inv)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <InvoiceFormModal
          key={`invoice-modal-${mode}-${selected?.id ?? "new"}-${modalKey}`}
          open={modalOpen}
          mode={mode}
          initial={modalInitial}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
            setEditInitial(null);
          }}
          onSaved={async (draft) => {
            try {
              // ✅ totals with markup%: subtotal = base + markup, tax applies to (base + markup)
              const subtotalCents = (draft.line_items ?? []).reduce((sum, it: any) => {
                const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
                const unit = parseEuroToCents(it.unit_price_text ?? "");
                const base = qty * unit;
                const markup = Math.round(base * (clampPct(it.markup_pct ?? 0) / 100));
                return sum + base + markup;
              }, 0);

              const taxCents = (draft.line_items ?? []).reduce((sum, it: any) => {
                const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 0;
                const unit = parseEuroToCents(it.unit_price_text ?? "");
                const base = qty * unit;
                const markup = Math.round(base * (clampPct(it.markup_pct ?? 0) / 100));
                const pct = clampPct(it.tax_pct ?? 0);
                return sum + Math.round((base + markup) * (pct / 100));
              }, 0);

              const totalCents = subtotalCents + taxCents;

              const subtotalEUR = subtotalCents / 100;
              const taxEUR = taxCents / 100;
              const totalEUR = totalCents / 100;

              const { data: auth, error: authErr } = await supabase.auth.getUser();
              if (authErr) throw authErr;
              const user = auth.user;
              if (!user) throw new Error("Not authenticated");

              const projectIdFromQuery = searchParams.get("project");
              const projectId = projectIdFromQuery ? String(projectIdFromQuery) : null;

              const bpId = await resolveBusinessProfileId({
                ownerId: user.id,
                projectId,
              });
              if (!bpId) throw new Error("No business profile found for invoice.");

              let currency = "EUR";
              try {
                const { data: bpRow } = await supabase
                  .from("business_profiles")
                  .select("currency")
                  .eq("id", bpId)
                  .eq("owner_id", user.id)
                  .single();

                if (bpRow?.currency) currency = String(bpRow.currency);
              } catch {}

              const invoiceRow: any = {
                owner_id: user.id,
                business_profile_id: bpId,
                ...(projectId ? { project_id: projectId } : {}),
                invoice_number: draft.number.trim(),
                client_id: draft.client_id ? draft.client_id : null,
                status: draft.status,
                issued_at: new Date().toISOString().slice(0, 10),
                currency,
                subtotal: subtotalEUR,
                tax_total: taxEUR,
                total: totalEUR,
                notes: draft.notes?.trim() ? draft.notes.trim() : null,
                updated_at: new Date().toISOString(),
              };

              let invoiceId: string;

              if (mode === "edit" && selected) {
                invoiceId = selected.id;

                const { error } = await supabase
                  .from("invoices")
                  .update(invoiceRow)
                  .eq("id", invoiceId)
                  .eq("owner_id", user.id);

                if (error) throw error;

                await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
              } else {
                const { data: inserted, error } = await supabase
                  .from("invoices")
                  .insert(invoiceRow)
                  .select("id")
                  .single();

                if (error) throw error;
                invoiceId = String(inserted.id);
              }

              // ✅ store per-line: kind + markup_percent + tax_percent + line_total
              const items = (draft.line_items ?? []).map((it: any) => {
                const qty = Number.isFinite(it.qty) && it.qty > 0 ? it.qty : 1;
                const unitCents = parseEuroToCents(it.unit_price_text ?? "");
                const unitEUR = unitCents / 100;

                const markupPct = clampPct(it.markup_pct ?? 0);
                const taxPct = clampPct(it.tax_pct ?? 0);

                const baseCents = qty * unitCents;
                const markupCents = Math.round(baseCents * (markupPct / 100));
                const taxLineCents = Math.round((baseCents + markupCents) * (taxPct / 100));
                const lineTotalEUR = (baseCents + markupCents + taxLineCents) / 100;

                return {
                  invoice_id: invoiceId,
                  kind: it.kind === "product" ? "product" : "service",
                  title: (it.description ?? "").trim() || "Item",
                  description: null,
                  quantity: qty,
                  unit_price: unitEUR,
                  markup_percent: markupPct,
                  tax_percent: taxPct,
                  line_total: lineTotalEUR,
                };
              });

              if (items.length > 0) {
                const { error } = await supabase.from("invoice_items").insert(items);
                if (error) throw error;
              }

              setModalOpen(false);
              setSelected(null);
              setEditInitial(null);
              await refresh();

              if (projectIdFromQuery) router.replace("/app/invoices");
            } catch (e) {
              console.error("[InvoicesPage] save failed:", e);
              alert("Save failed — check console.");
            }
          }}
        />
      </div>
    </div>
  );
}