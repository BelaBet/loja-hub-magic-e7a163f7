import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTechnicalAlertType } from "@/lib/alertTypes";

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

/**
 * Alertas voltados pro dia a dia do lojista (sino de notificações). Alertas
 * técnicos (webhook, recipient de pagamento) ficam de fora daqui — vivem em
 * /admin/alertas-tecnicos, só pra super admin. Ver src/lib/alertTypes.ts.
 */
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
      .limit(LIMITE * 2); // margem pra sobrar LIMITE depois de filtrar os técnicos
    if (!error) {
      const negocio = ((data as unknown as AlertaOperacional[]) ?? []).filter(
        (a) => !isTechnicalAlertType(a.tipo),
      );
      setAlertas(negocio.slice(0, LIMITE));
    }
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
