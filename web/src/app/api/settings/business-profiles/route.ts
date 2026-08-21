import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Helper: calculate allowed profiles from subscription snapshot
function allowedProfiles(sub: any) {
  const included = Number(sub?.included_profiles ?? 1);
  const addonQty = Number(sub?.addon_profiles_qty ?? 0);
  return included + addonQty;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, country, currency, locale, timezone } = body ?? {};

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // 1) get subscription snapshot
    const { data: sub, error: subErr } = await supabase
      .from("billing_subscription")
      .select("owner_id, status, included_profiles, addon_profiles_qty")
      .eq("owner_id", user.id)
      .single();

    if (subErr) {
      // if missing, treat as inactive with 0 allowed (or 1 for free trial)
      return NextResponse.json({ error: "No subscription found" }, { status: 402 });
    }

    if (String(sub.status) !== "active") {
      return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
    }

    // 2) count existing
    const { count, error: countErr } = await supabase
      .from("business_profiles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

    const limit = allowedProfiles(sub);
    const used = Number(count ?? 0);

    if (used >= limit) {
      return NextResponse.json(
        { error: "Limit reached", code: "LIMIT_REACHED", used, limit },
        { status: 403 }
      );
    }

    // 3) create profile
    const { data: created, error: insErr } = await supabase
      .from("business_profiles")
      .insert({
        owner_id: user.id,
        name: String(name ?? "New Business").trim(),
        country: String(country ?? "DE"),
        currency: String(currency ?? "EUR"),
        locale: String(locale ?? "de-DE"),
        timezone: String(timezone ?? "Europe/Berlin"),
      })
      .select("id, owner_id, name, country, currency, locale, timezone")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 4) create defaults in child tables
    const bpId = created.id;

    await supabase.from("business_info").upsert({ business_profile_id: bpId, country: created.country });
    await supabase.from("branding_settings").upsert({ business_profile_id: bpId });
    await supabase.from("invoice_settings").upsert({ business_profile_id: bpId });
    await supabase.from("notification_settings").upsert({ business_profile_id: bpId });
    await supabase.from("data_preferences").upsert({ business_profile_id: bpId });

    return NextResponse.json({ business_profile: created }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}