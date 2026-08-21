"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { X, ChevronLeft, ChevronRight, UserPlus, FolderPlus, CalendarPlus, FileText } from "lucide-react";

import ClientFormModal from "@/components/clients/ClientFormModal";
import ProjectFormModal from "@/components/projects/ProjectFormModal";
import AppointmentFormModal from "@/components/appointments/AppointmentFormModal";
import InvoiceFormModal from "@/components/invoices/InvoiceFormModal";

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  total: number | null;
  issued_at: string | null; // YYYY-MM-DD
  created_at?: string | null;
  client_id: string | null;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProjectRow = {
  id: string;
  status: string | null;
};

type AppointmentRow = {
  id: string;
  starts_at: string | null; // ISO
  ends_at: string | null; // ISO
  type: string | null;
  notes: string | null;
  client_id: string | null;
};

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatMoneyEUR(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatDateLong(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}

function formatMonthYear(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fullName(c?: ClientRow | null) {
  const first = (c?.first_name ?? "").trim();
  const last = (c?.last_name ?? "").trim();
  const s = `${first} ${last}`.trim();
  return s || "—";
}

function logSbError(label: string, err: any) {
  console.error(label, {
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
    raw: err,
  });
}

/** Responsive SVG line chart (axes + hover + smooth motion) */
function RevenueChart({
  points,
  height = 280,
  currency = "EUR",
}: {
  points: Array<{ x: number; y: number }>;
  height?: number;
  currency?: string;
}) {
  const [w, setW] = useState(0);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.max(260, Math.floor(cr.width)));
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  const width = w || 760;

  const maxYRaw = Math.max(0, ...points.map((p) => Number(p.y || 0)));
  const xMin = Math.min(...points.map((p) => p.x));
  const xMax = Math.max(...points.map((p) => p.x));

  function niceStep(maxVal: number, ticks: number) {
    if (maxVal <= 0) return 1;
    const rough = maxVal / ticks;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const frac = rough / pow;

    let niceFrac = 1;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 2.5) niceFrac = 2.5;
    else if (frac <= 5) niceFrac = 5;
    else niceFrac = 10;

    return niceFrac * pow;
  }

  const yTicks = 4;
  const step = niceStep(maxYRaw, yTicks);
  const maxY = Math.max(step, Math.ceil(maxYRaw / step) * step);

  const formatAxisEUR = (v: number) => {
    if (v === 0) return "€0";
    if (v >= 1000) {
      const k = v / 1000;
      const s = Number.isInteger(k) ? `${k}` : `${k.toFixed(1)}`.replace(".0", "");
      return `€${s}k`;
    }
    return `€${Math.round(v)}`;
  };

  const padding = { l: 62, r: 18, t: 16, b: 34 };
  const minY = 0;

  const sx = (x: number) => {
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax === xMin) return padding.l;
    return padding.l + ((x - xMin) / (xMax - xMin)) * (width - padding.l - padding.r);
  };

  const sy = (y: number) => {
    const t = (y - minY) / (maxY - minY || 1);
    return height - padding.b - t * (height - padding.t - padding.b);
  };

  const safePoints =
    points.length >= 2
      ? points
      : [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ];

  const d = safePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`)
    .join(" ");

  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => i * step);

  const mid = Math.round((xMin + xMax) / 2);
  const xTickVals = [xMin, mid, xMax].filter((v, i, a) => a.indexOf(v) === i);

  const [hoverTarget, setHoverTarget] = useState<null | { x: number; y: number; px: number; py: number }>(null);
  const [hover, setHover] = useState<null | { x: number; y: number; px: number; py: number }>(null);

  const nearestIndex = (mx: number) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < safePoints.length; i++) {
      const px = sx(safePoints[i].x);
      const dist = Math.abs(px - mx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = nearestIndex(mx);
    const p = safePoints[idx];
    setHoverTarget({ x: p.x, y: p.y, px: sx(p.x), py: sy(p.y) });
  };

  const onLeave = () => {
    setHoverTarget(null);
    setHover(null);
  };

  useEffect(() => {
    if (!hoverTarget) return;
    let raf = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const stepAnim = () => {
      setHover((prev) => {
        if (!prev) return hoverTarget;
        return {
          x: hoverTarget.x,
          y: hoverTarget.y,
          px: lerp(prev.px, hoverTarget.px, 0.18),
          py: lerp(prev.py, hoverTarget.py, 0.18),
        };
      });
      raf = requestAnimationFrame(stepAnim);
    };

    raf = requestAnimationFrame(stepAnim);
    return () => cancelAnimationFrame(raf);
  }, [hoverTarget]);

  const [pathLen, setPathLen] = useState(0);
  const [pathEl, setPathEl] = useState<SVGPathElement | null>(null);

  useEffect(() => {
    if (!pathEl) return;
    try {
      setPathLen(pathEl.getTotalLength());
    } catch {
      setPathLen(0);
    }
  }, [pathEl, d, width, height]);

  return (
    <div ref={setContainerEl} className="w-full">
      <svg
        width={width}
        height={height}
        className="block w-full"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        role="img"
        aria-label="Revenue chart"
      >
        <defs>
          <filter id="ateliaSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feOffset dy="1" result="off" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.18" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g>
          {yTickVals.map((v, i) => {
            const y = sy(v);
            const isZero = v === 0;
            return (
              <g key={i}>
                <line
                  x1={padding.l}
                  y1={y}
                  x2={width - padding.r}
                  y2={y}
                  stroke="rgba(0,0,0,0.08)"
                  strokeDasharray={isZero ? "0" : "3 6"}
                />
                <text x={padding.l - 12} y={y + 4} textAnchor="end" fontSize={11} fill="rgba(0,0,0,0.40)">
                  {formatAxisEUR(v)}
                </text>
              </g>
            );
          })}

          <line
            x1={padding.l}
            y1={height - padding.b}
            x2={width - padding.r}
            y2={height - padding.b}
            stroke="rgba(0,0,0,0.10)"
          />

          {xTickVals.map((v, i) => {
            const x = sx(v);
            return (
              <g key={i}>
                <line x1={x} y1={height - padding.b} x2={x} y2={height - padding.b + 5} stroke="rgba(0,0,0,0.10)" />
                <text x={x} y={height - 10} textAnchor="middle" fontSize={11} fill="rgba(0,0,0,0.40)">
                  {v}
                </text>
              </g>
            );
          })}
        </g>

        <path
          ref={setPathEl}
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.62)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ateliaSoftShadow)"
          style={{
            strokeDasharray: pathLen ? `${pathLen} ${pathLen}` : undefined,
            strokeDashoffset: pathLen ? pathLen : undefined,
            animation: pathLen ? "ateliaLineDraw 650ms ease-out forwards" : undefined,
          }}
        />

        {hover ? (
          <>
            <line
              x1={hover.px}
              y1={padding.t}
              x2={hover.px}
              y2={height - padding.b}
              stroke="rgba(0,0,0,0.16)"
              strokeDasharray="3 6"
            />
            <circle cx={hover.px} cy={hover.py} r={4} fill="rgba(0,0,0,0.70)" />
            <circle cx={hover.px} cy={hover.py} r={9} fill="rgba(0,0,0,0.06)" />

            {(() => {
              const boxW = 178;
              const boxH = 60;
              const x = Math.min(width - padding.r - boxW, Math.max(padding.l, hover.px + 14));
              const y = Math.max(padding.t, hover.py - boxH - 10);

              const formatMoney = (value: number) =>
                new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(value || 0));

              return (
                <g>
                  <rect x={x} y={y} width={boxW} height={boxH} rx={10} fill="white" stroke="rgba(0,0,0,0.10)" />
                  <text x={x + 12} y={y + 22} fontSize={12} fill="rgba(0,0,0,0.78)">
                    Day {hover.x}
                  </text>
                  <text x={x + 12} y={y + 42} fontSize={12} fill="rgba(0,0,0,0.45)">
                    Revenue: {formatMoney(hover.y)}
                  </text>
                </g>
              );
            })()}
          </>
        ) : null}
      </svg>

      <style>{`
        @keyframes ateliaLineDraw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

/** Revenue modal */
function RevenueModal({
  open,
  onOpenChange,
  initialMonth,
  ownerId,
  businessProfileId,
  clientMap,
  onInvoiceClick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialMonth: Date;
  ownerId: string | null;
  businessProfileId: string | null;
  clientMap: Map<string, ClientRow>;
  onInvoiceClick: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(initialMonth));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [mode, setMode] = useState<"paid" | "all">("paid");

  const isPaid = (r: InvoiceRow) => String(r.status || "").toLowerCase() === "paid";

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    if (!ownerId && !businessProfileId) return;

    (async () => {
      setLoading(true);
      try {
        const from = startOfMonth(month);
        const to = endOfMonth(month);

        let q = supabase.from("invoices").select("id, invoice_number, status, total, issued_at, created_at, client_id");

        if (businessProfileId) q = q.eq("business_profile_id", businessProfileId);
        else if (ownerId) q = q.eq("owner_id", ownerId);

        const { data, error } = await q
          .gte("issued_at", toISODate(from))
          .lte("issued_at", toISODate(to))
          .order("issued_at", { ascending: true });

        if (error) throw error;
        setRows((data ?? []) as any);
      } catch (e) {
        console.error("[RevenueModal] load failed:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, ownerId, businessProfileId, month]);

  const filteredRows = useMemo(() => (mode === "paid" ? rows.filter(isPaid) : rows), [rows, mode]);

  const totalRevenue = useMemo(() => filteredRows.reduce((s, r) => s + Number(r.total ?? 0), 0), [filteredRows]);
  const invoiceCount = filteredRows.length;
  const avgInvoice = useMemo(
    () => (!filteredRows.length ? 0 : totalRevenue / filteredRows.length),
    [filteredRows, totalRevenue]
  );

  const points = useMemo(() => {
    const daysInMonth = endOfMonth(month).getDate();
    const byDay = new Array(daysInMonth + 1).fill(0);

    for (const r of filteredRows) {
      const iso = r.issued_at || r.created_at;
      if (!iso) continue;
      const d = new Date(iso);
      byDay[d.getDate()] += Number(r.total ?? 0);
    }

    const out: Array<{ x: number; y: number }> = [];
    let cum = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      cum += byDay[day];
      out.push({ x: day, y: cum });
    }
    return out;
  }, [filteredRows, month]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99999] bg-black/50" onMouseDown={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            "w-full max-w-[1040px]",
            "h-[min(92vh,900px)]",
            "rounded-2xl border border-neutral-200 bg-white",
            "shadow-[0_30px_80px_rgba(0,0,0,0.30)]",
            "overflow-hidden",
            "flex flex-col min-h-0"
          )}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-neutral-100">
            <div>
              <div className="text-[22px] sm:text-[26px] font-light text-neutral-950">Revenue Overview</div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] font-light text-neutral-500">
                <button
                  type="button"
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  onClick={() => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} strokeWidth={1.5} />
                </button>

                <div className="min-w-[180px] text-center">{formatMonthYear(month)}</div>

                <button
                  type="button"
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  onClick={() => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}
                  aria-label="Next month"
                >
                  <ChevronRight size={18} strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-4 inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                <button
                  type="button"
                  onClick={() => setMode("paid")}
                  className={cn(
                    "px-3 py-1.5 text-[12px] font-light rounded-lg transition",
                    mode === "paid"
                      ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Paid only
                </button>
                <button
                  type="button"
                  onClick={() => setMode("all")}
                  className={cn(
                    "px-3 py-1.5 text-[12px] font-light rounded-lg transition",
                    mode === "all"
                      ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  All invoices
                </button>
              </div>
            </div>

            <button
              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0 px-6 sm:px-8 pb-8 pt-6 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className={cn("rounded-2xl border border-neutral-200 bg-neutral-50/50 px-6 py-5", CARD_SHADOW)}>
                <div className="text-[12px] font-light tracking-[0.16em] text-neutral-500">
                  {mode === "paid" ? "TOTAL REVENUE (PAID)" : "TOTAL REVENUE (ALL)"}
                </div>
                <div className="mt-2 text-[22px] font-light text-neutral-950">{formatMoneyEUR(totalRevenue)}</div>
              </div>

              <div className={cn("rounded-2xl border border-neutral-200 bg-neutral-50/50 px-6 py-5", CARD_SHADOW)}>
                <div className="text-[12px] font-light tracking-[0.16em] text-neutral-500">
                  {mode === "paid" ? "PAID INVOICES" : "INVOICES"}
                </div>
                <div className="mt-2 text-[22px] font-light text-neutral-950">{invoiceCount}</div>
              </div>

              <div className={cn("rounded-2xl border border-neutral-200 bg-neutral-50/50 px-6 py-5", CARD_SHADOW)}>
                <div className="text-[12px] font-light tracking-[0.16em] text-neutral-500">AVERAGE INVOICE</div>
                <div className="mt-2 text-[22px] font-light text-neutral-950">{formatMoneyEUR(avgInvoice)}</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[14px] font-light text-neutral-800">Revenue Progression</div>
              <div className={cn("mt-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5", CARD_SHADOW)}>
                <RevenueChart points={points} height={280} />
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[14px] font-light text-neutral-800">Invoice Breakdown</div>
              <div className={cn("mt-3 rounded-2xl border border-neutral-200 bg-white", CARD_SHADOW)}>
                {!ownerId && !businessProfileId ? (
                  <div className="px-6 py-6 text-[13px] font-light text-neutral-500">Loading user…</div>
                ) : loading ? (
                  <div className="px-6 py-6 text-[13px] font-light text-neutral-500">Loading…</div>
                ) : filteredRows.length === 0 ? (
                  <div className="px-6 py-8 text-[13px] font-light text-neutral-500">
                    {mode === "paid" ? "No paid invoices for this month." : "No invoices for this month."}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {filteredRows.map((r) => {
                      const dt = new Date((r.issued_at || r.created_at || new Date().toISOString()) as string);
                      const client = r.client_id ? clientMap.get(String(r.client_id)) : null;

                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onInvoiceClick(r.id)}
                          className="w-full text-left px-6 py-4 hover:bg-neutral-50/60 transition"
                        >
                          <div className="grid grid-cols-[110px_1fr_90px_120px] sm:grid-cols-[120px_1fr_120px_140px] items-center gap-2">
                            <div className="text-[13px] font-light text-neutral-700">{(r.invoice_number ?? "—").trim()}</div>
                            <div className="text-[13px] font-light text-neutral-700">{fullName(client)}</div>
                            <div className="text-[13px] font-light text-neutral-500">
                              {dt.toLocaleString("en-US", { month: "short", day: "numeric" })}
                            </div>
                            <div className="text-right text-[13px] font-light text-neutral-900">
                              {formatMoneyEUR(Number(r.total ?? 0))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [businessProfileId, setBusinessProfileId] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());

  const [revenueOpen, setRevenueOpen] = useState(false);

  // ✅ Quick task modals
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createAppointmentOpen, setCreateAppointmentOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  // ✅ one refresh function – called after create/save
  const refreshAll = useCallback(async () => {
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      let bpId: string | null = businessProfileId;

      if (!bpId) {
        const bp1 = await supabase
          .from("business_profiles")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        bpId = (bp1.data as any)?.id ?? null;

        if (!bpId) {
          const bp2 = await supabase
            .from("business_profiles")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          bpId = (bp2.data as any)?.id ?? null;
        }

        if (!bpId) {
          const prof = await supabase.from("profiles").select("business_profile_id").eq("id", user.id).maybeSingle();
          bpId = (prof.data as any)?.business_profile_id ?? null;
        }

        setBusinessProfileId(bpId);
      }

      if (!bpId) return;

      const fiveMinAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const in90DaysIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const results = await Promise.allSettled([
        supabase.from("clients").select("id, first_name, last_name").eq("business_profile_id", bpId).order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, invoice_number, status, total, issued_at, created_at, client_id")
          .eq("business_profile_id", bpId)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id, status").eq("business_profile_id", bpId).order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("id, starts_at, ends_at, type, notes, client_id")
          .eq("business_profile_id", bpId)
          .not("starts_at", "is", null)
          .gte("starts_at", fiveMinAgoIso)
          .lte("starts_at", in90DaysIso)
          .order("starts_at", { ascending: true })
          .limit(30),
      ]);

      // clients
      if (results[0].status === "fulfilled") {
        const { data, error } = results[0].value;
        if (error) {
          logSbError("[Dashboard] clients refresh failed", error);
          setClients([]);
          setClientMap(new Map());
        } else {
          const arr = (data ?? []) as any as ClientRow[];
          setClients(arr);
          const map = new Map<string, ClientRow>();
          for (const c of arr) map.set(String(c.id), c);
          setClientMap(map);
        }
      }

      // invoices
      if (results[1].status === "fulfilled") {
        const { data, error } = results[1].value;
        if (error) {
          logSbError("[Dashboard] invoices refresh failed", error);
          setInvoices([]);
        } else {
          setInvoices((data ?? []) as any);
        }
      }

      // projects
      if (results[2].status === "fulfilled") {
        const { data, error } = results[2].value;
        if (error) {
          logSbError("[Dashboard] projects refresh failed", error);
          setProjects([]);
        } else {
          setProjects((data ?? []) as any);
        }
      }

      // appointments
      if (results[3].status === "fulfilled") {
        const { data, error } = results[3].value;
        if (error) {
          logSbError("[Dashboard] appointments refresh failed", error);
          setAppointments([]);
        } else {
          setAppointments((data ?? []) as any);
        }
      }
    } catch (e) {
      console.error("[Dashboard] refreshAll failed:", e);
    }
  }, [businessProfileId]);

  // initial load
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setFatal(null);

      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = auth.user;
        if (!user) {
          if (!alive) return;
          setOwnerId(null);
          setBusinessProfileId(null);
          setFatal("Not signed in.");
          setInvoices([]);
          setProjects([]);
          setClients([]);
          setAppointments([]);
          setClientMap(new Map());
          setLoading(false);
          return;
        }

        if (!alive) return;
        setOwnerId(user.id);

        let bpId: string | null = null;

        const bp1 = await supabase
          .from("business_profiles")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        bpId = (bp1.data as any)?.id ?? null;

        if (!bpId) {
          const bp2 = await supabase
            .from("business_profiles")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          bpId = (bp2.data as any)?.id ?? null;
        }

        if (!bpId) {
          const prof = await supabase.from("profiles").select("business_profile_id").eq("id", user.id).maybeSingle();
          bpId = (prof.data as any)?.business_profile_id ?? null;
        }

        if (!alive) return;
        setBusinessProfileId(bpId);

        if (!bpId) {
          setFatal("No business profile found. Create/select one first.");
          setClients([]);
          setClientMap(new Map());
          setInvoices([]);
          setProjects([]);
          setAppointments([]);
          setLoading(false);
          return;
        }

        const fiveMinAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const in90DaysIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const results = await Promise.allSettled([
          supabase.from("clients").select("id, first_name, last_name").eq("business_profile_id", bpId).order("created_at", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, invoice_number, status, total, issued_at, created_at, client_id")
            .eq("business_profile_id", bpId)
            .order("created_at", { ascending: false }),
          supabase.from("projects").select("id, status").eq("business_profile_id", bpId).order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select("id, starts_at, ends_at, type, notes, client_id")
            .eq("business_profile_id", bpId)
            .not("starts_at", "is", null)
            .gte("starts_at", fiveMinAgoIso)
            .lte("starts_at", in90DaysIso)
            .order("starts_at", { ascending: true })
            .limit(3),
        ]);

        if (!alive) return;

        // clients
        if (results[0].status === "fulfilled") {
          const { data, error } = results[0].value;
          if (error) {
            logSbError("[Dashboard] clients load failed", error);
            setClients([]);
            setClientMap(new Map());
          } else {
            const clientsArr = (data ?? []) as any as ClientRow[];
            setClients(clientsArr);
            const map = new Map<string, ClientRow>();
            for (const c of clientsArr) map.set(String(c.id), c);
            setClientMap(map);
          }
        } else {
          logSbError("[Dashboard] clients load crashed", results[0].reason);
          setClients([]);
          setClientMap(new Map());
        }

        // invoices
        if (results[1].status === "fulfilled") {
          const { data, error } = results[1].value;
          if (error) {
            logSbError("[Dashboard] invoices load failed", error);
            setInvoices([]);
          } else {
            setInvoices((data ?? []) as any);
          }
        } else {
          logSbError("[Dashboard] invoices load crashed", results[1].reason);
          setInvoices([]);
        }

        // projects
        if (results[2].status === "fulfilled") {
          const { data, error } = results[2].value;
          if (error) {
            logSbError("[Dashboard] projects load failed", error);
            setProjects([]);
          } else {
            setProjects((data ?? []) as any);
          }
        } else {
          logSbError("[Dashboard] projects load crashed", results[2].reason);
          setProjects([]);
        }

        // appointments
        if (results[3].status === "fulfilled") {
          const { data, error } = results[3].value;
          if (error) {
            logSbError("[Dashboard] appointments load failed", error);
            setAppointments([]);
          } else {
            setAppointments((data ?? []) as any);
          }
        } else {
          logSbError("[Dashboard] appointments load crashed", results[3].reason);
          setAppointments([]);
        }
      } catch (e: any) {
        if (!alive) return;
        console.error("[Dashboard] load failed:", e);
        setFatal(e?.message ?? "Dashboard failed to load.");
        setOwnerId(null);
        setBusinessProfileId(null);
        setInvoices([]);
        setProjects([]);
        setClients([]);
        setAppointments([]);
        setClientMap(new Map());
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const monthRevenue = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();

    return invoices.reduce((sum, inv) => {
      const iso = inv.issued_at || inv.created_at || null;
      if (!iso) return sum;

      const d = new Date(iso);
      if (d.getFullYear() !== y || d.getMonth() !== m) return sum;

      const status = String(inv.status || "").toLowerCase();
      if (status !== "paid") return sum;

      return sum + Number(inv.total ?? 0);
    }, 0);
  }, [invoices, now]);

  const openInvoicesCount = useMemo(
    () => invoices.filter((x) => String(x.status || "").toLowerCase() !== "paid").length,
    [invoices]
  );

  const activeProjectsCount = useMemo(() => {
    return projects.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return s === "in_progress" || s === "active" || s === "open" || s === "in progress";
    }).length;
  }, [projects]);

  const totalClientsCount = useMemo(() => clients.length, [clients]);

  const openInvoicesList = useMemo(() => invoices.filter((x) => String(x.status || "").toLowerCase() !== "paid"), [invoices]);

  return (
    // ✅ LOCK PAGE SCROLL
    <div className="h-screen bg-neutral-50 overflow-hidden">
      {/* ✅ FIXED LAYOUT: header + content, but NO page scroll */}
      <div className="h-full px-6 sm:px-10 pt-8 sm:pt-10 pb-8 flex flex-col min-h-0">
        {/* Top header row */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[34px] sm:text-[40px] font-extralight leading-none tracking-tight text-neutral-950">
              Overview
            </div>
            <div className="mt-3 text-[14px] font-light text-neutral-500">{formatDateLong(now)}</div>

            {fatal ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-light text-red-700">
                {fatal}
              </div>
            ) : null}

            {!fatal && ownerId && !businessProfileId ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-light text-amber-700">
                No business profile linked to this user.
              </div>
            ) : null}
          </div>

          {/* Quick tasks */}
          <div className="hidden lg:flex items-center gap-10 pt-2 shrink-0">
            <button
              type="button"
              onClick={() => setCreateClientOpen(true)}
              className="group inline-flex items-center gap-3 text-[13px] font-light text-neutral-600 hover:text-neutral-900"
            >
              <UserPlus size={18} strokeWidth={1.5} className="text-neutral-500 group-hover:text-neutral-900" />
              <span>New Client</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateProjectOpen(true)}
              className="group inline-flex items-center gap-3 text-[13px] font-light text-neutral-600 hover:text-neutral-900"
            >
              <FolderPlus size={18} strokeWidth={1.5} className="text-neutral-500 group-hover:text-neutral-900" />
              <span>New Project</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateAppointmentOpen(true)}
              className="group inline-flex items-center gap-3 text-[13px] font-light text-neutral-600 hover:text-neutral-900"
            >
              <CalendarPlus size={18} strokeWidth={1.5} className="text-neutral-500 group-hover:text-neutral-900" />
              <span>New Appointment</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateInvoiceOpen(true)}
              className="group inline-flex items-center gap-3 text-[13px] font-light text-neutral-600 hover:text-neutral-900"
            >
              <FileText size={18} strokeWidth={1.5} className="text-neutral-500 group-hover:text-neutral-900" />
              <span>New Invoice</span>
            </button>
          </div>
        </div>

        {/* mobile quick tasks */}
        <div className="mt-6 flex lg:hidden flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCreateClientOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-light text-neutral-700 hover:bg-neutral-50"
          >
            <UserPlus size={16} strokeWidth={1.5} className="text-neutral-500" />
            New Client
          </button>
          <button
            type="button"
            onClick={() => setCreateProjectOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-light text-neutral-700 hover:bg-neutral-50"
          >
            <FolderPlus size={16} strokeWidth={1.5} className="text-neutral-500" />
            New Project
          </button>
          <button
            type="button"
            onClick={() => setCreateAppointmentOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-light text-neutral-700 hover:bg-neutral-50"
          >
            <CalendarPlus size={16} strokeWidth={1.5} className="text-neutral-500" />
            New Appointment
          </button>
          <button
            type="button"
            onClick={() => setCreateInvoiceOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-light text-neutral-700 hover:bg-neutral-50"
          >
            <FileText size={16} strokeWidth={1.5} className="text-neutral-500" />
            New Invoice
          </button>
        </div>

        {/* Top KPI cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
          <button
            type="button"
            onClick={() => setRevenueOpen(true)}
            className={cn(
              "text-left rounded-2xl border border-neutral-200 bg-white px-7 py-6",
              "transition hover:bg-neutral-50/60",
              CARD_SHADOW
            )}
          >
            <div className="text-[12px] font-light tracking-[0.18em] text-neutral-500">MONTHLY REVENUE</div>
            <div className="mt-3 text-[38px] sm:text-[40px] font-extralight text-neutral-950">{formatMoneyEUR(monthRevenue)}</div>
            <div className="mt-2 text-[12px] font-light text-neutral-400">{formatMonthYear(now)}</div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/app/invoices")}
            className={cn(
              "text-left rounded-2xl border border-neutral-200 bg-white px-7 py-6",
              "transition hover:bg-neutral-50/60",
              CARD_SHADOW
            )}
          >
            <div className="text-[12px] font-light tracking-[0.18em] text-neutral-500">OPEN INVOICES</div>
            <div className="mt-3 text-[38px] sm:text-[40px] font-extralight text-neutral-950">{openInvoicesCount}</div>
            <div className="mt-2 text-[12px] font-light text-neutral-400">Awaiting payment</div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/app/projects")}
            className={cn(
              "text-left rounded-2xl border border-neutral-200 bg-white px-7 py-6",
              "transition hover:bg-neutral-50/60",
              CARD_SHADOW
            )}
          >
            <div className="text-[12px] font-light tracking-[0.18em] text-neutral-500">ACTIVE PROJECTS</div>
            <div className="mt-3 text-[38px] sm:text-[40px] font-extralight text-neutral-950">{activeProjectsCount}</div>
            <div className="mt-2 text-[12px] font-light text-neutral-400">In progress</div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/app/clients")}
            className={cn(
              "text-left rounded-2xl border border-neutral-200 bg-white px-7 py-6",
              "transition hover:bg-neutral-50/60",
              CARD_SHADOW
            )}
          >
            <div className="text-[12px] font-light tracking-[0.18em] text-neutral-500">TOTAL CLIENTS</div>
            <div className="mt-3 text-[38px] sm:text-[40px] font-extralight text-neutral-950">{totalClientsCount}</div>
            <div className="mt-2 text-[12px] font-light text-neutral-400">All time</div>
          </button>
        </div>

        {/* Attention */}
        <div className={cn("mt-6 rounded-2xl border border-neutral-200 bg-white px-7 py-6", CARD_SHADOW)}>
          <div className="flex items-start gap-3">
            <div className="mt-[2px] h-6 w-6 rounded-full border border-neutral-200 bg-neutral-50" />
            <div>
              <div className="text-[14px] font-light text-neutral-900">Attention Needed</div>
              <div className="mt-2 text-[13px] font-light text-neutral-500">1 project awaiting confirmation</div>
            </div>
          </div>
        </div>

        {/* ✅ BOTTOM SECTION takes remaining height; lists scroll INSIDE */}
        <div className="mt-6 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Appointments */}
          <div className={cn("rounded-2xl border border-neutral-200 bg-white px-7 py-6 flex flex-col min-h-0", CARD_SHADOW)}>
            <div className="text-[18px] font-light text-neutral-950">Upcoming Appointments</div>

            {loading ? (
              <div className="mt-6 text-[13px] font-light text-neutral-500">Loading…</div>
            ) : appointments.length === 0 ? (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
                    <CalendarPlus size={18} strokeWidth={1.5} className="text-neutral-400" />
                  </div>
                  <div className="mt-4 text-[13px] font-light text-neutral-400">No upcoming appointments</div>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                {appointments.map((a) => {
                  const dt = new Date(a.starts_at || new Date().toISOString());
                  const day = dt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
                  const mon = dt.toLocaleString("en-US", { month: "short" }).toUpperCase();
                  const dnum = dt.getDate();
                  const time = dt.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const client = a.client_id ? clientMap.get(String(a.client_id)) : null;

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => router.push(`/app/appointments/${a.id}`)}
                      className={cn(
                        "w-full text-left rounded-2xl border border-neutral-200 bg-neutral-50/40 px-5 py-4",
                        "transition hover:bg-neutral-50"
                      )}
                    >
                      <div className="grid grid-cols-[90px_1fr] gap-5 items-center">
                        <div className="text-center">
                          <div className="text-[11px] font-light tracking-[0.16em] text-neutral-500">
                            {day}, {mon}
                          </div>
                          <div className="mt-1 text-[18px] font-light text-neutral-900">{dnum}</div>
                          <div className="mt-1 text-[13px] font-light text-neutral-600">{time}</div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-[15px] font-light text-neutral-950 truncate">{fullName(client)}</div>
                          <div className="mt-1 text-[13px] font-light text-neutral-500 truncate">
                            {(a.type ?? "Appointment").trim()}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open invoices */}
          <div className={cn("rounded-2xl border border-neutral-200 bg-white px-7 py-6 flex flex-col min-h-0", CARD_SHADOW)}>
            <div className="text-[18px] font-light text-neutral-950">Open Invoices</div>

            {loading ? (
              <div className="mt-6 text-[13px] font-light text-neutral-500">Loading…</div>
            ) : openInvoicesList.length === 0 ? (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
                    <FileText size={18} strokeWidth={1.5} className="text-neutral-400" />
                  </div>
                  <div className="mt-4 text-[13px] font-light text-neutral-400">No open invoices</div>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                {openInvoicesList.map((inv) => {
                  const client = inv.client_id ? clientMap.get(String(inv.client_id)) : null;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => router.push(`/app/invoices/${inv.id}`)}
                      className={cn(
                        "w-full text-left rounded-2xl border border-neutral-200 bg-neutral-50/40 px-5 py-4",
                        "transition hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[13px] font-light text-neutral-900 truncate">
                            {(inv.invoice_number ?? "—").trim()}
                          </div>
                          <div className="mt-1 text-[13px] font-light text-neutral-500 truncate">{fullName(client)}</div>
                        </div>
                        <div className="text-[14px] font-light text-neutral-900 shrink-0">
                          {formatMoneyEUR(Number(inv.total ?? 0))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <RevenueModal
          open={revenueOpen}
          onOpenChange={setRevenueOpen}
          initialMonth={now}
          ownerId={ownerId}
          businessProfileId={businessProfileId}
          clientMap={clientMap}
          onInvoiceClick={(id) => {
            setRevenueOpen(false);
            router.push(`/app/invoices/${id}`);
          }}
        />

        {/* Quick task modals */}
        <ClientFormModal
          open={createClientOpen}
          mode="create"
          client={null as any}
          onClose={() => setCreateClientOpen(false)}
          onSaved={async () => {
            setCreateClientOpen(false);
            await refreshAll();
          }}
        />

        <ProjectFormModal
          open={createProjectOpen}
          mode="create"
          project={null as any}
          onClose={() => setCreateProjectOpen(false)}
          onSaved={async () => {
            setCreateProjectOpen(false);
            await refreshAll();
          }}
        />

        <AppointmentFormModal
          open={createAppointmentOpen}
          mode="create"
          appointment={null as any}
          onClose={() => setCreateAppointmentOpen(false)}
          onSaved={async () => {
            setCreateAppointmentOpen(false);
            await refreshAll();
          }}
        />

        <InvoiceFormModal
          open={createInvoiceOpen}
          mode="create"
          invoice={null as any}
          onClose={() => setCreateInvoiceOpen(false)}
          onSaved={async () => {
            setCreateInvoiceOpen(false);
            await refreshAll();
          }}
        />
      </div>
    </div>
  );
}