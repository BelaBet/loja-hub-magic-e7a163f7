import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AlertaOperacional {
  id: string;
  loja_id: string;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  referencia_id: string | null;
  lido: boolean;
  created_at: string;
}

const LIMITE = 30;

export function useAlertasOperacionais(lojaId: string | null) {
  const [alertas, setAlertas] = useState<AlertaOperacional[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!lojaId) {
      setAlertas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("alertas_operacionais" as any)
      .select("*")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    if (!error) setAlertas((data as unknown as AlertaOperacional[]) ?? []);
    setLoading(false);
  }, [lojaId]);

  useEffect(() => {
    void carregar();
    if (!lojaId) return;

    const channel = supabase
      .channel(`alertas-operacionais-${lojaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_operacionais", filter: `loja_id=eq.${lojaId}` },
        () => void carregar(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lojaId, carregar]);

  const marcarLido = useCallback(async (id: string) => {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, lido: true } : a)));
    await supabase.from("alertas_operacionais" as any).update({ lido: true }).eq("id", id);
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    if (!lojaId) return;
    const idsNaoLidos = alertas.filter((a) => !a.lido).map((a) => a.id);
    if (idsNaoLidos.length === 0) return;
    setAlertas((prev) => prev.map((a) => ({ ...a, lido: true })));
    await supabase.from("alertas_operacionais" as any).update({ lido: true }).in("id", idsNaoLidos);
  }, [alertas, lojaId]);

  const unreadCount = alertas.filter((a) => !a.lido).length;

  return { alertas, loading, unreadCount, marcarLido, marcarTodasLidas, recarregar: carregar };
}
