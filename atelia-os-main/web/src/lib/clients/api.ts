import { supabase } from "@/lib/supabaseClient";
import type { Client, ClientFormValues } from "./types";

export async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Not authenticated");
  return data.user.id;
}

export async function listClients(): Promise<Client[]> {
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClientById(id: string): Promise<Client | null> {
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as Client | null;
}

export async function createClient(values: ClientFormValues): Promise<Client> {
  const userId = await getAuthedUserId();

  const payload: any = {
    owner_id: userId,

    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    gender: values.gender || null,
    age_group: values.age_group || null,
    city: values.city?.trim() || null,
    country: values.country?.trim() || null,

    // ✅ Billing address (new)
    billing_street: values.billing_street?.trim() || null,
    billing_house_number: values.billing_house_number?.trim() || null,
    billing_postal_code: values.billing_postal_code?.trim() || null,
    billing_city: values.billing_city?.trim() || null,
    billing_country: values.billing_country?.trim() || null,

    body_size: values.body_size ?? {},
    style: values.style ?? {},
    preferences: values.preferences ?? {},
    notes: values.notes ?? {},
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, values: ClientFormValues): Promise<Client> {
  const userId = await getAuthedUserId();

  const payload: any = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    gender: values.gender || null,
    age_group: values.age_group || null,
    city: values.city?.trim() || null,
    country: values.country?.trim() || null,

    // ✅ Billing address (new)
    billing_street: values.billing_street?.trim() || null,
    billing_house_number: values.billing_house_number?.trim() || null,
    billing_postal_code: values.billing_postal_code?.trim() || null,
    billing_city: values.billing_city?.trim() || null,
    billing_country: values.billing_country?.trim() || null,

    body_size: values.body_size ?? {},
    style: values.style ?? {},
    preferences: values.preferences ?? {},
    notes: values.notes ?? {},

    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("owner_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const userId = await getAuthedUserId();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("owner_id", userId)
    .eq("id", id);

  if (error) throw error;
}