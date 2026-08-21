"use client";

import React from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Card ---------- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm",
        "transition hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-zinc-100 px-6 py-5">
      <div>
        <div className="text-lg font-semibold text-zinc-950">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-zinc-500">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx("px-6 py-5", className)}>{children}</div>;
}

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-50 disabled:opacity-60 disabled:pointer-events-none";

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-3 text-sm",
  };

  const variants = {
    primary:
      "bg-zinc-950 text-white shadow-sm hover:bg-zinc-900 hover:shadow-md focus:ring-zinc-900",
    secondary:
      "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 hover:shadow-md focus:ring-zinc-200",
    ghost:
      "bg-transparent text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-200",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md focus:ring-red-300",
  };

  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

/* ---------- Input ---------- */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900",
        "placeholder:text-zinc-400 shadow-sm transition",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300",
        className
      )}
      {...props}
    />
  );
}

/* ---------- Textarea ---------- */
export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900",
        "placeholder:text-zinc-400 shadow-sm transition",
        "focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300",
        className
      )}
      {...props}
    />
  );
}

/* ---------- Select ---------- */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
}) {
  return (
    <select
      className={cx(
        "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900",
        "shadow-sm transition focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ---------- Badge / Chip ---------- */
export function Badge({
  children,
  tone = "solid",
}: {
  children: React.ReactNode;
  tone?: "solid" | "outline";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tone === "solid"
          ? "bg-zinc-950 text-white"
          : "border border-zinc-200 bg-white text-zinc-800"
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Modal shell ---------- */
export function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "w-[980px] max-w-[92vw]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={cx(
          "relative z-10 overflow-hidden rounded-3xl bg-white shadow-2xl",
          widthClass
        )}
      >
        <div className="flex items-center justify-between px-8 py-6">
          <div className="text-2xl font-semibold text-zinc-950">{title}</div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <div className="px-8 pb-8">{children}</div>

        {footer ? <div className="border-t px-8 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}