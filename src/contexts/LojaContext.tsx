import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export type LojaMembership = {
  loja_id: string;
  role: string;
  loja: { id: string; nome: string; logo_url: string | null } | null;
};

type LojaContextValue = {
  lojas: LojaMembership[];
  lojaAtivaId: string | null;
  lojaAtiva: LojaMembership | null;
  loading: boolean;
  switching: boolean;
  setLojaAtiva: (lojaId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const LojaContext = createContext<LojaContextValue | undefined>(undefined);

const STORAGE_KEY = "active_loja_id";

export function LojaProvider({ children }: { children: ReactNode }) {
  const [lojas, setLojas] = useState<LojaMembership[]>([]);
  const [lojaAtivaId, setLojaAtivaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const queryClient = useQueryClient();

  const loadLojas = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLojas([]);
      setLojaAtivaId(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("loja_usuarios")
      .select("loja_id, role, loja:lojas(id, nome, logo_url)")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[LojaContext] load error", error);
      setLojas([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as LojaMembership[];
    setLojas(list);

    const claimLoja = (session.user.app_metadata as { active_loja_id?: string } | undefined)?.active_loja_id ?? null;
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const preferred = claimLoja ?? stored ?? null;
    const valid = preferred && list.some((l) => l.loja_id === preferred) ? preferred : list[0]?.loja_id ?? null;
    setLojaAtivaId(valid);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLojas();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadLojas();
    });
    return () => subscription.unsubscribe();
  }, [loadLojas]);

  const setLojaAtiva = useCallback(async (lojaId: string) => {
    if (lojaId === lojaAtivaId) return;
    setSwitching(true);
    try {
      const { error } = await supabase.functions.invoke("set-active-loja", {
        body: { loja_id: lojaId },
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
      localStorage.setItem(STORAGE_KEY, lojaId);
      setLojaAtivaId(lojaId);
      queryClient.clear();
    } finally {
      setSwitching(false);
    }
  }, [lojaAtivaId, queryClient]);

  const lojaAtiva = lojas.find((l) => l.loja_id === lojaAtivaId) ?? null;

  return (
    <LojaContext.Provider value={{ lojas, lojaAtivaId, lojaAtiva, loading, switching, setLojaAtiva, refresh: loadLojas }}>
      {children}
    </LojaContext.Provider>
  );
}

export function useLoja() {
  const ctx = useContext(LojaContext);
  if (!ctx) throw new Error("useLoja must be used inside LojaProvider");
  return ctx;
}