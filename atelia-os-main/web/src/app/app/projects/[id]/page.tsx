"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Shirt, Plus, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type UiStatus = "Inquiry" | "In Progress" | "Completed";

type ProjectRow = {
  id: string;
  title: string | null;
  status: UiStatus | null;
  client_id: string | null;
  estimated_budget: number | null;
  final_approved_total: number | null;
};

type ClientRow = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  client_name?: string | null;
  display_name?: string | null;
  company?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
};

type ServiceRow = {
  id: string;
  service_name: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  tax_percent: number | null;
  total: number | null;
};

type ProductRow = {
  id: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  quantity: number | null;
  unit_price: number | null;
  markup_percent: number | null;
  total: number | null;
  include_in_invoice: boolean | null;
};

const CARD = "rounded-xl border border-neutral-200 bg-white";
const MUTED = "text-neutral-500";
const MODAL_SHADOW = "shadow-[0_1px_1px_rgba(0,0,0,0.03)]";

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

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

function statusBadge(status: UiStatus) {
  if (status === "In Progress") return "bg-blue-50 text-blue-700 border-blue-100";
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-neutral-50 text-neutral-700 border-neutral-100";
}

function lineMetaQtyPriceTax(s: ServiceRow) {
  const qty = safeNum(s.quantity, 0);
  const price = safeNum(s.unit_price, 0);
  const tax = safeNum(s.tax_percent, 0);
  return `${qty} × ${formatEUR(price)} (${tax}% tax)`;
}

function lineMetaQtyPriceMarkup(p: ProductRow) {
  const qty = safeNum(p.quantity, 0);
  const price = safeNum(p.unit_price, 0);
  const mk = safeNum(p.markup_percent, 0);
  return `${qty} × ${formatEUR(price)} (+${mk}% markup)`;
}

function normalizeInvoiceId(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    const first = data[0];
    if (!first) return null;
    if (typeof first === "string") return first;
    if (typeof first?.id === "string") return first.id;
    if (typeof first?.invoice_id === "string") return first.invoice_id;
    return null;
  }

  if (typeof data?.id === "string") return data.id;
  if (typeof data?.invoice_id === "string") return data.invoice_id;
  return null;
}

/**
 * Self-heal: überschreibt invoice_items basierend auf Project Services/Products,
 * damit tax_percent & line_total korrekt sind.
 *
 * Tabelle: invoice_items
 * Spalten:
 * id; invoice_id; kind; title; description; quantity; unit_price; tax_percent; line_total; created_at
 */
async function patchInvoiceItemsFromProject(args: {
  invoiceId: string;
  services: ServiceRow[];
  products: ProductRow[];
}) {
  const { invoiceId, services, products } = args;

  // 1) bestehende invoice_items löschen (für diese invoice)
  const { error: delErr } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (delErr) throw delErr;

  const rows: Array<{
    invoice_id: string;
    kind: string;
    title: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    tax_percent: number;
    line_total: number;
  }> = [];

  // 2) Services -> tax inkludiert im line_total
  for (const s of services) {
    const qty = Math.max(1, Math.floor(safeNum(s.quantity, 1)));
    const unit = safeNum(s.unit_price, 0);
    const taxPct = safeNum(s.tax_percent, 0);

    const base = qty * unit;
    const tax = base * (taxPct / 100);
    const lineTotal = base + tax;

    rows.push({
      invoice_id: invoiceId,
      kind: "service",
      title: (s.service_name || "Service").toString(),
      description: s.description ? String(s.description) : null,
      quantity: qty,
      unit_price: unit,
      tax_percent: taxPct,
      line_total: lineTotal,
    });
  }

  // 3) Products -> total aus Project (base+markup) => effektiver unit_price = total/qty, tax 0
  for (const p of products.filter((x) => x.include_in_invoice !== false)) {
    const qty = Math.max(1, Math.floor(safeNum(p.quantity, 1)));
    const total = safeNum(p.total, 0);

    const unit = qty > 0 ? total / qty : 0;

    rows.push({
      invoice_id: invoiceId,
      kind: "product",
      title: String(p.product_name || "Product"),
      description: p.brand ? `Brand: ${p.brand}` : null,
      quantity: qty,
      unit_price: unit,
      tax_percent: 0,
      line_total: total,
    });
  }

  // 4) insert
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("invoice_items").insert(rows);
    if (insErr) throw insErr;
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [clientName, setClientName] = useState<string>("");

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [canvases, setCanvases] = useState<Array<{ id: string; title: string; itemCount: number; dateLabel: string }>>([]);
  const [images, setImages] = useState<Array<{ id: string; url: string }>>([]);

  async function handleCreateInvoice() {
    if (!id) return;

    setCreatingInvoice(true);
    try {
      const { data, error } = await supabase.rpc("create_invoice_from_project", { p_project_id: id });
      if (error) throw error;

      const invoiceId = normalizeInvoiceId(data);
      if (!invoiceId) throw new Error("RPC returned no invoice id");

      // ✅ Self-heal: invoice_items sauber aus Project schreiben (Tax/Markup fix)
      await patchInvoiceItemsFromProject({
        invoiceId,
        services,
        products,
      });

      router.push(`/app/invoices?open=${invoiceId}`);
    } catch (e) {
      console.error("[ProjectDetail] create invoice failed:", e);
      alert("Create invoice failed — check console.");
    } finally {
      setCreatingInvoice(false);
    }
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) throw new Error("Not authenticated");

        const { data: p, error: pErr } = await supabase
          .from("projects")
          .select("id,title,status,client_id,estimated_budget,final_approved_total")
          .eq("owner_id", user.id)
          .eq("id", id)
          .single();

        if (pErr) throw pErr;
        setProject(p as ProjectRow);

        if (p?.client_id) {
          const { data: c, error: cErr } = await supabase
            .from("clients")
            .select("*")
            .eq("owner_id", user.id)
            .eq("id", p.client_id)
            .single();

          if (!cErr && c) setClientName(pickClientLabel(c as ClientRow));
          else setClientName("");
        } else {
          setClientName("");
        }

        const [{ data: srv, error: srvErr }, { data: prd, error: prdErr }] = await Promise.all([
          supabase.from("project_services").select("*").eq("owner_id", user.id).eq("project_id", id).order("created_at", { ascending: true }),
          supabase.from("project_products").select("*").eq("owner_id", user.id).eq("project_id", id).order("created_at", { ascending: true }),
        ]);

        if (!srvErr) setServices((srv as ServiceRow[]) ?? []);
        if (!prdErr) setProducts((prd as ProductRow[]) ?? []);

        // canvases/images best-effort
        try {
          const { data: cvs } = await supabase
            .from("outfit_canvases")
            .select("id,title,created_at")
            .eq("owner_id", user.id)
            .eq("project_id", id)
            .order("created_at", { ascending: false });

          if (cvs && Array.isArray(cvs)) {
            const mapped = await Promise.all(
              cvs.map(async (c: any) => {
                let count = 0;
                try {
                  const { count: cnt } = await supabase
                    .from("outfit_canvas_items")
                    .select("*", { count: "exact", head: true })
                    .eq("owner_id", user.id)
                    .eq("canvas_id", c.id);
                  count = cnt ?? 0;
                } catch {}
                const d = c.created_at
                  ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "";
                return { id: c.id, title: c.title || "Canvas", itemCount: count, dateLabel: d };
              })
            );
            setCanvases(mapped);
          }
        } catch {}

        try {
          const { data: imgs } = await supabase
            .from("project_images")
            .select("id,url")
            .eq("owner_id", user.id)
            .eq("project_id", id)
            .order("created_at", { ascending: false });

          if (imgs && Array.isArray(imgs)) setImages(imgs as any);
        } catch {}
      } catch (e) {
        console.error("Project detail load failed:", e);
        setProject(null);
        setClientName("");
        setServices([]);
        setProducts([]);
        setCanvases([]);
        setImages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const servicesSubtotal = useMemo(() => services.reduce((sum, s) => sum + safeNum(s.total, 0), 0), [services]);
  const productsSubtotal = useMemo(() => products.reduce((sum, p) => sum + safeNum(p.total, 0), 0), [products]);
  const totalValue = servicesSubtotal + productsSubtotal;

  const estimatedBudget = safeNum(project?.estimated_budget, 0);
  const diff = totalValue - estimatedBudget;
  const diffColor = diff < 0 ? "text-emerald-600" : diff > 0 ? "text-red-600" : "text-neutral-700";

  const title = project?.title?.trim() || "Project";
  const status = (project?.status || "Inquiry") as UiStatus;

  return (
    <div className="px-10 py-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/app/projects")}
          className={cx("inline-flex items-center gap-2 text-[13px] font-light", "text-neutral-500 hover:text-neutral-900")}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to Projects
        </button>
      </div>

      <div className={cx(CARD, "p-8", MODAL_SHADOW, "max-w-[980px]")}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[28px] font-light text-neutral-950">{loading ? "…" : title}</div>

            <div className="mt-3">
              <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-light", statusBadge(status))}>
                {status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={creatingInvoice || loading || !project?.id}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg border border-neutral-200",
                "bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50",
                "disabled:opacity-60"
              )}
            >
              <FileText size={16} strokeWidth={1.5} />
              {creatingInvoice ? "Creating..." : "Create Invoice"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/app/projects?edit=${id}`)}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg border border-neutral-200",
                "bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
              )}
            >
              <Pencil size={16} strokeWidth={1.5} />
              Edit
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-neutral-50 p-6">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className={cx("text-[12px] tracking-wide uppercase", MUTED)}>Estimated Budget</div>
              <div className="mt-2 text-[22px] font-light text-neutral-950">{formatEUR(estimatedBudget)}</div>
            </div>

            <div>
              <div className={cx("text-[12px] tracking-wide uppercase", MUTED)}>Total Value</div>
              <div className="mt-2 text-[22px] font-light text-emerald-600">{formatEUR(totalValue)}</div>
            </div>

            <div>
              <div className={cx("text-[12px] tracking-wide uppercase", MUTED)}>Difference</div>
              <div className={cx("mt-2 text-[22px] font-light", diffColor)}>
                {diff === 0 ? formatEUR(0) : `${diff < 0 ? "" : "+"}${formatEUR(diff)}`}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 border-t border-neutral-200 pt-6">
          <div className={cx("text-[12px] tracking-wide uppercase", MUTED)}>Client</div>
          <div className="mt-2 text-[18px] font-light text-neutral-950">{clientName || "—"}</div>
        </div>
      </div>

      <div className={cx(CARD, "mt-8 p-8 max-w-[980px]")}>
        <div className="text-[18px] font-light text-neutral-950">Line Items</div>

        <div className="mt-6">
          <div className={cx("text-[13px] font-light", MUTED)}>Services</div>

          <div className="mt-4 space-y-6">
            {services.length === 0 ? (
              <div className={cx("text-[13px] font-light", MUTED)}>No services yet</div>
            ) : (
              services.map((s) => (
                <div key={s.id} className="flex items-start justify-between">
                  <div>
                    <div className="text-[15px] font-light text-neutral-950">{s.service_name || "Service"}</div>
                    {s.description ? <div className={cx("mt-1 text-[13px] font-light", MUTED)}>{s.description}</div> : null}
                    <div className={cx("mt-1 text-[12px] font-light", "text-neutral-400")}>{lineMetaQtyPriceTax(s)}</div>
                  </div>

                  <div className="text-[15px] font-light text-neutral-950">{formatEUR(safeNum(s.total, 0))}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-4 flex items-center justify-between">
            <div className="text-[14px] font-light text-neutral-800">Services Subtotal</div>
            <div className="text-[14px] font-light text-neutral-950">{formatEUR(servicesSubtotal)}</div>
          </div>
        </div>

        <div className="mt-8">
          <div className={cx("text-[13px] font-light", MUTED)}>Products</div>

          <div className="mt-4 space-y-6">
            {products.length === 0 ? (
              <div className={cx("text-[13px] font-light", MUTED)}>No products yet</div>
            ) : (
              products
                .filter((p) => p.include_in_invoice !== false)
                .map((p) => (
                  <div key={p.id} className="flex items-start justify-between">
                    <div>
                      <div className="text-[15px] font-light text-neutral-950">
                        {(p.product_name || "Product") + (p.brand ? ` - ${p.brand}` : "")}
                      </div>
                      <div className={cx("mt-1 text-[12px] font-light", "text-neutral-400")}>{lineMetaQtyPriceMarkup(p)}</div>
                    </div>

                    <div className="text-[15px] font-light text-neutral-950">{formatEUR(safeNum(p.total, 0))}</div>
                  </div>
                ))
            )}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-4 flex items-center justify-between">
            <div className="text-[14px] font-light text-neutral-800">Products Subtotal</div>
            <div className="text-[14px] font-light text-neutral-950">{formatEUR(productsSubtotal)}</div>
          </div>
        </div>
      </div>

      <div className={cx(CARD, "mt-8 p-8 max-w-[980px]")}>
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <Shirt size={18} strokeWidth={1.5} className="text-neutral-700" />
            <div className="text-[18px] font-light text-neutral-950">Outfit Canvas</div>
          </div>

          <button
            type="button"
            className={cx("inline-flex items-center gap-2 rounded-lg px-4 py-2", "bg-neutral-950 text-white text-[13px] font-light hover:bg-neutral-900")}
          >
            <Plus size={16} strokeWidth={1.5} />
            New Canvas
          </button>
        </div>

        <div className="mt-6">
          {canvases.length === 0 ? (
            <div className={cx("text-[13px] font-light", MUTED)}>No canvases yet</div>
          ) : (
            <div className="max-w-[360px]">
              {canvases.slice(0, 1).map((c) => (
                <div
                  key={c.id}
                  className={cx("rounded-xl border border-neutral-200 bg-white p-5", "shadow-[0_1px_2px_rgba(0,0,0,0.06)]")}
                >
                  <div className="text-[16px] font-light text-neutral-950">{c.title}</div>

                  <div className="mt-4 rounded-lg bg-neutral-50 p-6 flex items-center justify-center">
                    <div className="h-16 w-10 rounded bg-white border border-neutral-200" />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[12px] font-light text-neutral-400">
                    <div>{c.itemCount} items</div>
                    <div>{c.dateLabel}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cx(CARD, "mt-8 p-8 max-w-[980px]")}>
        <div className="flex items-center justify-between">
          <div className="text-[18px] font-light text-neutral-950">Images</div>

          <button
            type="button"
            className={cx("inline-flex items-center gap-2 rounded-lg px-4 py-2", "bg-neutral-950 text-white text-[13px] font-light hover:bg-neutral-900")}
          >
            <Upload size={16} strokeWidth={1.5} />
            Upload Image
          </button>
        </div>

        <div className="mt-10">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Upload className="text-neutral-300" size={26} strokeWidth={1.25} />
              <div className="mt-3 text-[13px] font-light text-neutral-400">No images uploaded yet</div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {images.map((img) => (
                <div key={img.id} className="aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}