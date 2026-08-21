"use client";

import type { Client } from "@/lib/clients/types";
import {
  Mail,
  Phone,
  MapPin,
  Pencil,
  User,
  Shirt,
  MessageSquare,
  Palette,
  Wallet,
  StickyNote,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-6 ${CARD_SHADOW}`}>
      <div className="mb-4 flex items-center gap-3 text-lg font-light text-neutral-900">
        <span className="text-neutral-400">{icon ?? "▢"}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  const v =
    value === undefined || value === null || value === "" ? "—" : String(value);

  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <div className="text-xs font-light text-neutral-500">{label}</div>
      <div className="text-sm font-light text-neutral-900">{v}</div>
    </div>
  );
}

function Chips({
  items,
  variant = "outline",
}: {
  items: string[];
  variant?: "outline" | "solid";
}) {
  if (!items || items.length === 0) {
    return <div className="text-sm font-light text-neutral-400">—</div>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className={
            variant === "solid"
              ? "rounded-lg bg-neutral-950 px-3 py-1 text-xs font-light text-white"
              : "rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-light text-neutral-900"
          }
        >
          {x}
        </span>
      ))}
    </div>
  );
}

function joinParts(parts: Array<string | null | undefined>, sep = ", ") {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

export default function ClientDetailView({
  client,
  onEdit,
}: {
  client: Client;
  onEdit?: () => void;
}) {
  const router = useRouter();

  const body = (client.body_size ?? {}) as any;
  const style = (client.style ?? {}) as any;
  const pref = (client.preferences ?? {}) as any;
  const notes = (client.notes ?? {}) as any;

  const location =
    [client.city, client.country].filter(Boolean).join(", ") || "—";

  const created =
    client.created_at ? new Date(client.created_at).toLocaleDateString() : "—";

  // ✅ Billing address (header block)
  const billingLine1 = joinParts([client.billing_street, client.billing_house_number], " ");
  const billingLine2 = joinParts([client.billing_postal_code, client.billing_city], " ");
  const billingCountry = (client.billing_country ?? "").trim();

  const hasBilling =
    Boolean(billingLine1) || Boolean(billingLine2) || Boolean(billingCountry);

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/app/clients")}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-light text-neutral-500 transition hover:text-neutral-700"
      >
        <ArrowLeft size={16} />
        Back to clients
      </button>

      {/* Header */}
      <div className={`rounded-xl border border-neutral-200 bg-white px-8 py-7 ${CARD_SHADOW}`}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[44px] font-extralight leading-none tracking-tight text-neutral-950">
              {client.first_name} {client.last_name}
            </div>

            <div className="mt-3 inline-flex items-center rounded-full bg-neutral-950 px-3 py-1 text-xs font-light text-white">
              Active
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEdit?.()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-light text-neutral-900 transition hover:bg-neutral-50"
          >
            <Pencil size={16} />
            Edit Profile
          </button>
        </div>

        {/* Contact row */}
        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-neutral-200 pt-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <Mail size={16} className="mt-0.5 text-neutral-400" />
            <div>
              <div className="text-xs font-light text-neutral-500">Email</div>
              <div className="mt-1 text-sm font-light text-neutral-900">
                {client.email ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone size={16} className="mt-0.5 text-neutral-400" />
            <div>
              <div className="text-xs font-light text-neutral-500">Phone</div>
              <div className="mt-1 text-sm font-light text-neutral-900">
                {client.phone ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin size={16} className="mt-0.5 text-neutral-400" />
            <div>
              <div className="text-xs font-light text-neutral-500">Location</div>
              <div className="mt-1 text-sm font-light text-neutral-900">
                {location}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Billing row (NEW) */}
        <div className="mt-6 border-t border-neutral-200 pt-6">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="mt-0.5 text-neutral-400" />
            <div className="w-full">
              <div className="text-xs font-light text-neutral-500">Billing Address</div>

              {!hasBilling ? (
                <div className="mt-1 text-sm font-light text-neutral-400">—</div>
              ) : (
                <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="text-sm font-light text-neutral-900">
                    {billingLine1 || "—"}
                  </div>
                  <div className="text-sm font-light text-neutral-900">
                    {billingLine2 || "—"}
                  </div>
                  <div className="text-sm font-light text-neutral-900">
                    {billingCountry || "—"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Personal Info" icon={<User size={18} />}>
          <div className="divide-y divide-neutral-200/60">
            <Row label="Gender" value={client.gender} />
            <Row label="Age Group" value={client.age_group} />
            <Row label="Profession" value={pref.profession} />
            <Row label="Client Since" value={created} />
          </div>
        </Card>

        <Card title="Size Profile" icon={<Shirt size={18} />}>
          <div className="divide-y divide-neutral-200/60">
            <Row
              label="Height"
              value={body.height_cm ? `${body.height_cm} cm` : ""}
            />
            <Row
              label="Tops"
              value={
                (body.size_tops ?? []).length
                  ? (body.size_tops ?? []).join(", ")
                  : ""
              }
            />
            <Row
              label="Bottoms"
              value={
                (body.size_bottoms ?? []).length
                  ? (body.size_bottoms ?? []).join(", ")
                  : ""
              }
            />
            <Row label="Shoes" value={body.shoe_size} />
            <Row label="Fit Preference" value={body.fit_preference} />
          </div>
        </Card>

        <Card title="Communication" icon={<MessageSquare size={18} />}>
          <div className="divide-y divide-neutral-200/60">
            <Row label="Preferred Method" value={pref.preferred_contact_method} />
            <Row label="Response Time" value={pref.response_time} />
            <Row label="Notes" value={pref.communication_notes} />
          </div>
        </Card>
      </div>

      {/* Style Profile */}
      <Card title="Style Profile" icon={<Palette size={18} />}>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Style Types
            </div>
            <Chips items={style.style_types ?? []} variant="solid" />

            <div className="mt-6 text-xs font-light uppercase tracking-wide text-neutral-400">
              Avoided Colors
            </div>
            <Chips items={style.avoided_colors ?? []} variant="outline" />

            <div className="mt-6">
              <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
                Patterns
              </div>
              <div className="mt-2 text-sm font-light text-neutral-900">
                {style.pattern_preference ?? "—"}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Preferred Colors
            </div>
            <Chips items={style.preferred_colors ?? []} variant="outline" />

            <div className="mt-6 text-xs font-light uppercase tracking-wide text-neutral-400">
              Typical Occasions
            </div>
            <Chips items={style.typical_occasions ?? []} variant="outline" />

            <div className="mt-6">
              <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
                Logos
              </div>
              <div className="mt-2 text-sm font-light text-neutral-900">
                {style.logo_preference ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Budget & Shopping */}
      <Card title="Budget & Shopping" icon={<Wallet size={18} />}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Budget Level
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {pref.budget_level ?? "—"}
            </div>

            <div className="mt-6 text-xs font-light uppercase tracking-wide text-neutral-400">
              Preferred Stores
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {pref.preferred_stores ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Price Sensitivity
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {pref.price_sensitivity ?? "—"}
            </div>

            <div className="mt-6 text-xs font-light uppercase tracking-wide text-neutral-400">
              Shopping Method
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {pref.shopping_method ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Favorite Brands
            </div>
            <Chips items={pref.favorite_brands ?? []} variant="solid" />

            <div className="mt-6 text-xs font-light uppercase tracking-wide text-neutral-400">
              Disliked Brands
            </div>
            <Chips items={pref.disliked_brands ?? []} variant="outline" />
          </div>
        </div>
      </Card>

      {/* Internal Notes */}
      <Card title="Internal Notes" icon={<StickyNote size={18} />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Personality Notes
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {notes.personality_notes ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Special Instructions
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {notes.special_instructions ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Buying Behavior
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {notes.buying_behavior ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs font-light uppercase tracking-wide text-neutral-400">
              Red Flags
            </div>
            <div className="mt-2 text-sm font-light text-neutral-900">
              {notes.red_flags ?? "—"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}