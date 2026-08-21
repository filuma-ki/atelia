"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabaseClient";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  const onLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        onLogout={onLogout}
      />

      {/* Rechter Bereich */}
      <div className="flex-1 min-w-0">
        {/* NUR HIER scrollt der Content */}
        <main className="h-full overflow-y-auto px-10 pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}