"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client, ClientFormValues } from "@/lib/clients/types";
import { emptyClientFormValues } from "@/lib/clients/types";
import { createClient, updateClient } from "@/lib/clients/api";
import { X, AlertTriangle, Check, ChevronDown } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";

type Mode = "create" | "edit";
type Tab = "basic" | "style" | "preferences" | "notes";

function toggleInArray(arr: string[] = [], value: string) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/** ====== OPTIONS ====== */
const GENDER_OPTIONS = [
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const AGE_GROUP_OPTIONS = [
  { value: "18-25", label: "18-25" },
  { value: "26-35", label: "26-35" },
  { value: "36-45", label: "36-45" },
  { value: "46-55", label: "46-55" },
  { value: "56+", label: "56+" },
];

const FIT_OPTIONS = [
  { value: "Regular", label: "Regular" },
  { value: "Loose", label: "Loose" },
  { value: "Slim", label: "Slim" },
  { value: "Oversized", label: "Oversized" },
];

const PATTERN_OPTIONS = [
  { value: "No pattern", label: "No pattern" },
  { value: "Subtle pattern", label: "Subtle pattern" },
  { value: "Pattern", label: "Pattern" },
];

const LOGO_OPTIONS = [
  { value: "No logos", label: "No logos" },
  { value: "Subtle logos", label: "Subtle logos" },
  { value: "Logos", label: "Logos" },
];

const CLIMATE_OPTIONS = [
  { value: "Mostly cold", label: "Mostly cold" },
  { value: "Mixed", label: "Mixed" },
  { value: "Mostly warm", label: "Mostly warm" },
];

const TRAVEL_FREQ_OPTIONS = [
  { value: "Rarely", label: "Rarely" },
  { value: "Occasionally", label: "Occasionally" },
  { value: "Frequently", label: "Frequently" },
];

const BUDGET_OPTIONS = [
  { value: "Value", label: "Value" },
  { value: "Mid", label: "Mid" },
  { value: "Premium", label: "Premium" },
  { value: "High luxury", label: "High luxury" },
];

const PRICE_SENS_OPTIONS = [
  { value: "Very sensitive", label: "Very sensitive" },
  { value: "Balanced", label: "Balanced" },
  { value: "Not sensitive", label: "Not sensitive" },
];

const SHOP_METHOD_OPTIONS = [
  { value: "Online", label: "Online" },
  { value: "In-store", label: "In-store" },
  { value: "Mixed", label: "Mixed" },
];

const CONTACT_OPTIONS = [
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Phone", label: "Phone" },
  { value: "Email", label: "Email" },
];

const RESPONSE_TIME_OPTIONS = [
  { value: "ASAP", label: "ASAP" },
  { value: "Same day", label: "Same day" },
  { value: "Flexible", label: "Flexible" },
];

/** ====== UI (thin / neutral) ====== */

const SOFT_SHADOW = "shadow-[0_10px_30px_rgba(0,0,0,0.10)]";

function SegmentedTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: Array<{ key: Tab; label: string }> = [
    { key: "basic", label: "Basic" },
    { key: "style", label: "Style" },
    { key: "preferences", label: "Preferences" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="rounded-lg bg-neutral-100 p-1">
      <div className="grid grid-cols-4 gap-1">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setTab(it.key)}
              className={[
                "h-8 rounded-md px-3 text-[12px] transition",
                "font-light",
                active
                  ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200"
                  : "text-neutral-500 hover:text-neutral-800",
              ].join(" ")}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-light text-neutral-600">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3",
        "h-9 text-sm font-light text-neutral-900 placeholder:text-neutral-400",
        "outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2",
        "text-sm font-light text-neutral-900 placeholder:text-neutral-400",
        "outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

/** Radix Select — thin */
function SelectField({
  value,
  onValueChange,
  placeholder = "Select",
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={[
          "mt-2 flex h-9 w-full items-center justify-between rounded-lg",
          "border border-neutral-200 bg-white px-3 text-sm font-light text-neutral-900",
          "outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200",
        ].join(" ")}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="text-neutral-400">
          <ChevronDown size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={[
            "z-[9999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
            "border border-neutral-200 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
          ].join(" ")}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={[
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm",
                  "font-light text-neutral-900 outline-none",
                  "data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900",
                ].join(" ")}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center text-neutral-900">
                  <Check size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "h-8 rounded-lg border px-3 text-[12px] transition",
        "font-light",
        selected
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SectionTitle({ title, topDivider = false }: { title: string; topDivider?: boolean }) {
  return (
    <div className={topDivider ? "pt-6" : ""}>
      {topDivider ? <div className="mb-6 h-px w-full bg-neutral-200" /> : null}
      <div className="text-base font-light text-neutral-950">{title}</div>
    </div>
  );
}

export default function ClientFormModal({
  open,
  mode,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  client?: Client | null;
  onClose: () => void;
  onSaved: (saved: Client) => void;
}) {
  const initial = useMemo<ClientFormValues>(() => {
    if (mode === "edit" && client) {
      return {
        first_name: client.first_name ?? "",
        last_name: client.last_name ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        gender: client.gender ?? "",
        age_group: client.age_group ?? "",
        city: client.city ?? "",
        country: client.country ?? "",
        // ✅ Billing address (new)
        billing_street: (client as any).billing_street ?? "",
        billing_house_number: (client as any).billing_house_number ?? "",
        billing_postal_code: (client as any).billing_postal_code ?? "",
        billing_city: (client as any).billing_city ?? "",
        billing_country: (client as any).billing_country ?? "",
        body_size: client.body_size ?? {},
        style: client.style ?? {},
        preferences: client.preferences ?? {},
        notes: client.notes ?? {},
      } as any;
    }
    // ✅ default empty values incl. billing fields
    return {
      ...emptyClientFormValues(),
      billing_street: "",
      billing_house_number: "",
      billing_postal_code: "",
      billing_city: "",
      billing_country: "",
    } as any;
  }, [mode, client]);

  const [tab, setTab] = useState<Tab>("basic");
  const [values, setValues] = useState<ClientFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTab("basic");
    setValues(initial);
    setError("");
  }, [open, initial]);

  if (!open) return null;

  async function handleSave() {
    setError("");
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createClient(values as any)
          : await updateClient(client!.id, values as any);

      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />

      {/* modal */}
      <div
        className={[
          "relative z-10 w-[980px] max-w-[92vw] rounded-xl bg-white ring-1 ring-black/10",
          SOFT_SHADOW,
        ].join(" ")}
      >
        {/* header */}
        <div className="flex items-start justify-between px-10 pt-8">
          <div>
            <div className="text-xl font-light text-neutral-950">
              {mode === "create" ? "New Client Profile" : "Edit Client Profile"}
            </div>
            <div className="mt-1 text-xs font-light text-neutral-500">Keep it minimal — you can fill the rest later.</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* tabs */}
        <div className="px-10 pt-5">
          <SegmentedTabs tab={tab} setTab={setTab} />

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-light text-red-700">
              <AlertTriangle size={16} className="mt-0.5" />
              <div>{error}</div>
            </div>
          ) : null}
        </div>

        {/* body */}
        <div className="px-10 pb-8 pt-6">
          <div className="max-h-[62vh] overflow-auto pr-2">
            {tab === "basic" ? (
              <div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                  <div>
                    <Label>First Name *</Label>
                    <Input value={values.first_name} onChange={(e) => setValues({ ...values, first_name: e.target.value })} />
                  </div>

                  <div>
                    <Label>Last Name *</Label>
                    <Input value={values.last_name} onChange={(e) => setValues({ ...values, last_name: e.target.value })} />
                  </div>

                  <div>
                    <Label>Email</Label>
                    <Input value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
                  </div>

                  <div>
                    <Label>Phone</Label>
                    <Input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
                  </div>

                  <div>
                    <Label>Gender</Label>
                    <SelectField value={values.gender} onValueChange={(v) => setValues({ ...values, gender: v })} options={GENDER_OPTIONS} />
                  </div>

                  <div>
                    <Label>Age Group</Label>
                    <SelectField
                      value={values.age_group}
                      onValueChange={(v) => setValues({ ...values, age_group: v })}
                      options={AGE_GROUP_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Location / City</Label>
                    <Input value={values.city} onChange={(e) => setValues({ ...values, city: e.target.value })} />
                  </div>

                  <div>
                    <Label>Country</Label>
                    <Input value={values.country} onChange={(e) => setValues({ ...values, country: e.target.value })} />
                  </div>
                </div>

                {/* ✅ NEW: Billing Address */}
                <SectionTitle title="Billing Address" topDivider />

                <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-5">
                  <div>
                    <Label>Street</Label>
                    <Input
                      placeholder="e.g. Georgstraße"
                      value={(values as any).billing_street ?? ""}
                      onChange={(e) => setValues({ ...(values as any), billing_street: e.target.value } as any)}
                    />
                  </div>

                  <div>
                    <Label>House No.</Label>
                    <Input
                      placeholder="e.g. 5"
                      value={(values as any).billing_house_number ?? ""}
                      onChange={(e) => setValues({ ...(values as any), billing_house_number: e.target.value } as any)}
                    />
                  </div>

                  <div>
                    <Label>Postal Code</Label>
                    <Input
                      placeholder="e.g. 94034"
                      value={(values as any).billing_postal_code ?? ""}
                      onChange={(e) => setValues({ ...(values as any), billing_postal_code: e.target.value } as any)}
                    />
                  </div>

                  <div>
                    <Label>City</Label>
                    <Input
                      placeholder="e.g. Passau"
                      value={(values as any).billing_city ?? ""}
                      onChange={(e) => setValues({ ...(values as any), billing_city: e.target.value } as any)}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="e.g. Germany"
                      value={(values as any).billing_country ?? ""}
                      onChange={(e) => setValues({ ...(values as any), billing_country: e.target.value } as any)}
                    />
                  </div>
                </div>

                <SectionTitle title="Body & Size Information" topDivider />

                <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-5">
                  <div>
                    <Label>Height (cm)</Label>
                    <Input
                      placeholder="e.g. 175"
                      value={values.body_size.height_cm ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          body_size: {
                            ...values.body_size,
                            height_cm: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Fit Preference</Label>
                    <SelectField
                      value={values.body_size.fit_preference ?? ""}
                      onValueChange={(v) =>
                        setValues({
                          ...values,
                          body_size: { ...values.body_size, fit_preference: v },
                        })
                      }
                      options={FIT_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Size - Tops</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["XXS", "XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          selected={(values.body_size.size_tops ?? []).includes(s)}
                          onToggle={() =>
                            setValues({
                              ...values,
                              body_size: {
                                ...values.body_size,
                                size_tops: toggleInArray(values.body_size.size_tops ?? [], s),
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Size - Bottoms</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "36", "38", "40"].map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          selected={(values.body_size.size_bottoms ?? []).includes(s)}
                          onToggle={() =>
                            setValues({
                              ...values,
                              body_size: {
                                ...values.body_size,
                                size_bottoms: toggleInArray(values.body_size.size_bottoms ?? [], s),
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="col-span-1">
                    <Label>Shoe Size</Label>
                    <Input
                      placeholder="e.g. 42 EU"
                      value={values.body_size.shoe_size ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          body_size: {
                            ...values.body_size,
                            shoe_size: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Body Notes</Label>
                    <Textarea
                      rows={4}
                      placeholder="Any specific body considerations..."
                      value={values.body_size.body_notes ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          body_size: {
                            ...values.body_size,
                            body_notes: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "style" ? (
              <div className="pt-1">
                <div className="grid gap-6">
                  <div>
                    <Label>Style Types</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["Minimal", "Classic", "Elegant", "Streetwear", "Avant-garde", "Sporty", "Business", "Casual", "Trend-driven"].map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          selected={(values.style.style_types ?? []).includes(s)}
                          onToggle={() =>
                            setValues({
                              ...values,
                              style: {
                                ...values.style,
                                style_types: toggleInArray(values.style.style_types ?? [], s),
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                    <div>
                      <Label>Preferred Colors</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["Black", "White", "Beige", "Grey", "Brown", "Navy", "Colorful", "Red", "Blue", "Green", "Pink", "Purple", "Yellow"].map((c) => (
                          <Chip
                            key={c}
                            label={c}
                            selected={(values.style.preferred_colors ?? []).includes(c)}
                            onToggle={() =>
                              setValues({
                                ...values,
                                style: {
                                  ...values.style,
                                  preferred_colors: toggleInArray(values.style.preferred_colors ?? [], c),
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Avoided Colors</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["Black", "White", "Beige", "Grey", "Brown", "Navy", "Colorful", "Red", "Blue", "Green", "Pink", "Purple", "Yellow"].map((c) => (
                          <Chip
                            key={c}
                            label={c}
                            selected={(values.style.avoided_colors ?? []).includes(c)}
                            onToggle={() =>
                              setValues({
                                ...values,
                                style: {
                                  ...values.style,
                                  avoided_colors: toggleInArray(values.style.avoided_colors ?? [], c),
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Pattern Preference</Label>
                      <SelectField
                        value={values.style.pattern_preference ?? ""}
                        onValueChange={(v) => setValues({ ...values, style: { ...values.style, pattern_preference: v } })}
                        options={PATTERN_OPTIONS}
                      />
                    </div>

                    <div>
                      <Label>Logo Preference</Label>
                      <SelectField
                        value={values.style.logo_preference ?? ""}
                        onValueChange={(v) => setValues({ ...values, style: { ...values.style, logo_preference: v } })}
                        options={LOGO_OPTIONS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "preferences" ? (
              <div className="pt-1">
                <SectionTitle title="Lifestyle & Use Cases" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-5">
                  <div>
                    <Label>Profession / Industry</Label>
                    <Input
                      value={values.preferences.profession ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, profession: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Climate</Label>
                    <SelectField
                      value={values.preferences.climate ?? ""}
                      onValueChange={(v) => setValues({ ...values, preferences: { ...values.preferences, climate: v } })}
                      options={CLIMATE_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Travel Frequency</Label>
                    <SelectField
                      value={values.preferences.travel_frequency ?? ""}
                      onValueChange={(v) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, travel_frequency: v },
                        })
                      }
                      options={TRAVEL_FREQ_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Social Media</Label>
                    <Input
                      placeholder="@handle"
                      value={values.preferences.social_handle ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, social_handle: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <SectionTitle title="Budget & Shopping" topDivider />
                <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-5">
                  <div>
                    <Label>Budget Level</Label>
                    <SelectField
                      value={values.preferences.budget_level ?? ""}
                      onValueChange={(v) => setValues({ ...values, preferences: { ...values.preferences, budget_level: v } })}
                      options={BUDGET_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Price Sensitivity</Label>
                    <SelectField
                      value={values.preferences.price_sensitivity ?? ""}
                      onValueChange={(v) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, price_sensitivity: v },
                        })
                      }
                      options={PRICE_SENS_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Shopping Method</Label>
                    <SelectField
                      value={values.preferences.shopping_method ?? ""}
                      onValueChange={(v) => setValues({ ...values, preferences: { ...values.preferences, shopping_method: v } })}
                      options={SHOP_METHOD_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Preferred Stores</Label>
                    <Input
                      placeholder="e.g. Harrods, Net-a-Porter"
                      value={values.preferences.preferred_stores ?? ""}
                      onChange={(e) => setValues({ ...values, preferences: { ...values.preferences, preferred_stores: e.target.value } })}
                    />
                  </div>

                  <div>
                    <Label>Favorite Brands</Label>
                    <Input
                      placeholder="Comma-separated (e.g. Louis Vuitton, Hermès)"
                      value={(values.preferences.favorite_brands ?? []).join(", ")}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          preferences: {
                            ...values.preferences,
                            favorite_brands: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Disliked Brands</Label>
                    <Input
                      placeholder="Comma-separated (e.g. Guess, Uniqlo)"
                      value={(values.preferences.disliked_brands ?? []).join(", ")}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          preferences: {
                            ...values.preferences,
                            disliked_brands: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <SectionTitle title="Communication" topDivider />
                <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-5">
                  <div>
                    <Label>Preferred Contact Method</Label>
                    <SelectField
                      value={values.preferences.preferred_contact_method ?? ""}
                      onValueChange={(v) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, preferred_contact_method: v },
                        })
                      }
                      options={CONTACT_OPTIONS}
                    />
                  </div>

                  <div>
                    <Label>Response Time</Label>
                    <SelectField
                      value={values.preferences.response_time ?? ""}
                      onValueChange={(v) => setValues({ ...values, preferences: { ...values.preferences, response_time: v } })}
                      options={RESPONSE_TIME_OPTIONS}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Communication Notes</Label>
                    <Textarea
                      rows={4}
                      value={values.preferences.communication_notes ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          preferences: { ...values.preferences, communication_notes: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "notes" ? (
              <div className="pt-1">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-light text-neutral-600">
                  Private internal notes — not visible to clients.
                </div>

                <SectionTitle title="Internal Notes" topDivider />
                <div className="space-y-6 pt-5">
                  {[
                    ["Personality Notes", "personality_notes"],
                    ["Buying Behavior", "buying_behavior"],
                    ["Red Flags / Sensitivities", "red_flags"],
                    ["Special Instructions", "special_instructions"],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Textarea
                        rows={4}
                        value={(values.notes as any)[key] ?? ""}
                        onChange={(e) => setValues({ ...values, notes: { ...values.notes, [key]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-10 py-5">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-light text-neutral-900 hover:bg-neutral-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-lg bg-neutral-950 px-6 text-sm font-light text-white hover:bg-neutral-900 disabled:opacity-60"
          >
            {saving ? "Saving..." : mode === "create" ? "Create Client" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}