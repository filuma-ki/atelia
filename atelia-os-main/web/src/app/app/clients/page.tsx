"use client";

import { useEffect, useMemo, useState } from "react";
import ClientCard from "@/components/clients/ClientCard";
import ClientFormModal from "@/components/clients/ClientFormModal";
import DeleteClientModal from "@/components/clients/DeleteClientModal";
import type { Client } from "@/lib/clients/types";
import { deleteClient, listClients } from "@/lib/clients/api";
import { Plus, Search } from "lucide-react";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Client | null>(null);

  // 3-dots dropdown state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listClients();
      setClients(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Close menus on outside click / ESC
  useEffect(() => {
    function onDown() {
      setOpenMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuId(null);
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [clients, q]);

  function requestDelete(client: Client) {
    setOpenMenuId(null);
    setDeleteTarget(client);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Weiter nach außen, aber clean */}
      <div className="w-full px-10 pt-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {/* Ultra thin / clean */}
            <div className="text-[40px] font-extralight leading-none tracking-tight text-neutral-950">
              Clients
            </div>
            <div className="mt-2 text-sm font-light text-neutral-500">
              {clients.length} total clients
            </div>
          </div>

          {/* Button: dünner, weniger Radius, weniger "chunky" */}
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
            Add Client
          </button>
        </div>

        {/* Search (dünner / filigraner) */}
        <div className="mt-8">
          <div
            className={[
              "flex w-[440px] items-center gap-3 rounded-lg",
              "border border-neutral-200 bg-white px-3 py-2",
              "transition",
              "focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-200",
              "shadow-none",
            ].join(" ")}
          >
            <Search size={16} className="text-neutral-400" />
            <input
              className="w-full bg-transparent text-[13px] font-light text-neutral-900 placeholder:font-light placeholder:text-neutral-400 outline-none"
              placeholder="Search clients..."
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
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-[13px] font-light text-neutral-500 shadow-none">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center shadow-none">
              <div className="text-[13px] font-medium text-neutral-900">
                No clients found
              </div>
              <div className="mt-2 text-[13px] font-light text-neutral-500">
                Try another search or add a new client.
              </div>
              <button
                onClick={() => {
                  setMode("create");
                  setSelected(null);
                  setModalOpen(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 transition hover:bg-neutral-50"
              >
                <Plus size={14} />
                Add Client
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  menuOpen={openMenuId === c.id}
                  onToggleMenu={() =>
                    setOpenMenuId((prev) => (prev === c.id ? null : c.id))
                  }
                  onCloseMenu={() => setOpenMenuId(null)}
                  onEdit={() => {
                    setOpenMenuId(null);
                    setMode("edit");
                    setSelected(c);
                    setModalOpen(true);
                  }}
                  onDelete={() => requestDelete(c)}
                />
              ))}
            </div>
          )}
        </div>

        <ClientFormModal
          open={modalOpen}
          mode={mode}
          client={selected}
          onClose={() => setModalOpen(false)}
          onSaved={() => refresh()}
        />

        <DeleteClientModal
          open={deleteOpen}
          clientName={
            deleteTarget
              ? `${deleteTarget.first_name} ${deleteTarget.last_name}`
              : ""
          }
          loading={deleting}
          onClose={() => {
            if (deleting) return;
            setDeleteOpen(false);
            setDeleteTarget(null);
          }}
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}