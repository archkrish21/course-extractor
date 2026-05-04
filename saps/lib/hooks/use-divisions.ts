"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface DivisionOption {
  id: string;
  name: string;
  code: string;
  departments: DepartmentOption[];
}

interface CacheEntry {
  data: DivisionOption[];
  fetchedAt: number;
}

// Cached at module scope so consumers across pages share a single fetch
// per session — the catalog only changes once a year.
let cache: CacheEntry | null = null;
let inFlight: Promise<DivisionOption[]> | null = null;

const TTL_MS = 5 * 60 * 1000; // 5 minutes is enough; data rarely changes

async function fetchDivisions(): Promise<DivisionOption[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.data;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const res = await apiFetch("/api/v1/divisions");
      if (!res.ok) throw new Error(`Failed to fetch divisions: ${res.status}`);
      const json = (await res.json()) as { data: DivisionOption[] };
      const data = json.data ?? [];
      cache = { data, fetchedAt: Date.now() };
      return data;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useDivisions() {
  const [divisions, setDivisions] = useState<DivisionOption[]>(
    () => cache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !cache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDivisions()
      .then((data) => {
        if (!alive) return;
        setDivisions(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { divisions, loading, error };
}
