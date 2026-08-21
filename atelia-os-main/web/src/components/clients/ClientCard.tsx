"use client";

import { useRouter } from "next/navigation";
import type { Client } from "@/lib/clients/types";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Mail,
  Phone,
} from "lucide-react";

export default function ClientCard({
  client,
  menuOpen = false,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: {
  client: Client;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
  onCloseMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();

  function viewDetails() {
    onCloseMenu?.();
    router.push(`/app/clients/${client.id}`);
  }

  return (
    <div
      onClick={viewDetails}
      className={[
        "relative cursor-pointer rounded-xl border border-neutral-200 bg-white",
        "px-5 py-4",
        "transition-all duration-200 ease-out",
        "hover:border-neutral-250",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.035)]",
].join(" ")}
    >
      {/* 3 dots */}
      <button
        type="button"
        aria-label="Client actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu?.();
        }}
        className={[
          "absolute right-3 top-3",
          "rounded-lg p-1.5",
          "text-neutral-400",
          "hover:bg-neutral-100 hover:text-neutral-700",
        ].join(" ")}
      >
        <MoreHorizontal size={16} />
      </button>

      {/* Dropdown */}
      {menuOpen ? (
        <div
          data-atelia-menu
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={[
            "absolute right-3 top-10 z-20 w-40",
            "rounded-lg border border-neutral-200 bg-white",
            "shadow-sm",
          ].join(" ")}
        >
          <Action
            icon={<Eye size={14} />}
            label="View details"
            onClick={viewDetails}
          />
          <Action
            icon={<Pencil size={14} />}
            label="Edit"
            onClick={() => {
              onCloseMenu?.();
              onEdit?.();
            }}
          />
          <Action
            danger
            icon={<Trash2 size={14} />}
            label="Delete"
            onClick={() => {
              onCloseMenu?.();
              onDelete?.();
            }}
          />
        </div>
      ) : null}

      {/* Content */}
      <div className="pr-8">
        {/* Name – ultra clean */}
        <div className="text-[15px] font-light text-neutral-950">
          {client.first_name} {client.last_name}
        </div>

        {/* Meta */}
        <div className="mt-2 space-y-1">
          <Meta
            icon={<Mail size={13} />}
            value={client.email ?? "—"}
          />
          <Meta
            icon={<Phone size={13} />}
            value={client.phone ?? "—"}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub components ---------- */

function Action({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 px-3 py-2",
        "text-[13px] font-light",
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-neutral-700 hover:bg-neutral-50",
      ].join(" ")}
    >
      <span className="text-neutral-400">{icon}</span>
      {label}
    </button>
  );
}

function Meta({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-light text-neutral-500">
      <span className="text-neutral-400">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}