"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      setStatus(error ? `ERROR: ${error.message}` : "OK ✅ Supabase connected");
    });
  }, []);

  return (
    <main style={{ padding: 32 }}>
      <h1>ATELIA OS</h1>
      <p>{status}</p>
    </main>
  );
}