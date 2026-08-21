"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ClientDetailView from "@/components/clients/ClientDetailView";
import ClientFormModal from "@/components/clients/ClientFormModal";
import { getClientById } from "@/lib/clients/api";
import type { Client } from "@/lib/clients/types";

export default function Page() {
  const params = useParams<{ id: string }>();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getClientById(params.id);
      setClient(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] px-10 pt-10">
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm font-light text-neutral-500 shadow-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-[60vh] px-10 pt-10">
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm font-light text-neutral-500 shadow-sm">
          Client not found
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 pt-10 pb-12">
      <ClientDetailView client={client} onEdit={() => setEditOpen(true)} />

      <ClientFormModal
        open={editOpen}
        mode="edit"
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setEditOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}