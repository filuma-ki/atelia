"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, MoreVertical, Check, ChevronDown, FileText } from "lucide-react";
import ProjectFormModal from "@/components/projects/ProjectFormModal";
import * as SelectPrimitive from "@radix-ui/react-select";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type UiStatus = "Inquiry" | "In Progress" | "Completed";

export type Project = {
  id: string;
  title: string;
  status: UiStatus;
  client_id: string | null;
  client_name?: string | null; // joined / mapped
  estimated_budget: number | null;
  final_approved_total: number | null;
  updated_at: string | null;
};

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

const STATUS_FILTERS: Array<{ value: "all" | UiStatus; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "Inquiry", label: "Inquiry" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
];

function formatEUR(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function StatusPill({ status }: { status?: UiStatus | null }) {
  const s = status ?? null;
  const cls =
    s === "In Progress"
      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
      : s === "Completed"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
      : s === "Inquiry"
      ? "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
      : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200";

  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2.5 py-1",
        "text-[12px] font-light leading-none",
        cls,
      ].join(" ")}
    >
      {s ?? "—"}
    </span>
  );
}

/** Minimal Radix select (matches your style) */
function SelectField({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={[
          "flex h-10 w-[200px] items-center justify-between rounded-lg",
          "border border-neutral-200 bg-white px-3 text-[13px] font-light text-neutral-900",
          "outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200",
        ].join(" ")}
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
          className={[
            "z-[9999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
            "border border-neutral-200 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
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

type MenuPos = { top: number; left: number };

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); // ✅ Hook gehört hier rein

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Project | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  function logSupabaseError(prefix: string, e: any) {
    try {
      console.error(prefix, e);
      console.error(prefix + " (json)", JSON.stringify(e, null, 2));
      console.error(prefix + " keys", e ? Object.keys(e) : "no error object");
    } catch {
      console.error(prefix, e);
    }
  }

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPos(null);
  }

  function goToDetails(id: string) {
    closeMenu();
    router.push(`/app/projects/${id}`);
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

async function createInvoiceFromProject(projectId: string) {
  try {
    console.log("[ProjectsPage] create invoice click", projectId);

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    const user = auth.user;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase.rpc("create_invoice_from_project", {
      p_project_id: projectId,
    });

    if (error) throw error;

    const invoiceId = normalizeInvoiceId(data);
    if (!invoiceId) throw new Error("RPC returned no invoice id");

    console.log("[ProjectsPage] invoice created", invoiceId);

    // ✅ route ggf. anpassen, falls du /invoices statt /app/invoices hast
    router.push(`/app/invoices?open=${invoiceId}`);
  } catch (e) {
    logSupabaseError("[ProjectsPage] create invoice failed:", e);
    alert("Create invoice failed — check console.");
  } finally {
    closeMenu();
  }
}

  async function refresh() {
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = auth.user;
      if (!user) {
        setProjects([]);
        return;
      }

      // 1) Projects laden (OHNE join)
      const { data: projRows, error: projErr } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          client_id,
          estimated_budget,
          final_approved_total,
          updated_at,
          created_at
        `
        )
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (projErr) throw projErr;

      const projectsOnly: Project[] = (projRows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        status: (row.status as UiStatus) ?? "Inquiry",
        client_id: row.client_id ?? null,
        estimated_budget:
          row.estimated_budget !== null && row.estimated_budget !== undefined ? Number(row.estimated_budget) : null,
        final_approved_total:
          row.final_approved_total !== null && row.final_approved_total !== undefined
            ? Number(row.final_approved_total)
            : null,
        updated_at: row.updated_at ?? row.created_at ?? null,
        client_name: null,
      }));

      // 2) Clients nachladen (nur die IDs, die in Projects vorkommen)
      const clientIds = Array.from(new Set(projectsOnly.map((p) => p.client_id).filter(Boolean))) as string[];

      const clientMap = new Map<string, any>();
      if (clientIds.length > 0) {
        const { data: clientRows, error: clientErr } = await supabase
          .from("clients")
          .select("*")
          .eq("owner_id", user.id)
          .in("id", clientIds);

        if (clientErr) throw clientErr;

        (clientRows ?? []).forEach((c: any) => clientMap.set(c.id, c));
      }

      const pickClientLabel = (c: any): string | null => {
        if (!c) return null;

        const candidates = [c.name, c.full_name, c.client_name, c.display_name, c.company, c.title].filter(
          (x) => typeof x === "string" && x.trim().length > 0
        ) as string[];

        if (candidates.length > 0) return candidates[0];

        const first = typeof c.first_name === "string" ? c.first_name.trim() : "";
        const last = typeof c.last_name === "string" ? c.last_name.trim() : "";
        const combo = `${first} ${last}`.trim();
        if (combo) return combo;

        // last resort: email
        if (typeof c.email === "string" && c.email.trim()) return c.email.trim();

        return null;
      };

      const mapped: Project[] = projectsOnly.map((p) => {
        const c = p.client_id ? clientMap.get(p.client_id) : null;
        return { ...p, client_name: pickClientLabel(c) };
      });

      setProjects(mapped);
    } catch (e) {
      logSupabaseError("Load projects failed:", e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ edit via ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;

    const p = projects.find((x) => x.id === editId);
    if (!p) return;

    setMode("edit");
    setSelected(p);
    setModalOpen(true);

    router.replace("/app/projects");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projects]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesText = `${p.title} ${p.client_name ?? ""} ${p.status ?? ""}`.toLowerCase().includes(query);
      if (query && !matchesText) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, q, statusFilter]);

  function openMenuFor(id: string) {
    const btn = btnRefs.current[id];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const width = 208;
    const left = Math.max(12, r.right - width);
    const top = r.bottom + gap;
    setOpenMenuId(id);
    setMenuPos({ top, left });
  }

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
      const width = 208;
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

  async function handleDelete(project: Project) {
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      const { error } = await supabase.from("projects").delete().eq("id", project.id).eq("owner_id", user.id);
      if (error) throw error;

      await refresh();
    } catch (e) {
      logSupabaseError("Delete project failed:", e);
    } finally {
      closeMenu();
    }
  }

  const renderMenu = (p: Project) => {
    if (!openMenuId || openMenuId !== p.id || !menuPos) return null;

    return createPortal(
      <div
        ref={(el) => {
          menuRef.current = el;
        }}
        className={[
          "fixed z-[99999] w-52 overflow-hidden",
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
        ].join(" ")}
        style={{ top: menuPos.top, left: menuPos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={[
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-neutral-900",
            "hover:bg-neutral-50 transition",
          ].join(" ")}
          onClick={() => goToDetails(p.id)}
        >
          <span className="text-neutral-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <span>View Details</span>
        </button>

        <button
          type="button"
          className={[
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-neutral-900",
            "hover:bg-neutral-50 transition",
          ].join(" ")}
          onClick={() => {
  createInvoiceFromProject(p.id);
}}
        >
          <span className="text-neutral-500">
            <FileText size={16} strokeWidth={1.25} />
          </span>
          <span>Create Invoice</span>
        </button>

        <button
          type="button"
          className={[
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-neutral-900",
            "hover:bg-neutral-50 transition",
          ].join(" ")}
          onClick={() => {
            closeMenu();
            setMode("edit");
            setSelected(p);
            setModalOpen(true);
          }}
        >
          <span className="text-neutral-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 20h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>Edit</span>
        </button>

        <div className="h-px bg-neutral-200" />

        <button
          type="button"
          className={[
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-red-600",
            "hover:bg-red-50 transition",
          ].join(" ")}
          onClick={() => handleDelete(p)}
        >
          <span className="text-red-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 7l1 14h10l1-14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M9 7V4h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Delete</span>
        </button>
      </div>,
      document.body
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="w-full px-10 pt-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[40px] font-extralight leading-none tracking-tight text-neutral-950">Projects</div>
            <div className="mt-2 text-sm font-light text-neutral-500">{projects.length} total projects</div>
          </div>

          <button
            onClick={() => {
              setMode("create");
              setSelected(null);
              setModalOpen(true);
            }}
            className={[
              "inline-flex items-center gap-2 rounded-lg bg-neutral-950",
              "px-5 py-3 text-[13px] font-light text-white",
              "transition hover:bg-neutral-900",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:ring-offset-2 focus:ring-offset-neutral-50",
            ].join(" ")}
          >
            <Plus size={16} />
            Add Project
          </button>
        </div>

        {/* Search + Filter Row */}
        <div className="mt-8 flex items-center gap-4">
          <div
            className={[
              "flex w-[480px] items-center gap-3 rounded-lg",
              "border border-neutral-200 bg-white px-3 py-2",
              "transition",
              "focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-200",
            ].join(" ")}
          >
            <Search size={16} className="text-neutral-400" />
            <input
              className="w-full bg-transparent text-[13px] font-light text-neutral-900 placeholder:font-light placeholder:text-neutral-400 outline-none"
              placeholder="Search projects..."
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
            onValueChange={setStatusFilter}
            options={STATUS_FILTERS.map((x) => ({ value: x.value, label: x.label }))}
          />
        </div>

        {/* Table */}
        <div className="mt-6">
          <div className={["rounded-xl border border-neutral-200 bg-white", CARD_SHADOW].join(" ")}>
            <div className="grid grid-cols-[1.2fr_1.1fr_0.8fr_0.7fr_0.7fr_52px] border-b border-neutral-200 bg-neutral-50/40 px-6 py-3">
              <div className="text-[13px] font-light text-neutral-500">Project</div>
              <div className="text-[13px] font-light text-neutral-500">Client</div>
              <div className="text-[13px] font-light text-neutral-500">Status</div>
              <div className="text-[13px] font-light text-neutral-500">Est. Budget</div>
              <div className="text-[13px] font-light text-neutral-500 text-right">Final Total</div>
              <div />
            </div>

            {loading ? (
              <div className="px-6 py-6 text-[13px] font-light text-neutral-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="text-[13px] font-medium text-neutral-900">No projects found</div>
                <div className="mt-2 text-[13px] font-light text-neutral-500">
                  Try another search, change status, or add a new project.
                </div>
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className={[
                    "relative grid grid-cols-[1.2fr_1.1fr_0.8fr_0.7fr_0.7fr_52px]",
                    "px-6 py-4",
                    "border-b border-neutral-100 last:border-b-0",
                    "hover:bg-neutral-50/60 transition",
                  ].join(" ")}
                  onClick={() => goToDetails(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") goToDetails(p.id);
                  }}
                >
                  <div className="text-[14px] font-light text-neutral-950">{p.title}</div>
                  <div className="text-[14px] font-light text-neutral-700">{p.client_name ?? "—"}</div>
                  <div className="flex items-center">
                    <StatusPill status={p.status} />
                  </div>
                  <div className="text-[14px] font-light text-neutral-900">{formatEUR(p.estimated_budget)}</div>
                  <div className="text-[14px] font-light text-neutral-900 text-right">{formatEUR(p.final_approved_total)}</div>

                  <div className="flex justify-end">
                    <button
                      ref={(el) => {
                        btnRefs.current[p.id] = el;
                      }}
                      type="button"
                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openMenuId === p.id) closeMenu();
                        else openMenuFor(p.id);
                      }}
                      aria-label="Actions"
                    >
                      <MoreVertical size={16} strokeWidth={1.25} />
                    </button>
                    {renderMenu(p)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <ProjectFormModal
          open={modalOpen}
          mode={mode}
          project={selected}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            await refresh();
          }}
        />
      </div>
    </div>
  );
}