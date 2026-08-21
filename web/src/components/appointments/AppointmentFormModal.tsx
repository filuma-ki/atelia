// src/components/appointments/AppointmentFormModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, X, Calendar as CalIcon, Clock as ClockIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "create" | "edit";

type ClientOption = {
  id: string;
  label: string;
};

export type AppointmentDraft = {
  client_id: string;
  starts_at_text: string; // "DD.MM.YYYY, HH:MM"
  type: string;
  notes: string | null;
};

const TYPE_OPTIONS = [
  "Consultation",
  "Wardrobe Review",
  "Personal Shopping",
  "Fitting",
  "Style Session",
  "Event Prep",
  "Follow-up",
  "Other",
];

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseDEDateTime(text: string): Date | null {
  const s = (text ?? "").trim();
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

function toDateValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeValue(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeValue(dateStr: string, timeStr: string) {
  const [y, m, da] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, da ?? 1, hh ?? 0, mm ?? 0, 0, 0);
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

export default function AppointmentFormModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial?: Partial<AppointmentDraft> | null;
  onClose: () => void;
  onSaved: (draft: AppointmentDraft) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [clientId, setClientId] = useState("");
  const [startsAtText, setStartsAtText] = useState("");
  const [apptType, setApptType] = useState("");
  const [notes, setNotes] = useState("");

  // --- Date/Time picker popover state
  const [dtOpen, setDtOpen] = useState(false);
  const [dtPos, setDtPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const dtAnchorRef = useRef<HTMLDivElement | null>(null);
  const dtPopoverRef = useRef<HTMLDivElement | null>(null);

  const parsed = useMemo(() => parseDEDateTime(startsAtText), [startsAtText]);
  const [dateValue, setDateValue] = useState(() => toDateValue(new Date()));
  const [timeValue, setTimeValue] = useState(() => toTimeValue(new Date()));

  useEffect(() => setMounted(true), []);

  // reset when opened / mode changes
  useEffect(() => {
    if (!open) return;

    setClientId(initial?.client_id ?? "");
    setStartsAtText(initial?.starts_at_text ?? "");
    setApptType(initial?.type ?? "");
    setNotes(initial?.notes ?? "");

    // init picker controls from current value (or now)
    const base = parseDEDateTime(initial?.starts_at_text ?? "") ?? new Date();
    setDateValue(toDateValue(base));
    setTimeValue(toTimeValue(base));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  function openPicker() {
    const el = dtAnchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const base = parsed ?? new Date();
    setDateValue(toDateValue(base));
    setTimeValue(toTimeValue(base));

    setDtPos({ top: r.bottom + 8, left: r.left, width: r.width });
    setDtOpen(true);
  }

  function closePicker() {
    setDtOpen(false);
    setDtPos(null);
  }

  // ESC to close modal (and picker)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePicker();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // close picker on outside click + keep position on scroll/resize
  useEffect(() => {
    if (!dtOpen) return;

    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (dtAnchorRef.current && dtAnchorRef.current.contains(t)) return;
      if (dtPopoverRef.current && dtPopoverRef.current.contains(t)) return;
      closePicker();
    }

    function reposition() {
      const el = dtAnchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDtPos({ top: r.bottom + 8, left: r.left, width: r.width });
    }

    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [dtOpen]);

  // load clients when opened
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadClients() {
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

        const pickLabel = (c: any): string => {
          const candidates = [c.name, c.full_name, c.client_name, c.display_name, c.company, c.title].filter(
            (x) => typeof x === "string" && x.trim().length > 0
          ) as string[];

          if (candidates.length > 0) return candidates[0];

          const first = typeof c.first_name === "string" ? c.first_name.trim() : "";
          const last = typeof c.last_name === "string" ? c.last_name.trim() : "";
          const combo = `${first} ${last}`.trim();
          if (combo) return combo;

          if (typeof c.email === "string" && c.email.trim()) return c.email.trim();

          return "Unnamed client";
        };

        const mapped: ClientOption[] = (data ?? []).map((c: any) => ({
          id: c.id,
          label: pickLabel(c),
        }));

        if (!cancelled) setClients(mapped);
      } catch (e) {
        console.error("Load clients failed:", e);
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    }

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.label })), [clients]);
  const typeOptions = useMemo(() => TYPE_OPTIONS.map((t) => ({ value: t, label: t })), []);

  const canSubmit = Boolean(clientId && startsAtText.trim() && apptType);

  async function submit() {
    if (!canSubmit) return;

    const draft: AppointmentDraft = {
      client_id: clientId,
      starts_at_text: startsAtText.trim(),
      type: apptType,
      notes: notes.trim() ? notes.trim() : null,
    };

    await onSaved(draft);
    onClose();
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99998] flex items-center justify-center" aria-modal="true" role="dialog">
      {/* overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        onClick={() => {
          closePicker();
          onClose();
        }}
        aria-label="Close"
      />

      {/* modal */}
      <div
        className={[
          "relative z-[99999] w-[520px] max-w-[calc(100vw-32px)]",
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="text-[22px] font-light text-neutral-950">{mode === "edit" ? "Edit Appointment" : "New Appointment"}</div>

          <button
            type="button"
            onClick={() => {
              closePicker();
              onClose();
            }}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.25} />
          </button>
        </div>

        {/* body */}
        <div className="px-6 pb-6 pt-5">
          <div className="space-y-4">
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

            {/* Date & Time + Picker */}
            <div className="space-y-2">
              <FieldLabel>
                Date &amp; Time <span className="text-neutral-500">*</span>
              </FieldLabel>

              <div ref={dtAnchorRef} className="relative">
                <TextInput
                  placeholder="DD.MM.YYYY, HH:MM"
                  value={startsAtText}
                  onChange={(e) => setStartsAtText(e.target.value)}
                  onFocus={() => {
                    // open on focus (like you wanted)
                    openPicker();
                  }}
                />

                <button
                  type="button"
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2",
                    "rounded-lg p-2",
                    "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  )}
                  onClick={() => {
                    if (dtOpen) closePicker();
                    else openPicker();
                  }}
                  aria-label="Open date time picker"
                  title="Pick date & time"
                >
                  <CalIcon size={16} strokeWidth={1.25} />
                </button>
              </div>

              {dtOpen && dtPos
                ? createPortal(
                    <div
                      ref={(el) => {
                        dtPopoverRef.current = el;
                      }}
                      className={cn(
                        "fixed z-[999999] overflow-hidden",
                        "rounded-xl border border-neutral-200 bg-white",
                        "shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
                      )}
                      style={{ top: dtPos.top, left: dtPos.left, width: Math.min(520, Math.max(320, dtPos.width)) }}
                    >
                      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                        <div className="text-[13px] font-light text-neutral-900">Pick date & time</div>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[12px] font-light text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                          onClick={closePicker}
                        >
                          Close
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <div className="text-[12px] font-light tracking-wide text-neutral-400 flex items-center gap-2">
                              <CalIcon size={14} strokeWidth={1.25} />
                              Date
                            </div>
                            <input
                              type="date"
                              value={dateValue}
                              onChange={(e) => setDateValue(e.target.value)}
                              className={cn(
                                "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3",
                                "text-[13px] font-light text-neutral-900 outline-none",
                                "focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                              )}
                            />
                          </label>

                          <label className="space-y-1">
                            <div className="text-[12px] font-light tracking-wide text-neutral-400 flex items-center gap-2">
                              <ClockIcon size={14} strokeWidth={1.25} />
                              Time
                            </div>
                            <input
                              type="time"
                              value={timeValue}
                              step={300}
                              onChange={(e) => setTimeValue(e.target.value)}
                              className={cn(
                                "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3",
                                "text-[13px] font-light text-neutral-900 outline-none",
                                "focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                              )}
                            />
                          </label>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg border border-neutral-200 bg-white px-3 py-2",
                              "text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
                            )}
                            onClick={() => {
                              const now = new Date();
                              setDateValue(toDateValue(now));
                              setTimeValue(toTimeValue(now));
                            }}
                          >
                            Now
                          </button>

                          <button
                            type="button"
                            className={cn(
                              "rounded-lg bg-neutral-900 px-4 py-2",
                              "text-[13px] font-light text-white hover:bg-neutral-800"
                            )}
                            onClick={() => {
                              const d = fromDateTimeValue(dateValue, timeValue);
                              setStartsAtText(formatInputDE(d));
                              closePicker();
                            }}
                          >
                            Apply
                          </button>
                        </div>

                        <div className="text-[12px] font-light text-neutral-400">
                          You can still type manually (format: <span className="font-normal">DD.MM.YYYY, HH:MM</span>).
                        </div>
                      </div>
                    </div>,
                    document.body
                  )
                : null}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <FieldLabel>
                Type <span className="text-neutral-500">*</span>
              </FieldLabel>
              <SelectField value={apptType} onValueChange={setApptType} placeholder="Select type" options={typeOptions} />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <FieldLabel>Notes</FieldLabel>
              <TextArea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* footer */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                closePicker();
                onClose();
              }}
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