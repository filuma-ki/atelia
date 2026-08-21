// src/components/settings/settingsTypes.ts

export type TabKey =
  | "business"
  | "company"
  | "invoice"
  | "branding"
  | "notifications"
  | "data"
  | "billing"
  | "client_portal";

export type BusinessProfile = {
  id: string;
  owner_id: string;
  name: string;
  country: string;
  currency: string;
  locale: string;
  timezone: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BusinessInfo = {
  business_profile_id: string;
  legal_name: string | null;
  trade_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vat_id: string | null;
  tax_id: string | null;
};

export type BrandingSettings = {
  business_profile_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  invoice_accent_color: string | null;
};

export type InvoiceLanguage = "en" | "de" | "es" | "fr";

export type InvoiceSettings = {
  business_profile_id: string;
  invoice_prefix: string | null;
  numbering_mode: "manual" | "auto";
  next_sequence: number;
  payment_terms_days: number;
  show_vat: boolean;
  default_footer: string | null;

  // ✅ NEW — Sprache der PDF-Rechnung
  invoice_language: InvoiceLanguage;
};

export type NotificationSettings = {
  business_profile_id: string;
  email_new_invoice: boolean;
  email_invoice_paid: boolean;
  email_appointment_reminders: boolean;
  frequency: "immediate" | "daily" | "weekly";
};

export type DataPreferences = {
  business_profile_id: string;
  date_format: string;
  number_format: string;
  default_project_status: string;
};

export type BillingSubscription = {
  owner_id: string;
  status: string;
  plan_code: string;
  included_profiles: number;
  addon_profiles_qty: number;
  current_period_end: string | null;
};

export type StatusFilter = "all" | "open" | "paid";

export const LS_ACTIVE_BP = "atelia_active_business_profile_id";

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export const COUNTRY_OPTIONS = [
  { value: "DE", label: "Germany (DE)" },
  { value: "AT", label: "Austria (AT)" },
  { value: "CH", label: "Switzerland (CH)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "FR", label: "France (FR)" },
  { value: "ES", label: "Spain (ES)" },
  { value: "IT", label: "Italy (IT)" },
  { value: "NL", label: "Netherlands (NL)" },
  { value: "SE", label: "Sweden (SE)" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "CHF", label: "CHF (Fr)" },
  { value: "GBP", label: "GBP (£)" },
] as const;

export const LOCALE_OPTIONS = [
  { value: "de-DE", label: "de-DE" },
  { value: "en-US", label: "en-US" },
  { value: "en-GB", label: "en-GB" },
  { value: "fr-FR", label: "fr-FR" },
  { value: "es-ES", label: "es-ES" },
  { value: "it-IT", label: "it-IT" },
  { value: "nl-NL", label: "nl-NL" },
] as const;

export const TIMEZONE_OPTIONS = [
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Vienna", label: "Europe/Vienna" },
  { value: "Europe/Zurich", label: "Europe/Zurich" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
] as const;