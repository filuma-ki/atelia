"use client";

import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import type { Project } from "@/app/app/projects/page";

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export default function ProjectCard({
  project,
  menuOpen = false,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: {
  project: Project;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
  onCloseMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();

  function viewDetails() {
    onCloseMenu?.();
    router.push(`/app/projects/${project.id}`);
  }

  const status = project.status ?? "—";
  const meta = [
    project.client_name ? `Client: ${project.client_name}` : null,
    project.budget ? `Budget: ${project.budget}` : null,
    project.due_date ? `Due: ${new Date(project.due_date).toLocaleDateString()}` : null,
  ].filter(Boolean);

  return (
    <div
      className={[
        "relative cursor-pointer rounded-lg border border-neutral-200 bg-white p-6",
        CARD_SHADOW,
        "transition hover:shadow-[0_3px_10px_rgba(0,0,0,0.06)]",
      ].join(" ")}
      onClick={viewDetails}
    >
      {/* 3 dots */}
      <button
        type="button"
        className="absolute right-3 top-3 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu?.();
        }}
        aria-label="Project actions"
      >
        <MoreVertical size={16} strokeWidth={1.25} />
      </button>

      {/* Dropdown */}
      {menuOpen ? (
        <div
          data-atelia-menu="true"
          className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
            onClick={(e) => {
              e.stopPropagation();
              viewDetails();
            }}
          >
            <Eye size={16} strokeWidth={1.25} className="text-neutral-400" />
            View Details
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
            onClick={(e) => {
              e.stopPropagation();
              onCloseMenu?.();
              onEdit?.();
            }}
          >
            <Pencil size={16} strokeWidth={1.25} className="text-neutral-400" />
            Edit
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-light text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onCloseMenu?.();
              onDelete?.();
            }}
          >
            <Trash2 size={16} strokeWidth={1.25} />
            Delete
          </button>
        </div>
      ) : null}

      {/* Content */}
      <div className="text-[15px] font-light text-neutral-950">{project.name}</div>

      <div className="mt-2 text-[12px] font-light text-neutral-500">{status}</div>

      <div className="mt-4 space-y-1">
        {meta.length ? (
          meta.map((x) => (
            <div key={String(x)} className="text-[13px] font-light text-neutral-700">
              {x}
            </div>
          ))
        ) : (
          <div className="text-[13px] font-light text-neutral-400">—</div>
        )}
      </div>
    </div>
  );
}