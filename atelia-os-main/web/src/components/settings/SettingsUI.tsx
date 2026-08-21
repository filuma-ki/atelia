// src/components/settings/SettingsUI.tsx
"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "./settingsTypes";

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div className="text-[12px] font-light text-neutral-500">{label}</div>
      <input
        type={type}
        className={cn(
          "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2",
          "text-[13px] font-light text-neutral-900 outline-none",
          "focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="text-[12px] font-light text-neutral-500">{label}</div>
      <div className="relative mt-2">
        <select
          className={cn(
            "w-full appearance-none rounded-lg border border-neutral-200 bg-white px-3 py-2 pr-10",
            "text-[13px] font-light text-neutral-900 outline-none",
            "focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div>
        <div className="text-[13px] font-light text-neutral-900">{label}</div>
        {help ? <div className="mt-1 text-[12px] font-light text-neutral-500">{help}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "h-6 w-11 rounded-full border transition",
          checked ? "bg-neutral-950 border-neutral-950" : "bg-neutral-200 border-neutral-200"
        )}
        aria-label={label}
      >
        <div className={cn("h-5 w-5 rounded-full bg-white transition", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="text-[16px] font-medium text-neutral-900">{title}</div>
      {subtitle ? <div className="mt-1 text-[13px] font-light text-neutral-500">{subtitle}</div> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  disableClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  disableClose?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 p-6"
      onMouseDown={() => {
        if (disableClose) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[16px] font-medium text-neutral-900">{title}</div>
            {subtitle ? <div className="mt-1 text-[13px] font-light text-neutral-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (disableClose) return;
              onClose();
            }}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({
  toast,
}: {
  toast: { kind: "ok" | "err"; msg: string } | null;
}) {
  if (!toast) return null;

  return (
    <div className="fixed right-6 top-6 z-[99999]">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
          toast.kind === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900"
        )}
      >
        {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        <div className="text-[13px] font-light">{toast.msg}</div>
      </div>
    </div>
  );
}