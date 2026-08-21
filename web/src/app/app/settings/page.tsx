// src/app/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

import {
  type TabKey,
  type BusinessProfile,
  type BusinessInfo,
  type BrandingSettings,
  type InvoiceSettings,
  type NotificationSettings,
  type DataPreferences,
  type BillingSubscription,
  LS_ACTIVE_BP,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/components/settings/settingsTypes";

import { Input, Select, Toggle, SectionCard, Modal, Toast } from "@/components/settings/SettingsUI";
import { cn } from "@/components/settings/settingsTypes";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<TabKey>("company");

  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  // per-profile settings state
  const [bpName, setBpName] = useState("");
  const [bpCountry, setBpCountry] = useState("DE");
  const [bpCurrency, setBpCurrency] = useState("EUR");
  const [bpLocale, setBpLocale] = useState("de-DE");
  const [bpTimezone, setBpTimezone] = useState("Europe/Berlin");

  const [company, setCompany] = useState<BusinessInfo>({
    business_profile_id: "",
    legal_name: "",
    trade_name: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    region: "",
    country: "",
    email: "",
    phone: "",
    website: "",
    vat_id: "",
    tax_id: "",
  });

  const [invoice, setInvoice] = useState<InvoiceSettings>({
    business_profile_id: "",
    invoice_prefix: "INV",
    numbering_mode: "manual",
    next_sequence: 1,
    payment_terms_days: 14,
    show_vat: false,
    default_footer: "",
  });

  const [branding, setBranding] = useState<BrandingSettings>({
    business_profile_id: "",
    logo_url: "",
    favicon_url: "",
    primary_color: "#111827",
    invoice_accent_color: "#111827",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    business_profile_id: "",
    email_new_invoice: false,
    email_invoice_paid: false,
    email_appointment_reminders: false,
    frequency: "immediate",
  });

  const [dataPrefs, setDataPrefs] = useState<DataPreferences>({
    business_profile_id: "",
    date_format: "DD.MM.YYYY",
    number_format: "1.234,56",
    default_project_status: "Inquiry",
  });

  const [billing, setBilling] = useState<BillingSubscription | null>(null);

  // toast
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // add business modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("New Business");
  const [addCountry, setAddCountry] = useState("DE");
  const [addCurrency, setAddCurrency] = useState("EUR");
  const [addLocale, setAddLocale] = useState("de-DE");
  const [addTimezone, setAddTimezone] = useState("Europe/Berlin");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  function showOk(msg: string) {
    setToast({ kind: "ok", msg });
    window.setTimeout(() => setToast(null), 2200);
  }
  function showErr(msg: string) {
    setToast({ kind: "err", msg });
    window.setTimeout(() => setToast(null), 3200);
  }

  const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
    { key: "company", label: "Company Data", hint: "Invoice-ready business details" },
    { key: "invoice", label: "Invoices", hint: "Numbering, VAT, footer" },
    { key: "branding", label: "Branding", hint: "Logo, colors" },
    { key: "notifications", label: "Notifications", hint: "Email alerts & reminders" },
    { key: "data", label: "Data", hint: "Defaults & formats" },
    { key: "business", label: "Business Profile", hint: "Country, currency, locale" },
    { key: "billing", label: "Billing", hint: "Plan & limits" },
    { key: "client_portal", label: "Client Portal", hint: "Coming soon" },
  ];

  const title = useMemo(() => tabs.find((t) => t.key === tab)?.label ?? "Settings", [tab]);

  const allowedProfiles = useMemo(() => {
    if (!billing) return null;
    return Number(billing.included_profiles ?? 1) + Number(billing.addon_profiles_qty ?? 0);
  }, [billing]);

  const usedProfiles = profiles.length;
  const canAddProfile = useMemo(() => {
    if (allowedProfiles == null) return true; // billing not set yet => allow in MVP
    return usedProfiles < allowedProfiles;
  }, [allowedProfiles, usedProfiles]);

  async function loadProfilesAndBilling() {
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Not authenticated");

      // Profiles
      const { data: bpRows, error: bpErr } = await supabase
        .from("business_profiles")
        .select("id, owner_id, name, country, currency, locale, timezone, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (bpErr) throw bpErr;

      const list: BusinessProfile[] = (bpRows ?? []).map((r: any) => ({
        id: String(r.id),
        owner_id: String(r.owner_id),
        name: String(r.name ?? ""),
        country: String(r.country ?? "DE"),
        currency: String(r.currency ?? "EUR"),
        locale: String(r.locale ?? "de-DE"),
        timezone: String(r.timezone ?? "Europe/Berlin"),
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      }));

      setProfiles(list);

      // Determine active
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(LS_ACTIVE_BP) : null;
      const fallback = list[0]?.id ?? "";
      const nextActive = saved && list.some((p) => p.id === saved) ? saved : fallback;
      setActiveProfileId(nextActive);

      // Billing snapshot (optional)
      const { data: bill, error: bErr } = await supabase
        .from("billing_subscription")
        .select("owner_id, status, plan_code, included_profiles, addon_profiles_qty, current_period_end")
        .eq("owner_id", user.id)
        .single();

      if (!bErr && bill) {
        setBilling({
          owner_id: String((bill as any).owner_id),
          status: String((bill as any).status ?? "inactive"),
          plan_code: String((bill as any).plan_code ?? "starter"),
          included_profiles: Number((bill as any).included_profiles ?? 1),
          addon_profiles_qty: Number((bill as any).addon_profiles_qty ?? 0),
          current_period_end: (bill as any).current_period_end ?? null,
        });
      } else {
        setBilling(null);
      }
    } catch (e: any) {
      console.error("[Settings] loadProfilesAndBilling failed:", e);
      showErr(e?.message ?? "Failed to load settings");
      setProfiles([]);
      setActiveProfileId("");
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllForProfile(profileId: string) {
    if (!profileId) return;

    try {
      const p = profiles.find((x) => x.id === profileId);
      if (p) {
        setBpName(p.name ?? "");
        setBpCountry(p.country ?? "DE");
        setBpCurrency(p.currency ?? "EUR");
        setBpLocale(p.locale ?? "de-DE");
        setBpTimezone(p.timezone ?? "Europe/Berlin");
      }

      // Company
      const { data: c, error: cErr } = await supabase
        .from("business_info")
        .select(
          "business_profile_id, legal_name, trade_name, address_line1, address_line2, postal_code, city, region, country, email, phone, website, vat_id, tax_id"
        )
        .eq("business_profile_id", profileId)
        .single();

      if (!cErr && c) {
        setCompany({
          business_profile_id: profileId,
          legal_name: (c as any).legal_name ?? "",
          trade_name: (c as any).trade_name ?? "",
          address_line1: (c as any).address_line1 ?? "",
          address_line2: (c as any).address_line2 ?? "",
          postal_code: (c as any).postal_code ?? "",
          city: (c as any).city ?? "",
          region: (c as any).region ?? "",
          country: (c as any).country ?? p?.country ?? "DE",
          email: (c as any).email ?? "",
          phone: (c as any).phone ?? "",
          website: (c as any).website ?? "",
          vat_id: (c as any).vat_id ?? "",
          tax_id: (c as any).tax_id ?? "",
        });
      } else {
        setCompany((prev) => ({ ...prev, business_profile_id: profileId, country: p?.country ?? "DE" }));
      }

      // Invoice Settings
      const { data: inv, error: invErr } = await supabase
        .from("invoice_settings")
        .select("business_profile_id, invoice_prefix, numbering_mode, next_sequence, payment_terms_days, show_vat, default_footer")
        .eq("business_profile_id", profileId)
        .single();

      if (!invErr && inv) {
        setInvoice({
          business_profile_id: profileId,
          invoice_prefix: (inv as any).invoice_prefix ?? "INV",
          numbering_mode: ((inv as any).numbering_mode ?? "manual") as any,
          next_sequence: Number((inv as any).next_sequence ?? 1),
          payment_terms_days: Number((inv as any).payment_terms_days ?? 14),
          show_vat: Boolean((inv as any).show_vat ?? false),
          default_footer: (inv as any).default_footer ?? "",
        });
      } else {
        setInvoice((prev) => ({ ...prev, business_profile_id: profileId }));
      }

      // Branding
      const { data: br, error: brErr } = await supabase
        .from("branding_settings")
        .select("business_profile_id, logo_url, favicon_url, primary_color, invoice_accent_color")
        .eq("business_profile_id", profileId)
        .single();

      if (!brErr && br) {
        setBranding({
          business_profile_id: profileId,
          logo_url: (br as any).logo_url ?? "",
          favicon_url: (br as any).favicon_url ?? "",
          primary_color: (br as any).primary_color ?? "#111827",
          invoice_accent_color: (br as any).invoice_accent_color ?? "#111827",
        });
      } else {
        setBranding((prev) => ({ ...prev, business_profile_id: profileId }));
      }

      // Notifications
      const { data: ns, error: nsErr } = await supabase
        .from("notification_settings")
        .select("business_profile_id, email_new_invoice, email_invoice_paid, email_appointment_reminders, frequency")
        .eq("business_profile_id", profileId)
        .single();

      if (!nsErr && ns) {
        setNotifications({
          business_profile_id: profileId,
          email_new_invoice: Boolean((ns as any).email_new_invoice ?? false),
          email_invoice_paid: Boolean((ns as any).email_invoice_paid ?? false),
          email_appointment_reminders: Boolean((ns as any).email_appointment_reminders ?? false),
          frequency: ((ns as any).frequency ?? "immediate") as any,
        });
      } else {
        setNotifications((prev) => ({ ...prev, business_profile_id: profileId }));
      }

      // Data Prefs
      const { data: dp, error: dpErr } = await supabase
        .from("data_preferences")
        .select("business_profile_id, date_format, number_format, default_project_status")
        .eq("business_profile_id", profileId)
        .single();

      if (!dpErr && dp) {
        setDataPrefs({
          business_profile_id: profileId,
          date_format: String((dp as any).date_format ?? "DD.MM.YYYY"),
          number_format: String((dp as any).number_format ?? "1.234,56"),
          default_project_status: String((dp as any).default_project_status ?? "Inquiry"),
        });
      } else {
        setDataPrefs((prev) => ({ ...prev, business_profile_id: profileId }));
      }
    } catch (e) {
      console.error("[Settings] loadAllForProfile failed:", e);
      showErr("Failed to load profile settings");
    }
  }

  useEffect(() => {
    loadProfilesAndBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;
    try {
      window.localStorage.setItem(LS_ACTIVE_BP, activeProfileId);
    } catch {}
    // wait until profiles loaded (so defaults are correct)
    if (profiles.length > 0) loadAllForProfile(activeProfileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, profiles.length]);

  async function saveAll() {
    if (!activeProfileId) return;
    setSaving(true);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Not authenticated");

      // 1) business_profiles update
      const { error: bpErr } = await supabase
        .from("business_profiles")
        .update({
          name: bpName.trim() || "Business",
          country: bpCountry,
          currency: bpCurrency,
          locale: bpLocale,
          timezone: bpTimezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeProfileId)
        .eq("owner_id", user.id);

      if (bpErr) throw bpErr;

      // 2) child tables upsert
      const { error: cErr } = await supabase.from("business_info").upsert({
        business_profile_id: activeProfileId,
        legal_name: company.legal_name?.trim() || null,
        trade_name: company.trade_name?.trim() || null,
        address_line1: company.address_line1?.trim() || null,
        address_line2: company.address_line2?.trim() || null,
        postal_code: company.postal_code?.trim() || null,
        city: company.city?.trim() || null,
        region: company.region?.trim() || null,
        country: (company.country?.trim() || bpCountry) ?? bpCountry,
        email: company.email?.trim() || null,
        phone: company.phone?.trim() || null,
        website: company.website?.trim() || null,
        vat_id: company.vat_id?.trim() || null,
        tax_id: company.tax_id?.trim() || null,
      });

      if (cErr) throw cErr;

      const { error: iErr } = await supabase.from("invoice_settings").upsert({
        business_profile_id: activeProfileId,
        invoice_prefix: (invoice.invoice_prefix ?? "INV").trim() || "INV",
        numbering_mode: invoice.numbering_mode ?? "manual",
        next_sequence: Number(invoice.next_sequence ?? 1),
        payment_terms_days: Number(invoice.payment_terms_days ?? 14),
        show_vat: Boolean(invoice.show_vat ?? false),
        default_footer: invoice.default_footer?.trim() || null,
      });

      if (iErr) throw iErr;

      const { error: bErr } = await supabase.from("branding_settings").upsert({
        business_profile_id: activeProfileId,
        logo_url: branding.logo_url?.trim() || null,
        favicon_url: branding.favicon_url?.trim() || null,
        primary_color: branding.primary_color?.trim() || "#111827",
        invoice_accent_color: branding.invoice_accent_color?.trim() || "#111827",
      });

      if (bErr) throw bErr;

      const { error: nErr } = await supabase.from("notification_settings").upsert({
        business_profile_id: activeProfileId,
        email_new_invoice: Boolean(notifications.email_new_invoice),
        email_invoice_paid: Boolean(notifications.email_invoice_paid),
        email_appointment_reminders: Boolean(notifications.email_appointment_reminders),
        frequency: notifications.frequency ?? "immediate",
      });

      if (nErr) throw nErr;

      const { error: dErr } = await supabase.from("data_preferences").upsert({
        business_profile_id: activeProfileId,
        date_format: dataPrefs.date_format ?? "DD.MM.YYYY",
        number_format: dataPrefs.number_format ?? "1.234,56",
        default_project_status: dataPrefs.default_project_status ?? "Inquiry",
      });

      if (dErr) throw dErr;

      await loadProfilesAndBilling();
      showOk("Saved");
    } catch (e: any) {
      console.error("[Settings] save failed:", e);
      showErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createBusinessProfile() {
    setAddBusy(true);
    setAddErr(null);

    try {
      if (!canAddProfile) {
        setAddErr("Profile limit reached for your plan. Please add the Business Profiles addon.");
        return;
      }

      // Prefer server route (enforce billing / RLS centrally)
      let createdId: string | null = null;

      try {
        const res = await fetch("/api/settings/business-profiles/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: addName,
            country: addCountry,
            currency: addCurrency,
            locale: addLocale,
            timezone: addTimezone,
          }),
        });

        if (res.ok) {
          const json = await res.json().catch(() => ({} as any));
          createdId = json?.business_profile?.id ? String(json.business_profile.id) : null;
        } else {
          const json = await res.json().catch(() => ({} as any));
          const msg = json?.error || `Create failed (${res.status})`;
          // If the route doesn't exist yet, we fall back below
          if (res.status !== 404) {
            setAddErr(msg);
            return;
          }
        }
      } catch {
        // ignore and fall back to client insert
      }

      // Fallback: direct supabase insert (works if your RLS allows owner_id = auth.uid())
      if (!createdId) {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = auth.user;
        if (!user) throw new Error("Not authenticated");

        const { data: inserted, error: insErr } = await supabase
          .from("business_profiles")
          .insert({
            owner_id: user.id,
            name: (addName ?? "").trim() || "Business",
            country: addCountry,
            currency: addCurrency,
            locale: addLocale,
            timezone: addTimezone,
          })
          .select("id")
          .single();

        if (insErr) throw insErr;
        createdId = inserted?.id ? String(inserted.id) : null;
      }

      await loadProfilesAndBilling();

      if (createdId) setActiveProfileId(createdId);

      setAddOpen(false);
      showOk("Business profile created");
    } catch (e: any) {
      console.error("[Settings] createBusinessProfile failed:", e);
      setAddErr(e?.message ?? "Create failed");
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toast toast={toast} />

      {/* Add Business Modal */}
      <Modal
        open={addOpen}
        title="Add Business Profile"
        subtitle="This creates a new business profile (country + currency + locale)."
        disableClose={addBusy}
        onClose={() => {
          if (addBusy) return;
          setAddOpen(false);
          setAddErr(null);
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Business name" value={addName} onChange={setAddName} placeholder="e.g. Filumedia GmbH" />
          </div>

          <Select label="Country" value={addCountry} onChange={setAddCountry} options={COUNTRY_OPTIONS} />
          <Select label="Currency" value={addCurrency} onChange={setAddCurrency} options={CURRENCY_OPTIONS} />

          <Select label="Locale" value={addLocale} onChange={setAddLocale} options={LOCALE_OPTIONS} />
          <Select label="Timezone" value={addTimezone} onChange={setAddTimezone} options={TIMEZONE_OPTIONS} />
        </div>

        {addErr ? <div className="mt-4 text-[13px] font-light text-red-700">{addErr}</div> : null}

        {!canAddProfile ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-[13px] font-light text-amber-900">
            You reached your plan limit. Add the “Business Profiles” addon to create more profiles.
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (addBusy) return;
              setAddOpen(false);
              setAddErr(null);
            }}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={addBusy || !canAddProfile}
            onClick={createBusinessProfile}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-[13px] font-light text-white",
              "hover:bg-neutral-900 disabled:opacity-60"
            )}
          >
            <Plus size={16} />
            {addBusy ? "Creating..." : "Create"}
          </button>
        </div>
      </Modal>

      <div className="w-full px-10 pt-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[40px] font-extralight leading-none tracking-tight text-neutral-950">Settings</div>
            <div className="mt-2 text-[13px] font-light text-neutral-500">
              Business profiles + invoice-ready company data (multi-country ready).
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Business Switcher */}
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div>
                <div className="text-[11px] font-light text-neutral-500">Active business</div>
                <select
                  className="mt-1 w-[260px] bg-transparent text-[13px] font-light text-neutral-900 outline-none"
                  value={activeProfileId}
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  disabled={loading || profiles.length === 0}
                >
                  {profiles.length === 0 ? <option value="">No business profiles</option> : null}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setAddOpen(true)}
                disabled={!canAddProfile}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-light text-neutral-900 hover:bg-neutral-50",
                  !canAddProfile ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                <Plus size={16} />
                Add
              </button>
            </div>

            <button
              type="button"
              disabled={saving || loading || !activeProfileId}
              onClick={saveAll}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-neutral-950",
                "px-5 py-3 text-[13px] font-light text-white",
                "transition hover:bg-neutral-900 disabled:opacity-60"
              )}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="mt-8 grid grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="px-2 pb-3 text-[12px] font-light text-neutral-500">Navigation</div>

            <div className="space-y-1">
              {tabs.map((t) => {
                const active = t.key === tab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn("w-full rounded-xl px-3 py-3 text-left transition", active ? "bg-neutral-950 text-white" : "hover:bg-neutral-50")}
                  >
                    <div className={cn("text-[13px] font-light", active ? "text-white" : "text-neutral-900")}>{t.label}</div>
                    <div className={cn("mt-1 text-[12px] font-light", active ? "text-white/70" : "text-neutral-500")}>{t.hint}</div>
                  </button>
                );
              })}
            </div>

            {/* Plan / Limits mini box */}
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
              <div className="text-[12px] font-light text-neutral-500">Business profiles</div>
              <div className="mt-2 text-[13px] font-light text-neutral-900">
                {usedProfiles} used
                {allowedProfiles != null ? (
                  <>
                    {" "}
                    / <span className="text-neutral-900">{allowedProfiles}</span> allowed
                  </>
                ) : null}
              </div>

              {billing ? (
                <div className="mt-2 text-[12px] font-light text-neutral-500">
                  Plan: <span className="text-neutral-900">{billing.plan_code}</span> • Status:{" "}
                  <span className="text-neutral-900">{billing.status}</span>
                </div>
              ) : (
                <div className="mt-2 text-[12px] font-light text-neutral-500">Billing snapshot not set yet.</div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {loading ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="text-[13px] font-light text-neutral-500">Loading…</div>
              </div>
            ) : !activeProfileId ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="text-[15px] font-medium text-neutral-900">No business profile</div>
                <div className="mt-2 text-[13px] font-light text-neutral-500">
                  Create your first business profile to configure invoice data and settings.
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-[13px] font-light text-white hover:bg-neutral-900"
                >
                  <Plus size={16} />
                  Add business profile
                </button>
              </div>
            ) : (
              <>
                {/* Title */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                  <div className="text-[20px] font-medium text-neutral-900">{title}</div>
                  <div className="mt-1 text-[13px] font-light text-neutral-500">
                    Active: <span className="text-neutral-900">{activeProfile?.name ?? "—"}</span>
                  </div>
                </div>

                {/* BUSINESS PROFILE */}
                {tab === "business" ? (
                  <SectionCard title="Business Profile" subtitle="Default country, currency and locale for this profile. Used across the app.">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Input label="Business profile name" value={bpName} onChange={setBpName} placeholder="e.g. Filumedia" />
                      </div>

                      <Select
                        label="Country"
                        value={bpCountry}
                        onChange={(v) => {
                          setBpCountry(v);
                          setCompany((c) => ({ ...c, country: c.country || v }));
                        }}
                        options={COUNTRY_OPTIONS}
                      />
                      <Select label="Currency" value={bpCurrency} onChange={setBpCurrency} options={CURRENCY_OPTIONS} />

                      <Select label="Locale" value={bpLocale} onChange={setBpLocale} options={LOCALE_OPTIONS} />
                      <Select label="Timezone" value={bpTimezone} onChange={setBpTimezone} options={TIMEZONE_OPTIONS} />
                    </div>

                    <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
                      <div className="text-[12px] font-light text-neutral-500">Multi-country MVP</div>
                      <div className="mt-1 text-[13px] font-light text-neutral-900">
                        Each business profile can represent a different country + currency + locale. Later, PDF generation will use this profile’s rules.
                      </div>
                    </div>
                  </SectionCard>
                ) : null}

                {/* COMPANY DATA */}
                {tab === "company" ? (
                  <SectionCard title="Company Data" subtitle="Invoice-ready business details (legal name, address, tax IDs).">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Legal name"
                        value={String(company.legal_name ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, legal_name: v }))}
                        placeholder="e.g. Filumedia Webdesign Einzelunternehmen"
                      />
                      <Input
                        label="Trade name (optional)"
                        value={String(company.trade_name ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, trade_name: v }))}
                        placeholder="e.g. Filumedia"
                      />

                      <div className="col-span-2">
                        <Input
                          label="Address line 1"
                          value={String(company.address_line1 ?? "")}
                          onChange={(v) => setCompany((p) => ({ ...p, address_line1: v }))}
                          placeholder="Street + number"
                        />
                      </div>

                      <div className="col-span-2">
                        <Input
                          label="Address line 2 (optional)"
                          value={String(company.address_line2 ?? "")}
                          onChange={(v) => setCompany((p) => ({ ...p, address_line2: v }))}
                          placeholder="Apartment, suite, etc."
                        />
                      </div>

                      <Input
                        label="Postal code"
                        value={String(company.postal_code ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, postal_code: v }))}
                        placeholder="e.g. 94034"
                      />
                      <Input
                        label="City"
                        value={String(company.city ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, city: v }))}
                        placeholder="e.g. Passau"
                      />

                      <Input
                        label="Region / State (optional)"
                        value={String(company.region ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, region: v }))}
                        placeholder="e.g. Bayern"
                      />

                      <Select
                        label="Country"
                        value={String(company.country ?? bpCountry ?? "DE")}
                        onChange={(v) => setCompany((p) => ({ ...p, country: v }))}
                        options={COUNTRY_OPTIONS}
                      />

                      <Input
                        label="Email (optional)"
                        value={String(company.email ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, email: v }))}
                        placeholder="billing@yourdomain.com"
                      />
                      <Input
                        label="Phone (optional)"
                        value={String(company.phone ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, phone: v }))}
                        placeholder="+49 ..."
                      />

                      <Input
                        label="Website (optional)"
                        value={String(company.website ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, website: v }))}
                        placeholder="https://..."
                      />

                      <Input
                        label="VAT ID (optional)"
                        value={String(company.vat_id ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, vat_id: v }))}
                        placeholder="DE..."
                      />
                      <Input
                        label="Tax ID (optional)"
                        value={String(company.tax_id ?? "")}
                        onChange={(v) => setCompany((p) => ({ ...p, tax_id: v }))}
                        placeholder="Steuernummer / Tax ID"
                      />
                    </div>

                    <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
                      <div className="text-[12px] font-light text-neutral-500">Used for PDFs</div>
                      <div className="mt-1 text-[13px] font-light text-neutral-900">
                        This data will be printed onto “official” invoice PDFs (sender address + tax IDs).
                      </div>
                    </div>
                  </SectionCard>
                ) : null}

                {/* INVOICE SETTINGS */}
                {tab === "invoice" ? (
                  <SectionCard title="Invoice Settings" subtitle="Numbering, VAT toggle, payment terms and default footer.">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Invoice prefix"
                        value={String(invoice.invoice_prefix ?? "INV")}
                        onChange={(v) => setInvoice((p) => ({ ...p, invoice_prefix: v }))}
                        placeholder="INV"
                      />

                      <Select
                        label="Numbering mode"
                        value={invoice.numbering_mode}
                        onChange={(v) => setInvoice((p) => ({ ...p, numbering_mode: v as any }))}
                        options={[
                          { value: "manual", label: "Manual" },
                          { value: "auto", label: "Auto sequence" },
                        ]}
                      />

                      <Input
                        label="Next sequence (auto mode)"
                        type="number"
                        value={String(invoice.next_sequence ?? 1)}
                        onChange={(v) => setInvoice((p) => ({ ...p, next_sequence: Number(v || 1) }))}
                        placeholder="1"
                      />

                      <Input
                        label="Payment terms (days)"
                        type="number"
                        value={String(invoice.payment_terms_days ?? 14)}
                        onChange={(v) => setInvoice((p) => ({ ...p, payment_terms_days: Number(v || 14) }))}
                        placeholder="14"
                      />

                      <div className="col-span-2">
                        <Toggle
                          label="Show VAT"
                          checked={Boolean(invoice.show_vat)}
                          onChange={(v) => setInvoice((p) => ({ ...p, show_vat: v }))}
                          help="Enable if you want to display VAT lines on invoices for this business profile."
                        />
                      </div>

                      <div className="col-span-2">
                        <div className="text-[12px] font-light text-neutral-500">Default footer (optional)</div>
                        <textarea
                          className={cn(
                            "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2",
                            "text-[13px] font-light text-neutral-900 outline-none",
                            "focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                          )}
                          rows={4}
                          value={String(invoice.default_footer ?? "")}
                          onChange={(e) => setInvoice((p) => ({ ...p, default_footer: e.target.value }))}
                          placeholder="Bank details, legal notice, payment instructions…"
                        />
                      </div>
                    </div>
                  </SectionCard>
                ) : null}

                {/* BRANDING */}
                {tab === "branding" ? (
                  <SectionCard title="Branding" subtitle="Logo + colors used for PDF invoice styling later.">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Input
                          label="Logo URL (optional)"
                          value={String(branding.logo_url ?? "")}
                          onChange={(v) => setBranding((p) => ({ ...p, logo_url: v }))}
                          placeholder="https://.../logo.png"
                        />
                      </div>

                      <div className="col-span-2">
                        <Input
                          label="Favicon URL (optional)"
                          value={String(branding.favicon_url ?? "")}
                          onChange={(v) => setBranding((p) => ({ ...p, favicon_url: v }))}
                          placeholder="https://.../favicon.ico"
                        />
                      </div>

                      <Input
                        label="Primary color"
                        value={String(branding.primary_color ?? "#111827")}
                        onChange={(v) => setBranding((p) => ({ ...p, primary_color: v }))}
                        placeholder="#111827"
                      />

                      <Input
                        label="Invoice accent color"
                        value={String(branding.invoice_accent_color ?? "#111827")}
                        onChange={(v) => setBranding((p) => ({ ...p, invoice_accent_color: v }))}
                        placeholder="#111827"
                      />
                    </div>
                  </SectionCard>
                ) : null}

                {/* NOTIFICATIONS */}
                {tab === "notifications" ? (
                  <SectionCard title="Notifications" subtitle="Email notifications (MVP toggles).">
                    <div className="grid grid-cols-1 gap-3">
                      <Toggle
                        label="Email me when a new invoice is created"
                        checked={Boolean(notifications.email_new_invoice)}
                        onChange={(v) => setNotifications((p) => ({ ...p, email_new_invoice: v }))}
                      />
                      <Toggle
                        label="Email me when an invoice is marked as paid"
                        checked={Boolean(notifications.email_invoice_paid)}
                        onChange={(v) => setNotifications((p) => ({ ...p, email_invoice_paid: v }))}
                      />
                      <Toggle
                        label="Appointment reminder emails (later)"
                        checked={Boolean(notifications.email_appointment_reminders)}
                        onChange={(v) => setNotifications((p) => ({ ...p, email_appointment_reminders: v }))}
                        help="We can wire this up when appointments + reminders are finished."
                      />
                      <Select
                        label="Frequency"
                        value={notifications.frequency}
                        onChange={(v) => setNotifications((p) => ({ ...p, frequency: v as any }))}
                        options={[
                          { value: "immediate", label: "Immediate" },
                          { value: "daily", label: "Daily digest" },
                          { value: "weekly", label: "Weekly digest" },
                        ]}
                      />
                    </div>
                  </SectionCard>
                ) : null}

                {/* DATA */}
                {tab === "data" ? (
                  <SectionCard title="Data" subtitle="Defaults and formatting per business profile.">
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label="Date format"
                        value={dataPrefs.date_format}
                        onChange={(v) => setDataPrefs((p) => ({ ...p, date_format: v }))}
                        options={[
                          { value: "DD.MM.YYYY", label: "DD.MM.YYYY (DE)" },
                          { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
                          { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
                        ]}
                      />
                      <Select
                        label="Number format"
                        value={dataPrefs.number_format}
                        onChange={(v) => setDataPrefs((p) => ({ ...p, number_format: v }))}
                        options={[
                          { value: "1.234,56", label: "1.234,56 (DE/EU)" },
                          { value: "1,234.56", label: "1,234.56 (US/UK)" },
                        ]}
                      />
                      <div className="col-span-2">
                        <Input
                          label="Default project status"
                          value={dataPrefs.default_project_status}
                          onChange={(v) => setDataPrefs((p) => ({ ...p, default_project_status: v }))}
                          placeholder="Inquiry"
                        />
                      </div>
                    </div>
                  </SectionCard>
                ) : null}

                {/* BILLING */}
                {tab === "billing" ? (
                  <SectionCard title="Billing" subtitle="Plan snapshot + profile limits (Stripe wiring later).">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
                      <div className="text-[13px] font-medium text-neutral-900">Current plan</div>

                      {billing ? (
                        <div className="mt-2 space-y-1 text-[13px] font-light text-neutral-700">
                          <div>
                            Plan code: <span className="text-neutral-900">{billing.plan_code}</span>
                          </div>
                          <div>
                            Status: <span className="text-neutral-900">{billing.status}</span>
                          </div>
                          <div>
                            Included profiles: <span className="text-neutral-900">{billing.included_profiles}</span>
                          </div>
                          <div>
                            Addon profiles: <span className="text-neutral-900">{billing.addon_profiles_qty}</span>
                          </div>
                          <div>
                            Total allowed:{" "}
                            <span className="text-neutral-900">
                              {Number(billing.included_profiles ?? 1) + Number(billing.addon_profiles_qty ?? 0)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[13px] font-light text-neutral-700">
                          No billing snapshot yet. (OK for MVP — we’ll add Stripe later.)
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                      <div className="text-[13px] font-medium text-neutral-900">Business Profiles addon</div>
                      <div className="mt-1 text-[13px] font-light text-neutral-500">
                        You want “Idea A”: different plans + optional addon for extra business profiles.
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          disabled
                          className="rounded-lg bg-neutral-950 px-4 py-2 text-[13px] font-light text-white opacity-60"
                        >
                          Manage subscription (coming soon)
                        </button>
                        <div className="text-[12px] font-light text-neutral-500">
                          We’ll wire this to Stripe Checkout + customer portal.
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                                  ) : null}

                {/* CLIENT PORTAL */}
                {tab === "client_portal" ? (
                  <SectionCard title="Client Portal" subtitle="Coming soon — we’ll enable this in a later update.">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
                      <div className="text-[13px] font-light text-neutral-900">
                        The client portal will let your customers view invoices, approve outfits, and book appointments.
                      </div>
                      <div className="mt-2 text-[13px] font-light text-neutral-500">
                        For MVP we only show this placeholder tab.
                      </div>
                    </div>
                  </SectionCard>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}