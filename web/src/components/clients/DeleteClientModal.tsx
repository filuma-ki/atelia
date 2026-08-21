"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const MODAL_SHADOW = "shadow-[0_18px_40px_rgba(0,0,0,0.14)]";

export default function DeleteClientModal({
  open,
  clientName,
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  clientName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open || loading) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/55"
        onMouseDown={() => {
          if (!loading) onClose();
        }}
      />

      {/* modal */}
      <div
        className={[
          "relative w-[92vw] max-w-xl rounded-xl border border-neutral-200 bg-white",
          "px-8 py-7 ring-1 ring-black/10",
          MODAL_SHADOW,
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-lg font-light text-neutral-950">
              Delete Client
            </div>
            <div className="mt-2 max-w-[52ch] text-sm font-light leading-relaxed text-neutral-500">
              Are you sure you want to delete{" "}
              <span className="text-neutral-900">“{clientName}”</span>?  
              This will also affect related projects, appointments, and invoices.
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
            onClick={onClose}
            aria-label="Close"
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        {/* footer */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="h-9 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-light text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className={[
              "h-9 rounded-lg px-5 text-sm font-light text-white",
              "bg-red-600 hover:bg-red-700 disabled:opacity-60",
              "shadow-[0_1px_2px_rgba(0,0,0,0.10)]",
            ].join(" ")}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}