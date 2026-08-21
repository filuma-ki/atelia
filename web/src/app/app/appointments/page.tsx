"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  MoreVertical,
  Check,
  ChevronDown,
  Calendar as CalIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { supabase } from "@/lib/supabaseClient";
import AppointmentFormModal, { AppointmentDraft } from "@/components/appointments/AppointmentFormModal";

type TimeFilter = "all" | "upcoming" | "past";

export type Appointment = {
  id: string;
  owner_id: string;
  business_profile_id: string;

  client_id: string | null;
  starts_at: string; // timestamptz
  ends_at: string | null; // timestamptz

  type: string | null;
  notes: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  // derived UI
  client_name?: string | null;
};

type ClientRow = {
  id: string;
  business_profile_id?: string | null;
  owner_id?: string | null;

  name?: string | null;
  full_name?: string | null;
  client_name?: string | null;
  display_name?: string | null;
  company?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseDEDateTime(text: string): Date | null {
  const s = text.trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4]);
  const MM = Number(m[5]);
  const d = new Date(yyyy, mm - 1, dd, HH, MM, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function formatInputDE(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
}
function formatDateLong(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}
function formatMonthTitle(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function slimLabel(s?: string | null, max = 22) {
  const t = (s ?? "").trim();
  if (!t) return "—";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function TypePill({ label }: { label?: string | null }) {
  const text = (label ?? "").trim();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1",
        "text-[12px] font-light leading-none",
        "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
      )}
    >
      {text || "—"}
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

function pickClientLabel(c: any): string | null {
  if (!c) return null;
  const candidates = [c.name, c.full_name, c.client_name, c.display_name, c.company, c.title].filter(
    (x) => typeof x === "string" && x.trim().length > 0
  ) as string[];
  if (candidates.length > 0) return candidates[0];

  const first = typeof c.first_name === "string" ? c.first_name.trim() : "";
  const last = typeof c.last_name === "string" ? c.last_name.trim() : "";
  const combo = `${first} ${last}`.trim();
  if (combo) return combo;

  if (typeof c.email === "string" && c.email.trim()) return c.email.trim();
  return null;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}

// Best-effort resolver (keine harte Annahme über dein Schema)
async function resolveBusinessProfileId(userId: string): Promise<string | null> {
  try {
    const r1 = await supabase
      .from("business_profiles")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (r1.data?.id) return r1.data.id as string;
  } catch {}

  try {
    const r2 = await supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (r2.data?.id) return r2.data.id as string;
  } catch {}

  try {
    const r3 = await supabase.from("profiles").select("business_profile_id").eq("id", userId).maybeSingle();
    const id = (r3.data as any)?.business_profile_id;
    if (typeof id === "string" && id) return id;
  } catch {}

  return null;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [userId, setUserId] = useState<string | null>(null);
  const [businessProfileId, setBusinessProfileId] = useState<string | null>(null);

  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Appointment | null>(null);

  // detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);

  // menu
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
    const width = 224;
    const left = Math.max(12, r.right - width);
    const top = r.bottom + gap;
    setOpenMenuId(id);
    setMenuPos({ top, left });
  }

  const getClientName = (client_id: string | null | undefined, fallback?: string | null) => {
    if (!client_id) return fallback ?? null;
    const c = clientMap.get(client_id);
    return pickClientLabel(c) ?? fallback ?? null;
  };

  async function loadClients(bpId: string) {
    try {
      const { data, error } = await supabase.from("clients").select("*").eq("business_profile_id", bpId);
      if (error) throw error;

      const m = new Map<string, ClientRow>();
      (data ?? []).forEach((c: any) => m.set(c.id, c));
      setClientMap(m);
    } catch {
      setClientMap(new Map());
    }
  }

  async function refresh(bpId: string) {
  setLoading(true);
  setFatal(null);

  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("business_profile_id", bpId)
      .order("starts_at", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as any[];

    // normalize appointments first
    const normalized: Appointment[] = rows.map((x) => ({
      id: String(x.id),
      owner_id: String(x.owner_id),
      business_profile_id: String(x.business_profile_id),
      client_id: x.client_id ?? null,
      starts_at: String(x.starts_at),
      ends_at: x.ends_at ? String(x.ends_at) : null,
      type: x.type ?? null,
      notes: x.notes ?? null,
      created_at: x.created_at ?? null,
      updated_at: x.updated_at ?? null,
      client_name: null,
    }));

    // ---- ✅ hydrate client names (fetch only used client IDs)
    const ids = Array.from(
      new Set(normalized.map((a) => a.client_id).filter((x): x is string => typeof x === "string" && x.length > 0))
    );

    if (ids.length > 0) {
      // Try strict (bp filtered) first
      let clientRows: any[] = [];
      const r1 = await supabase.from("clients").select("*").eq("business_profile_id", bpId).in("id", ids);

      if (!r1.error && Array.isArray(r1.data)) {
        clientRows = r1.data;
      } else {
        // fallback: in case some old clients miss business_profile_id
        const r2 = await supabase.from("clients").select("*").in("id", ids);
        if (!r2.error && Array.isArray(r2.data)) clientRows = r2.data;
      }

      if (clientRows.length > 0) {
        // update map (merge)
        setClientMap((prev) => {
          const m = new Map(prev);
          clientRows.forEach((c) => m.set(String(c.id), c));
          return m;
        });

        // also bake client_name into appointment rows (so list always shows)
        const localClientMap = new Map<string, any>();
        clientRows.forEach((c) => localClientMap.set(String(c.id), c));

        normalized.forEach((a) => {
          const c = a.client_id ? localClientMap.get(a.client_id) : null;
          a.client_name = pickClientLabel(c) ?? null;
        });
      }
    }

    setAppointments(normalized);
  } catch (e: any) {
    setAppointments([]);
    setFatal(e?.message ?? "Failed to load appointments.");
  } finally {
    setLoading(false);
  }
}

  // boot
  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);
      setFatal(null);

      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = auth.user;
        if (!user) {
          if (!alive) return;
          setUserId(null);
          setBusinessProfileId(null);
          setAppointments([]);
          setClientMap(new Map());
          setFatal("You are not signed in.");
          return;
        }

        const bpId = await resolveBusinessProfileId(user.id);
        if (!bpId) {
          if (!alive) return;
          setUserId(user.id);
          setBusinessProfileId(null);
          setAppointments([]);
          setClientMap(new Map());
          setFatal("No business profile found. Create/select a business profile first.");
          return;
        }

        if (!alive) return;
        setUserId(user.id);
        setBusinessProfileId(bpId);

        await Promise.all([loadClients(bpId), refresh(bpId)]);
      } catch (e: any) {
        if (!alive) return;
        setFatal(e?.message ?? "Failed to initialize appointments.");
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // menu close handlers
  useEffect(() => {
    if (!openMenuId) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    function onDown(e: MouseEvent) {
      const btn = openMenuId !== null ? btnRefs.current[openMenuId] : null;
      if (btn && btn.contains(e.target as Node)) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeMenu();
    }
    function updatePos() {
      const btn = btnRefs.current[openMenuId];
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const gap = 8;
      const width = 224;
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

  // detail escape
  useEffect(() => {
    if (!detailOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetailOpen(false);
        setDetailAppt(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  const filtered = useMemo(() => {
    const now = new Date();
    const query = q.trim().toLowerCase();

    return appointments.filter((a) => {
      const dt = new Date(a.starts_at);
      const inTime =
        timeFilter === "all"
          ? true
          : timeFilter === "upcoming"
          ? dt.getTime() >= now.getTime()
          : dt.getTime() < now.getTime();

      if (!inTime) return false;

      const clientName = getClientName(a.client_id, a.client_name) ?? "";

      if (!query) return true;
      const hay = `${clientName} ${a.type ?? ""} ${a.notes ?? ""} ${formatDateLong(dt)} ${formatTime(dt)}`.toLowerCase();
      return hay.includes(query);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, q, timeFilter, clientMap]);

  const monthDays = useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);

    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    const end = new Date(last);
    end.setDate(last.getDate() + (6 - last.getDay()));

    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [month]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const d = new Date(a.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((x, y) => new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime());
      map.set(k, arr);
    }
    return map;
  }, [filtered]);

  const weeksInView = useMemo(() => {
    return Math.max(5, Math.min(6, Math.ceil(monthDays.length / 7)));
  }, [monthDays]);

  function openCreateModal(prefill?: Partial<AppointmentDraft>) {
    setMode("create");
    setSelected(null);
    setModalOpen(true);

    if (prefill?.starts_at_text || prefill?.client_id || prefill?.type || prefill?.notes) {
      setSelected({
        id: "__prefill__",
        owner_id: userId ?? "",
        business_profile_id: businessProfileId ?? "",
        starts_at: new Date().toISOString(),
        ends_at: null,
        client_id: prefill.client_id ?? null,
        client_name: null,
        type: prefill.type ?? null,
        notes: prefill.notes ?? null,
        updated_at: null,
      });
    }
  }

  function openEditModal(a: Appointment) {
    setMode("edit");
    setSelected(a);
    setModalOpen(true);
  }

  function openDetailsModal(a: Appointment) {
    setDetailAppt(a);
    setDetailOpen(true);
  }

  async function handleDelete(id: string) {
    if (!businessProfileId) return;

    const prev = appointments;
    const next = appointments.filter((x) => x.id !== id);
    setAppointments(next);

    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("business_profile_id", businessProfileId);

      if (error) throw error;

      if (detailAppt?.id === id) {
        setDetailOpen(false);
        setDetailAppt(null);
      }
    } catch {
      setAppointments(prev);
    }
  }

  const renderDetailModal = () => {
    if (!detailOpen || !detailAppt) return null;

    const d = new Date(detailAppt.starts_at);
    const clientName = getClientName(detailAppt.client_id, detailAppt.client_name);

    return createPortal(
      <div
        className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
        onMouseDown={() => {
          setDetailOpen(false);
          setDetailAppt(null);
        }}
      >
        <div
          className={cn(
            "w-[560px] max-w-[calc(100vw-24px)]",
            "rounded-2xl border border-neutral-200 bg-white",
            "shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 py-5 border-b border-neutral-100">
            <div>
              <div className="text-[18px] font-light text-neutral-950">Appointment Details</div>
              <div className="mt-1 text-[13px] font-light text-neutral-500">
                {formatDateLong(d)} · {formatTime(d)}
              </div>
            </div>

            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[13px] font-light text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              onClick={() => {
                setDetailOpen(false);
                setDetailAppt(null);
              }}
            >
              Close
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <div className="text-[12px] font-light tracking-wide text-neutral-400">CLIENT</div>
              <div className="mt-1 text-[14px] font-light text-neutral-900">{clientName ?? "—"}</div>
            </div>

            <div className="flex gap-6">
              <div className="flex-1">
                <div className="text-[12px] font-light tracking-wide text-neutral-400">TYPE</div>
                <div className="mt-1">
                  <TypePill label={detailAppt.type} />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-light tracking-wide text-neutral-400">DATE & TIME</div>
                <div className="mt-1 text-[14px] font-light text-neutral-900">
                  {formatDateLong(d)} · {formatTime(d)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12px] font-light tracking-wide text-neutral-400">NOTES</div>
              <div className="mt-1 text-[14px] font-light text-neutral-700 whitespace-pre-wrap">
                {detailAppt.notes?.trim() ? detailAppt.notes : "—"}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
                onClick={() => {
                  const a = detailAppt;
                  setDetailOpen(false);
                  setDetailAppt(null);
                  openEditModal(a);
                }}
              >
                Edit
              </button>

              <button
                type="button"
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-red-600 hover:bg-red-50"
                onClick={() => {
                  const id = detailAppt.id;
                  setDetailOpen(false);
                  setDetailAppt(null);
                  handleDelete(id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderMenu = (a: Appointment) => {
    if (!openMenuId || openMenuId !== a.id || !menuPos) return null;

    return createPortal(
      <div
        ref={(el) => {
          menuRef.current = el;
        }}
        className={cn(
          "fixed z-[99999] w-56 overflow-hidden",
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
        )}
        style={{ top: menuPos.top, left: menuPos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn(
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-neutral-900",
            "hover:bg-neutral-50 transition"
          )}
          onClick={() => {
            closeMenu();
            openDetailsModal(a);
          }}
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
          className={cn(
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-neutral-900",
            "hover:bg-neutral-50 transition"
          )}
          onClick={() => {
            closeMenu();
            openEditModal(a);
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
          className={cn(
            "w-full px-4 py-3 text-left",
            "flex items-center gap-3",
            "text-[13px] font-light text-red-600",
            "hover:bg-red-50 transition"
          )}
          onClick={() => {
            closeMenu();
            handleDelete(a.id);
          }}
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

  const modalInitial = useMemo(() => {
    if (mode === "edit" && selected && selected.id !== "__prefill__") {
      const d = new Date(selected.starts_at);
      return {
        client_id: selected.client_id ?? "",
        starts_at_text: formatInputDE(d),
        type: selected.type ?? "",
        notes: selected.notes ?? "",
      };
    }
    if (mode === "create" && selected && selected.id === "__prefill__") {
      return {
        client_id: selected.client_id ?? "",
        starts_at_text: formatInputDE(new Date()),
        type: selected.type ?? "",
        notes: selected.notes ?? "",
      };
    }
    return {
      client_id: "",
      starts_at_text: formatInputDE(new Date()),
      type: "",
      notes: "",
    };
  }, [mode, selected]);

  const canWrite = Boolean(userId && businessProfileId);

  return (
    <div className="min-h-screen bg-neutral-50">
      {renderDetailModal()}

      <div className="w-full px-10 pt-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[40px] font-extralight leading-none tracking-tight text-neutral-950">Appointments</div>

            {/* ✅ zweite Überschrift */}
            <div className="mt-2 text-[14px] font-light text-neutral-500">
              Manage sessions, calls, fittings — everything tied to your business profile.
            </div>

            <div className="mt-2 text-sm font-light text-neutral-500">
              {booting ? "Loading…" : `${appointments.length} total appointments`}
            </div>

            {fatal ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-light text-red-700">
                {fatal}
              </div>
            ) : null}
          </div>

          <button
            disabled={!canWrite}
            onClick={() => openCreateModal({ starts_at_text: formatInputDE(new Date()) })}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-neutral-950",
              "px-5 py-3 text-[13px] font-light text-white",
              "transition hover:bg-neutral-900",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:ring-offset-2 focus:ring-offset-neutral-50",
              !canWrite && "opacity-40 cursor-not-allowed hover:bg-neutral-950"
            )}
            title={!canWrite ? "Business profile missing" : "Add appointment"}
          >
            <Plus size={16} />
            Add Appointment
          </button>
        </div>

        <div className="mt-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex w-[480px] items-center gap-3 rounded-lg",
                "border border-neutral-200 bg-white px-3 py-2",
                "transition",
                "focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-200"
              )}
            >
              <Search size={16} className="text-neutral-400" />
              <input
                className="w-full bg-transparent text-[13px] font-light text-neutral-900 placeholder:font-light placeholder:text-neutral-400 outline-none"
                placeholder="Search appointments..."
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
              value={timeFilter}
              onValueChange={(v) => setTimeFilter(v as TimeFilter)}
              options={[
                { value: "all", label: "All Time" },
                { value: "upcoming", label: "Upcoming" },
                { value: "past", label: "Past" },
              ]}
            />
          </div>

          <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-light transition",
                view === "list"
                  ? "bg-neutral-50 text-neutral-950"
                  : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
              )}
            >
              <ListIcon size={16} strokeWidth={1.25} />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-light transition",
                view === "calendar"
                  ? "bg-neutral-50 text-neutral-950"
                  : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
              )}
            >
              <CalIcon size={16} strokeWidth={1.25} />
              Calendar
            </button>
          </div>
        </div>

        <div className="mt-6">
          {view === "list" ? (
            <div className={cn("rounded-xl border border-neutral-200 bg-white", CARD_SHADOW)}>
              <div className="grid grid-cols-[1fr_1fr_0.9fr_1.2fr_52px] border-b border-neutral-200 bg-neutral-50/40 px-6 py-3">
                <div className="text-[13px] font-light text-neutral-500">Date &amp; Time</div>
                <div className="text-[13px] font-light text-neutral-500">Client</div>
                <div className="text-[13px] font-light text-neutral-500">Type</div>
                <div className="text-[13px] font-light text-neutral-500">Notes</div>
                <div />
              </div>

              {loading ? (
                <div className="px-6 py-6 text-[13px] font-light text-neutral-500">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="text-[13px] font-medium text-neutral-900">No appointments found</div>
                  <div className="mt-2 text-[13px] font-light text-neutral-500">
                    Try another search, change time filter, or add a new appointment.
                  </div>
                </div>
              ) : (
                filtered.map((a) => {
                  const d = new Date(a.starts_at);
                  const clientName = getClientName(a.client_id, a.client_name);

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "relative grid grid-cols-[1fr_1fr_0.9fr_1.2fr_52px]",
                        "px-6 py-4",
                        "border-b border-neutral-100 last:border-b-0",
                        "hover:bg-neutral-50/60 transition"
                      )}
                      onClick={() => openDetailsModal(a)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openDetailsModal(a);
                      }}
                    >
                      <div>
                        <div className="text-[14px] font-light text-neutral-950">{formatDateLong(d)}</div>
                        <div className="text-[13px] font-light text-neutral-400">{formatTime(d)}</div>
                      </div>

                      <div className="flex items-center text-[14px] font-light text-neutral-700">{clientName ?? "—"}</div>

                      <div className="flex items-center">
                        <TypePill label={a.type} />
                      </div>

                      <div className="flex items-center text-[14px] font-light text-neutral-400">
                        {a.notes?.trim() ? a.notes : "—"}
                      </div>

                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          ref={(el) => {
                            btnRefs.current[a.id] = el;
                          }}
                          type="button"
                          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          onClick={() => {
                            if (openMenuId === a.id) closeMenu();
                            else openMenuFor(a.id);
                          }}
                          aria-label="Actions"
                        >
                          <MoreVertical size={16} strokeWidth={1.25} />
                        </button>
                        {renderMenu(a)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div
              className={cn(
                "rounded-xl border border-neutral-200 bg-white",
                CARD_SHADOW,
                "flex flex-col",
                "h-[calc(100dvh-220px)]"
              )}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
                <div className="text-[20px] font-light text-neutral-950">{formatMonthTitle(month)}</div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light hover:bg-neutral-50"
                    onClick={() => setMonth(startOfMonth(new Date()))}
                  >
                    Today
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-50"
                      onClick={() => setMonth(addMonths(month, -1))}
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={16} strokeWidth={1.25} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-50"
                      onClick={() => setMonth(addMonths(month, 1))}
                      aria-label="Next month"
                    >
                      <ChevronRight size={16} strokeWidth={1.25} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7 px-6 pt-4 pb-2">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((x) => (
                  <div key={x} className="text-center text-[12px] font-light tracking-widest text-neutral-400">
                    {x}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-hidden px-6 pb-6">
                <div
                  className="grid h-full grid-cols-7 gap-4"
                  style={{ gridTemplateRows: `repeat(${weeksInView}, minmax(0, 1fr))` }}
                >
                  {monthDays.map((day) => {
                    const inMonth = day.getMonth() === month.getMonth();
                    const today = isSameDay(day, new Date());
                    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                    const dayAppts = apptsByDay.get(key) ?? [];

                    return (
                      <div
                        key={key}
                        className={cn(
                          "relative rounded-xl border border-neutral-200 bg-white",
                          "h-full",
                          "overflow-hidden",
                          !inMonth && "opacity-40",
                          today && "ring-2 ring-neutral-900"
                        )}
                      >
                        <div className="absolute left-2 top-2 z-10 text-[12px] font-light text-neutral-900">{day.getDate()}</div>

                        <button
                          type="button"
                          disabled={!canWrite}
                          className={cn(
                            "absolute right-2 top-2 z-10 rounded-md px-2 py-1 text-[11px] font-light",
                            "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900",
                            !canWrite && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-neutral-400"
                          )}
                          onClick={() =>
                            openCreateModal({
                              starts_at_text: formatInputDE(
                                new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0)
                              ),
                            })
                          }
                          aria-label="Add appointment"
                          title={!canWrite ? "Business profile missing" : "Add appointment"}
                        >
                          +
                        </button>

                        <div className="absolute inset-0 pt-7 pb-2 px-2 overflow-y-auto">
                          {dayAppts.length === 0 ? (
                            <div className="pt-1 text-[12px] font-light text-neutral-300">—</div>
                          ) : (
                            <div className="space-y-1">
                              {dayAppts.map((a) => {
                                const d = new Date(a.starts_at);
                                const clientName = getClientName(a.client_id, a.client_name);

                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    className={cn(
                                      "w-full rounded-md",
                                      "bg-neutral-900 text-white",
                                      "px-2 py-1",
                                      "text-[11px] font-light",
                                      "hover:opacity-95 transition"
                                    )}
                                    onClick={() => openDetailsModal(a)}
                                    title={`${formatTime(d)} · ${clientName ?? "—"}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="tabular-nums opacity-90">{formatTime(d)}</span>
                                      <span className="truncate opacity-90">{slimLabel(clientName, 26)}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <AppointmentFormModal
          open={modalOpen}
          mode={mode}
          initial={modalInitial}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSaved={async (draft) => {
            if (!userId || !businessProfileId) return;

            const start = parseDEDateTime(draft.starts_at_text);
            if (!start) return;

            // default duration: 60min (ends_at is nullable, but nice to set)
            const end = addMinutes(start, 60);

            const resolvedName = getClientName(draft.client_id, null);

            // EDIT
            if (mode === "edit" && selected && selected.id !== "__prefill__") {
              const patch = {
                client_id: draft.client_id || null,
                starts_at: start.toISOString(),
                ends_at: end.toISOString(),
                type: draft.type || null,
                notes: draft.notes || null,
                updated_at: new Date().toISOString(),
              };

              // optimistic UI
              const prev = appointments;
              const optimistic = prev
                .map((a) =>
                  a.id === selected.id
                    ? {
                        ...a,
                        ...patch,
                        client_name: resolvedName,
                        business_profile_id: businessProfileId,
                        owner_id: userId,
                      }
                    : a
                )
                .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

              setAppointments(optimistic);

              try {
                const { error } = await supabase
                  .from("appointments")
                  .update(patch)
                  .eq("id", selected.id)
                  .eq("business_profile_id", businessProfileId);

                if (error) throw error;

                if (detailAppt?.id === selected.id) {
                  setDetailAppt(optimistic.find((x) => x.id === selected.id) ?? null);
                }
              } catch {
                setAppointments(prev);
              }

              return;
            }

            // CREATE
            const insertRow = {
              owner_id: userId,
              business_profile_id: businessProfileId,
              client_id: draft.client_id || null,
              starts_at: start.toISOString(),
              ends_at: end.toISOString(),
              type: draft.type || null,
              notes: draft.notes || null,
            };

            // optimistic temp row
            const tempId = `temp_${Date.now()}`;
            const prev = appointments;
            const optimistic: Appointment = {
              id: tempId,
              owner_id: userId,
              business_profile_id: businessProfileId,
              client_id: insertRow.client_id,
              starts_at: insertRow.starts_at,
              ends_at: insertRow.ends_at,
              type: insertRow.type,
              notes: insertRow.notes,
              created_at: null,
              updated_at: null,
              client_name: resolvedName,
            };

            const next = [...prev, optimistic].sort(
              (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
            );
            setAppointments(next);

            try {
              const { data, error } = await supabase.from("appointments").insert(insertRow).select("*").single();
              if (error) throw error;

              const real = data as any;

              const realRow: Appointment = {
                id: String(real.id),
                owner_id: String(real.owner_id),
                business_profile_id: String(real.business_profile_id),
                client_id: real.client_id ?? null,
                starts_at: String(real.starts_at),
                ends_at: real.ends_at ? String(real.ends_at) : null,
                type: real.type ?? null,
                notes: real.notes ?? null,
                created_at: real.created_at ?? null,
                updated_at: real.updated_at ?? null,
                client_name: resolvedName,
              };

              setAppointments((cur) =>
                cur
                  .map((x) => (x.id === tempId ? realRow : x))
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
              );
            } catch {
              // revert
              setAppointments(prev);
            }
          }}
        />
      </div>
    </div>
  );
}
