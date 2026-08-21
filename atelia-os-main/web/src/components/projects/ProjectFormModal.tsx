"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronDown, Check, Plus, Trash2 } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { supabase } from "@/lib/supabaseClient";
import type { Project } from "@/app/app/projects/page";

type Mode = "create" | "edit";
type TabKey = "basic" | "services" | "products" | "financial";

type UiStatus = "Inquiry" | "In Progress" | "Completed";
type UiProjectType = "Styling" | "Wardrobe" | "Consulting" | "Other";
type UiCategory = "Clothing" | "Shoes" | "Accessories" | "Bags" | "Other";

type ServiceRow = {
  id: string;
  serviceName: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxPct: number;
};

type ProductRow = {
  id: string;
  productName: string;
  brand: string;
  category: UiCategory;
  qty: number;
  unitPrice: number;
  markupPct: number;
  internalNote: string;
  includeInInvoice: boolean;
};

type FormState = {
  title: string;
  clientId: string; // uuid
  status: UiStatus;
  projectType: UiProjectType | "";
  invoiceable: boolean;
  startDate: string; // dd.mm.yyyy
  endDate: string; // dd.mm.yyyy
  internalNotes: string;

  services: ServiceRow[];
  products: ProductRow[];

  estimatedBudget: number;
  finalApprovedTotal: number;
};

type ClientOption = { value: string; label: string };

const MODAL_SHADOW = "shadow-[0_18px_40px_rgba(0,0,0,0.14)]";

const STATUS_OPTIONS: Array<{ value: UiStatus; label: string }> = [
  { value: "Inquiry", label: "Inquiry" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
];

const PROJECT_TYPE_OPTIONS: Array<{ value: UiProjectType; label: string }> = [
  { value: "Styling", label: "Styling" },
  { value: "Wardrobe", label: "Wardrobe" },
  { value: "Consulting", label: "Consulting" },
  { value: "Other", label: "Other" },
];

const CATEGORY_OPTIONS: Array<{ value: UiCategory; label: string }> = [
  { value: "Clothing", label: "Clothing" },
  { value: "Shoes", label: "Shoes" },
  { value: "Accessories", label: "Accessories" },
  { value: "Bags", label: "Bags" },
  { value: "Other", label: "Other" },
];

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-light text-neutral-500">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3",
        "h-10 text-[13px] font-light text-neutral-900 placeholder:text-neutral-400",
        "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        props.className
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2",
        "text-[13px] font-light text-neutral-900 placeholder:text-neutral-400",
        "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        props.className
      )}
    />
  );
}

/** Radix select (clean) */
function SelectField({
  value,
  onValueChange,
  placeholder = "Select",
  options,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cx(
          "mt-2 flex h-10 w-full items-center justify-between rounded-lg",
          "border border-neutral-200 bg-white px-3 text-[13px] font-light text-neutral-900",
          "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
          className
        )}
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
          className={cx(
            "z-[99999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
            "border border-neutral-200 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cx(
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

function parseDEDateToISO(d: string): string | null {
  const s = (d || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Robust error logger */
function logSupabaseError(prefix: string, e: any) {
  try {
    console.error(prefix, e);
    console.error(prefix + " (json)", JSON.stringify(e, null, 2));
    console.error(prefix + " keys", e ? Object.keys(e) : "no error object");
  } catch {
    console.error(prefix, e);
  }
}

/** Prefer real names (NOT email), robust to unknown schema */
function pickClientLabel(c: any): string {
  if (!c) return "Unnamed client";

  const direct =
    (typeof c.name === "string" && c.name.trim()) ||
    (typeof c.full_name === "string" && c.full_name.trim()) ||
    (typeof c.client_name === "string" && c.client_name.trim()) ||
    (typeof c.display_name === "string" && c.display_name.trim()) ||
    (typeof c.company === "string" && c.company.trim());

  if (direct) return direct;

  const first = typeof c.first_name === "string" ? c.first_name.trim() : "";
  const last = typeof c.last_name === "string" ? c.last_name.trim() : "";
  const combo = `${first} ${last}`.trim();
  if (combo) return combo;

  if (typeof c.title === "string" && c.title.trim()) return c.title.trim();

  return "Unnamed client";
}

function Tabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const TabBtn = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      type="button"
      onClick={() => onChange(k)}
      className={cx(
        "h-9 rounded-lg px-4 text-[13px] font-light transition",
        active === k
          ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          : "text-neutral-600 hover:text-neutral-900"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-5 rounded-xl bg-neutral-100/70 p-1">
      <div className="grid grid-cols-4 gap-1">
        <TabBtn k="basic" label="Basic Info" />
        <TabBtn k="services" label="Services" />
        <TabBtn k="products" label="Products" />
        <TabBtn k="financial" label="Financial" />
      </div>
    </div>
  );
}

function calcServiceTotal(s: ServiceRow) {
  const base = (s.qty || 0) * (s.unitPrice || 0);
  const tax = base * ((s.taxPct || 0) / 100);
  return base + tax;
}

function calcProductTotal(p: ProductRow) {
  const base = (p.qty || 0) * (p.unitPrice || 0);
  const markup = base * ((p.markupPct || 0) / 100);
  return base + markup;
}

export default function ProjectFormModal({
  open,
  mode,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  project?: Project | null;
  onClose: () => void;
  onSaved: (saved: any) => void;
}) {
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [tab, setTab] = useState<TabKey>("basic");
  const [saving, setSaving] = useState(false);

  // ✅ Quick Tasks modals
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const initial = useMemo<FormState>(() => {
    const title = mode === "edit" && project ? project.title ?? "" : "";
    const clientId = mode === "edit" && project ? (project as any).client_id ?? "" : "";

    const today = new Date()
      .toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
      .replace(/\//g, ".");

    const projectType =
      mode === "edit" && (project as any)?.project_type ? ((project as any).project_type as UiProjectType) : "";

    const invoiceable =
      mode === "edit" && typeof (project as any)?.invoiceable === "boolean" ? (project as any).invoiceable : true;

    return {
      title,
      clientId,
      status: (mode === "edit" && (project as any)?.status ? (project as any).status : "Inquiry") as UiStatus,
      projectType,
      invoiceable,
      startDate: today,
      endDate: today,
      internalNotes: "",

      services: [],
      products: [],

      estimatedBudget: safeNum((project as any)?.estimated_budget, 0),
      finalApprovedTotal: safeNum((project as any)?.final_approved_total, 0),
    };
  }, [mode, project]);

  const [v, setV] = useState<FormState>(initial);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setTab("basic");
    setV(initial);
    setApptModalOpen(false);
    setClientModalOpen(false);
    setInvoiceModalOpen(false);
  }, [open, initial]);

  // Load clients
  useEffect(() => {
    if (!open) return;

    (async () => {
      setClientsLoading(true);
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) {
          setClientOptions([]);
          return;
        }

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("owner_id", user.id)
          .order("id", { ascending: false });

        if (error) throw error;

        setClientOptions(
          (data ?? []).map((c: any) => ({
            value: c.id,
            label: pickClientLabel(c),
          }))
        );
      } catch (e) {
        logSupabaseError("Load clients failed:", e);
        setClientOptions([]);
      } finally {
        setClientsLoading(false);
      }
    })();
  }, [open]);

  // Load existing services/products when editing
  useEffect(() => {
    if (!open) return;
    if (mode !== "edit" || !project?.id) return;

    (async () => {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) return;

        const [{ data: srv, error: srvErr }, { data: prd, error: prdErr }] = await Promise.all([
          supabase
            .from("project_services")
            .select("*")
            .eq("owner_id", user.id)
            .eq("project_id", project.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("project_products")
            .select("*")
            .eq("owner_id", user.id)
            .eq("project_id", project.id)
            .order("created_at", { ascending: true }),
        ]);

        if (srvErr) throw srvErr;
        if (prdErr) throw prdErr;

        setV((prev) => ({
          ...prev,
          services: (srv ?? []).map((r: any) => ({
            id: r.id,
            serviceName: r.service_name ?? "",
            description: r.description ?? "",
            qty: safeNum(r.quantity, 1),
            unitPrice: safeNum(r.unit_price, 0),
            taxPct: safeNum(r.tax_percent, 0),
          })),
          products: (prd ?? []).map((r: any) => ({
            id: r.id,
            productName: r.product_name ?? "",
            brand: r.brand ?? "",
            category: (r.category as UiCategory) || "Other",
            qty: safeNum(r.quantity, 1),
            unitPrice: safeNum(r.unit_price, 0),
            markupPct: safeNum(r.markup_percent, 0),
            internalNote: r.internal_note ?? "",
            includeInInvoice: r.include_in_invoice !== false,
          })),
        }));
      } catch (e) {
        logSupabaseError("Load project lines failed:", e);
      }
    })();
  }, [open, mode, project?.id]);

  function addService() {
    setV((p) => ({
      ...p,
      services: [
        ...p.services,
        {
          id: `srv_${Math.random().toString(16).slice(2)}`,
          serviceName: "",
          description: "",
          qty: 1,
          unitPrice: 0,
          taxPct: 0,
        },
      ],
    }));
  }

  function addProduct() {
    setV((p) => ({
      ...p,
      products: [
        ...p.products,
        {
          id: `prd_${Math.random().toString(16).slice(2)}`,
          productName: "",
          brand: "",
          category: "Clothing",
          qty: 1,
          unitPrice: 0,
          markupPct: 0,
          internalNote: "",
          includeInInvoice: true,
        },
      ],
    }));
  }

  // ✅ hooks always run
  const servicesSubtotal = useMemo(() => v.services.reduce((sum, s) => sum + calcServiceTotal(s), 0), [v.services]);
  const productsSubtotal = useMemo(() => v.products.reduce((sum, p) => sum + calcProductTotal(p), 0), [v.products]);
  const totalProjectValue = servicesSubtotal + productsSubtotal;

  // ✅ early return after hooks
  if (!open) return null;

  async function handleSave() {
    if (!v.title.trim()) return;
    if (!v.clientId.trim()) return;

    setSaving(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Not authenticated");

      const startISO = parseDEDateToISO(v.startDate);
      const endISO = parseDEDateToISO(v.endDate);

      const projectPayload: any = {
        owner_id: user.id,
        title: v.title.trim(),
        client_id: v.clientId || null,
        status: v.status || "Inquiry",
        project_type: v.projectType || null,
        invoiceable: !!v.invoiceable,
        start_date: startISO,
        end_date: endISO,
        internal_notes: v.internalNotes || null,
        estimated_budget: Number.isFinite(v.estimatedBudget) ? v.estimatedBudget : null,
        final_approved_total: Number.isFinite(v.finalApprovedTotal) ? v.finalApprovedTotal : null,
      };

      let projectId = project?.id ?? null;

      if (mode === "edit" && projectId) {
        const { data: upd, error: updErr } = await supabase
          .from("projects")
          .update(projectPayload)
          .eq("id", projectId)
          .eq("owner_id", user.id)
          .select("id")
          .single();
        if (updErr) throw updErr;
        projectId = upd.id;
      } else {
        const { data: ins, error: insErr } = await supabase.from("projects").insert(projectPayload).select("id").single();
        if (insErr) throw insErr;
        projectId = ins.id;
      }

      if (!projectId) throw new Error("Missing project id after save");

      // Replace services
      {
        const { error: delErr } = await supabase.from("project_services").delete().eq("project_id", projectId).eq("owner_id", user.id);
        if (delErr) throw delErr;

        if (v.services.length > 0) {
          const rows = v.services.map((s) => ({
            project_id: projectId,
            owner_id: user.id,
            service_name: s.serviceName || "Service",
            description: s.description || null,
            quantity: safeNum(s.qty, 1),
            unit_price: safeNum(s.unitPrice, 0),
            tax_percent: safeNum(s.taxPct, 0),
            total: calcServiceTotal(s),
          }));

          const { error: insErr } = await supabase.from("project_services").insert(rows);
          if (insErr) throw insErr;
        }
      }

      // Replace products
      {
        const { error: delErr } = await supabase.from("project_products").delete().eq("project_id", projectId).eq("owner_id", user.id);
        if (delErr) throw delErr;

        if (v.products.length > 0) {
          const rows = v.products.map((p) => ({
            project_id: projectId,
            owner_id: user.id,
            product_name: p.productName || "Product",
            brand: p.brand || null,
            category: p.category || null,
            quantity: safeNum(p.qty, 1),
            unit_price: safeNum(p.unitPrice, 0),
            markup_percent: safeNum(p.markupPct, 0),
            total: calcProductTotal(p),
            internal_note: p.internalNote || null,
            include_in_invoice: !!p.includeInInvoice,
          }));

          const { error: insErr } = await supabase.from("project_products").insert(rows);
          if (insErr) throw insErr;
        }
      }

      onSaved({ id: projectId });
      onClose();
    } catch (e) {
      logSupabaseError("Save project failed:", e);
    } finally {
      setSaving(false);
    }
  }

  const primaryBtnLabel = mode === "create" ? "Create Project" : "Save Changes";
  const canCreateInvoice = mode === "edit" && !!project?.id;

  return (
    <>
      {/* ✅ responsive shell: padding + max height + inner scroll */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-modal="true" role="dialog">
        <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />

        <div
          className={cx(
            "relative z-10 w-[980px] max-w-full",
            "max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)]",
            "rounded-xl border border-neutral-200 bg-white ring-1 ring-black/10",
            MODAL_SHADOW,
            "flex flex-col overflow-hidden"
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ✅ header fixed */}
          <div className="px-8 pt-7 pb-5">
            <div className="flex items-start justify-between gap-6">
              <div className="text-[26px] font-light text-neutral-950">{mode === "create" ? "New Project" : "Edit Project"}</div>

              <button
                onClick={onClose}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.25} />
              </button>
            </div>

            {/* Tabs */}
            <Tabs active={tab} onChange={setTab} />

            {/* Quick Tasks row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setApptModalOpen(true)}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-4 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
              >
                + Appointment
              </button>

              <button
                type="button"
                onClick={() => setClientModalOpen(true)}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-4 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
              >
                + New Client
              </button>

              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                disabled={!canCreateInvoice}
                className={cx(
                  "h-9 rounded-lg border px-4 text-[13px] font-light",
                  canCreateInvoice ? "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50" : "border-neutral-200 bg-neutral-100 text-neutral-400"
                )}
                title={!canCreateInvoice ? "Save the project first to create an invoice" : undefined}
              >
                + Create Invoice
              </button>

              <div className="ml-auto text-[13px] font-light text-neutral-500">
                Current total: <span className="font-medium text-neutral-900">{formatMoney(totalProjectValue)}</span>
              </div>
            </div>
          </div>

          {/* ✅ scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 pb-6">
            <div className="mt-1">
              {/* BASIC */}
              {tab === "basic" ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                      <Label>Title *</Label>
                      <Input value={v.title} onChange={(e) => setV((p) => ({ ...p, title: e.target.value }))} placeholder="Project title" />
                    </div>

                    <div>
                      <Label>Client *</Label>
                      <SelectField
                        value={v.clientId}
                        onValueChange={(val) => setV((p) => ({ ...p, clientId: val }))}
                        placeholder={clientsLoading ? "Loading clients..." : "Select client"}
                        options={clientOptions}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-6 col-span-2">
                      <div>
                        <Label>Status</Label>
                        <SelectField
                          value={v.status}
                          onValueChange={(val) => setV((p) => ({ ...p, status: val as UiStatus }))}
                          options={STATUS_OPTIONS}
                        />
                      </div>

                      <div>
                        <Label>Project Type</Label>
                        <SelectField
                          value={v.projectType}
                          onValueChange={(val) => setV((p) => ({ ...p, projectType: val as UiProjectType }))}
                          placeholder="Select type"
                          options={PROJECT_TYPE_OPTIONS}
                        />
                      </div>

                      <div>
                        <Label>Invoiceable</Label>
                        <div className="mt-2 h-10 flex items-center">
                          <button
                            type="button"
                            onClick={() => setV((p) => ({ ...p, invoiceable: !p.invoiceable }))}
                            className="inline-flex items-center gap-3"
                            aria-pressed={v.invoiceable}
                          >
                            <span className={cx("relative inline-flex h-6 w-11 items-center rounded-full transition", v.invoiceable ? "bg-neutral-950" : "bg-neutral-300")}>
                              <span className={cx("inline-block h-5 w-5 rounded-full bg-white transition", v.invoiceable ? "translate-x-5" : "translate-x-1")} />
                            </span>
                            <span className="text-[13px] font-light text-neutral-900">{v.invoiceable ? "Yes" : "No"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Start Date</Label>
                      <Input value={v.startDate} onChange={(e) => setV((p) => ({ ...p, startDate: e.target.value }))} placeholder="21.01.2026" />
                    </div>

                    <div>
                      <Label>End Date</Label>
                      <Input value={v.endDate} onChange={(e) => setV((p) => ({ ...p, endDate: e.target.value }))} placeholder="21.01.2026" />
                    </div>

                    <div className="col-span-2">
                      <Label>Internal Notes</Label>
                      <TextArea
                        value={v.internalNotes}
                        onChange={(e) => setV((p) => ({ ...p, internalNotes: e.target.value }))}
                        placeholder="Internal project notes..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* SERVICES */}
              {tab === "services" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[16px] font-medium text-neutral-900">Services</div>

                    <button
                      type="button"
                      onClick={addService}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
                    >
                      <Plus size={16} strokeWidth={1.25} /> Add Service
                    </button>
                  </div>

                  <div className="mt-4">
                    {v.services.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-6 py-10 text-center text-[13px] font-light text-neutral-400">
                        No services added yet
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {v.services.map((s, idx) => {
                          const total = calcServiceTotal(s);
                          return (
                            <div key={s.id} className="rounded-lg border border-neutral-200 bg-white p-5">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-light text-neutral-500">Service Name</div>
                                <button
                                  type="button"
                                  onClick={() => setV((p) => ({ ...p, services: p.services.filter((x) => x.id !== s.id) }))}
                                  className="rounded-md p-2 text-red-500 hover:bg-red-50"
                                  aria-label="Remove service"
                                >
                                  <Trash2 size={16} strokeWidth={1.5} />
                                </button>
                              </div>

                              <div className="mt-2">
                                <SelectField
                                  value={s.serviceName}
                                  onValueChange={(val) =>
                                    setV((p) => {
                                      const next = [...p.services];
                                      next[idx] = { ...next[idx], serviceName: val };
                                      return { ...p, services: next };
                                    })
                                  }
                                  placeholder="Select service"
                                  options={[
                                    { value: "Styling session", label: "Styling session" },
                                    { value: "Wardrobe audit", label: "Wardrobe audit" },
                                    { value: "Consulting", label: "Consulting" },
                                    { value: "Custom", label: "Custom" },
                                  ]}
                                />
                              </div>

                              <div className="mt-4">
                                <div className="text-xs font-light text-neutral-500">Description (appears on invoice)</div>
                                <TextArea
                                  value={s.description}
                                  onChange={(e) =>
                                    setV((p) => {
                                      const next = [...p.services];
                                      next[idx] = { ...next[idx], description: e.target.value };
                                      return { ...p, services: next };
                                    })
                                  }
                                  placeholder="Detailed service description..."
                                  rows={3}
                                />
                              </div>

                              <div className="mt-4 grid grid-cols-4 gap-4">
                                <div>
                                  <div className="text-xs font-light text-neutral-500">Quantity</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={String(s.qty)}
                                    onChange={(e) =>
                                      setV((p) => {
                                        const next = [...p.services];
                                        next[idx] = { ...next[idx], qty: safeNum(e.target.value, 0) };
                                        return { ...p, services: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Unit Price</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(s.unitPrice)}
                                    onChange={(e) =>
                                      setV((p) => {
                                        const next = [...p.services];
                                        next[idx] = { ...next[idx], unitPrice: safeNum(e.target.value, 0) };
                                        return { ...p, services: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Tax %</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(s.taxPct)}
                                    onChange={(e) =>
                                      setV((p) => {
                                        const next = [...p.services];
                                        next[idx] = { ...next[idx], taxPct: safeNum(e.target.value, 0) };
                                        return { ...p, services: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Total</div>
                                  <Input value={formatMoney(total)} readOnly className="font-medium" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* PRODUCTS */}
              {tab === "products" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[16px] font-medium text-neutral-900">Products / Purchases</div>

                    <button
                      type="button"
                      onClick={addProduct}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
                    >
                      <Plus size={16} strokeWidth={1.25} /> Add Product
                    </button>
                  </div>

                  <div className="mt-4">
                    {v.products.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-6 py-10 text-center text-[13px] font-light text-neutral-400">
                        No products added yet
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {v.products.map((p, idx) => {
                          const total = calcProductTotal(p);
                          return (
                            <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/25 p-5">
                              <div className="grid grid-cols-[1fr_1fr_40px] gap-4">
                                <div>
                                  <div className="text-xs font-light text-neutral-500">Product Name</div>
                                  <Input
                                    value={p.productName}
                                    onChange={(e) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], productName: e.target.value };
                                        return { ...s, products: next };
                                      })
                                    }
                                    placeholder="Product name"
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Brand</div>
                                  <Input
                                    value={p.brand}
                                    onChange={(e) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], brand: e.target.value };
                                        return { ...s, products: next };
                                      })
                                    }
                                    placeholder="Brand"
                                  />
                                </div>

                                <div className="flex items-end justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setV((s) => ({ ...s, products: s.products.filter((x) => x.id !== p.id) }))}
                                    className="rounded-md p-2 text-red-500 hover:bg-red-50"
                                    aria-label="Remove product"
                                  >
                                    <Trash2 size={16} strokeWidth={1.5} />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-5 gap-4">
                                <div>
                                  <div className="text-xs font-light text-neutral-500">Category</div>
                                  <SelectField
                                    value={p.category}
                                    onValueChange={(val) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], category: val as UiCategory };
                                        return { ...s, products: next };
                                      })
                                    }
                                    options={CATEGORY_OPTIONS}
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Qty</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={String(p.qty)}
                                    onChange={(e) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], qty: safeNum(e.target.value, 0) };
                                        return { ...s, products: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Unit Price</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(p.unitPrice)}
                                    onChange={(e) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], unitPrice: safeNum(e.target.value, 0) };
                                        return { ...s, products: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Markup %</div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(p.markupPct)}
                                    onChange={(e) =>
                                      setV((s) => {
                                        const next = [...s.products];
                                        next[idx] = { ...next[idx], markupPct: safeNum(e.target.value, 0) };
                                        return { ...s, products: next };
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-light text-neutral-500">Total</div>
                                  <Input value={formatMoney(total)} readOnly className="font-medium" />
                                </div>
                              </div>

                              <div className="mt-4">
                                <div className="text-xs font-light text-neutral-500">Internal Note (private)</div>
                                <TextArea
                                  value={p.internalNote}
                                  onChange={(e) =>
                                    setV((s) => {
                                      const next = [...s.products];
                                      next[idx] = { ...next[idx], internalNote: e.target.value };
                                      return { ...s, products: next };
                                    })
                                  }
                                  placeholder="Private notes..."
                                  rows={3}
                                />
                              </div>

                              <div className="mt-3 flex items-center gap-3 border-t border-amber-200 pt-3">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-neutral-300"
                                  checked={p.includeInInvoice}
                                  onChange={(e) =>
                                    setV((s) => {
                                      const next = [...s.products];
                                      next[idx] = { ...next[idx], includeInInvoice: e.target.checked };
                                      return { ...s, products: next };
                                    })
                                  }
                                />
                                <div className="text-[13px] font-light text-neutral-900">Include in invoice</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* FINANCIAL */}
              {tab === "financial" ? (
                <div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-6">
                    <div className="text-[15px] font-medium text-neutral-900">Calculated Totals</div>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-light text-neutral-700">Services Subtotal</div>
                        <div className="font-medium text-neutral-900">{formatMoney(servicesSubtotal)}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="font-light text-neutral-700">Products Subtotal</div>
                        <div className="font-medium text-neutral-900">{formatMoney(productsSubtotal)}</div>
                      </div>

                      <div className="h-px bg-neutral-200" />

                      <div className="flex items-center justify-between">
                        <div className="font-medium text-neutral-900">Total Project Value</div>
                        <div className="text-[20px] font-semibold text-neutral-950">{formatMoney(totalProjectValue)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-6">
                    <div>
                      <Label>Estimated Budget</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(v.estimatedBudget)}
                        onChange={(e) => setV((p) => ({ ...p, estimatedBudget: safeNum(e.target.value, 0) }))}
                      />
                    </div>

                    <div>
                      <Label>Final Approved Total</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(v.finalApprovedTotal)}
                        onChange={(e) => setV((p) => ({ ...p, finalApprovedTotal: safeNum(e.target.value, 0) }))}
                      />
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/35 p-5">
                    <div className="text-[13px] font-medium text-amber-900">Invoice Status</div>
                    <div className="mt-2 text-[13px] font-light text-amber-900/90">Current: Not invoiced</div>
                  </div>
                </div>
              ) : null}

              {/* ✅ little breathing room at bottom so content doesn't stick to footer */}
              <div className="h-4" />
            </div>
          </div>

          {/* ✅ footer fixed */}
          <div className="border-t border-neutral-200 bg-white px-8 py-5">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="h-10 rounded-lg border border-neutral-200 bg-white px-6 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !v.title.trim() || !v.clientId.trim()}
                className={cx("h-10 rounded-lg px-7 text-[13px] font-light text-white", "bg-neutral-950 hover:bg-neutral-900 disabled:opacity-60")}
              >
                {saving ? "Saving..." : primaryBtnLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ STUB MODALS (replace later) */}
      <AppointmentStubModal open={apptModalOpen} onClose={() => setApptModalOpen(false)} />
      <NewClientStubModal open={clientModalOpen} onClose={() => setClientModalOpen(false)} />
      <InvoiceStubModal open={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} projectId={project?.id ?? null} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  STUB MODALS (compile-safe)                                         */
/* ------------------------------------------------------------------ */

function MiniOverlay({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />
      <div
        className={cx(
          "relative z-10 w-[760px] max-w-full",
          "max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)]",
          "rounded-xl border border-neutral-200 bg-white ring-1 ring-black/10",
          MODAL_SHADOW,
          "flex flex-col overflow-hidden"
        )}
      >
        <div className="px-7 pt-6 pb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="text-[18px] font-medium text-neutral-950">{title}</div>
            <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Close">
              <X size={18} strokeWidth={1.25} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-5">{children}</div>

        <div className="border-t border-neutral-200 bg-white px-7 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="h-10 rounded-lg border border-neutral-200 bg-white px-6 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentStubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <MiniOverlay open={open} onClose={onClose} title="Create Appointment (Stub)">
      <div className="text-[13px] font-light text-neutral-700">Platzhalter. Hier kommt später dein echtes Appointment-Modal rein.</div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label>Date</Label>
          <Input placeholder="21.01.2026" />
        </div>
        <div>
          <Label>Time</Label>
          <Input placeholder="15:30" />
        </div>
        <div className="col-span-2">
          <Label>Notes</Label>
          <TextArea rows={4} placeholder="Appointment notes..." />
        </div>
      </div>
    </MiniOverlay>
  );
}

function NewClientStubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <MiniOverlay open={open} onClose={onClose} title="Create Client (Stub)">
      <div className="text-[13px] font-light text-neutral-700">Platzhalter. Hier kommt später dein echtes Client-Modal rein.</div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label>First name</Label>
          <Input placeholder="Jane" />
        </div>
        <div>
          <Label>Last name</Label>
          <Input placeholder="Doe" />
        </div>
        <div className="col-span-2">
          <Label>Company</Label>
          <Input placeholder="Company (optional)" />
        </div>
      </div>
    </MiniOverlay>
  );
}

function InvoiceStubModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string | null }) {
  return (
    <MiniOverlay open={open} onClose={onClose} title="Create Invoice (Stub)">
      <div className="text-[13px] font-light text-neutral-700">Platzhalter. Hier kommt später dein echtes Invoice-Modal rein.</div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-[13px] font-light text-neutral-700">
        Project ID: <span className="font-medium text-neutral-900">{projectId ?? "—"}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label>Invoice date</Label>
          <Input placeholder="21.01.2026" />
        </div>
        <div>
          <Label>Due date</Label>
          <Input placeholder="05.02.2026" />
        </div>
        <div className="col-span-2">
          <Label>Internal note</Label>
          <TextArea rows={4} placeholder="Invoice note..." />
        </div>
      </div>
    </MiniOverlay>
  );
}