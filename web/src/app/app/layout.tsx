"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  // Dashboard-Routen: passe an, falls dein Dashboard anders heißt
  const isDashboard = pathname === "/app" || pathname === "/app/dashboard";

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!hasSession) {
        router.replace("/auth/login");
        return;
      }

      if (mounted) setChecking(false);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/auth/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-600">
        Loading…
      </div>
    );
  }

  return (
    <AppShell showTopBar={isDashboard} showQuickActions={isDashboard}>
      {children}
    </AppShell>
  );
}