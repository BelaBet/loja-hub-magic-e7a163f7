import { useEffect, useState, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { offlineDb, type PendingSale } from "@/lib/offlineDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOfflineSync() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const pendingSales = useLiveQuery(
    () => offlineDb.pendingSales.where("status").notEqual("synced").toArray(),
    [],
    [] as PendingSale[],
  );
  const pendingCount = pendingSales?.length ?? 0;

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const queue = await offlineDb.pendingSales
        .where("status")
        .anyOf(["pending_sync", "error"])
        .toArray();
      for (const sale of queue) {
        if (sale.id == null) continue;
        await offlineDb.pendingSales.update(sale.id, { status: "syncing" });
        try {
          const { data: venda, error: vErr } = await supabase
            .from("vendas")
            .insert({
              loja_id: sale.loja_id,
              total: sale.total,
              forma_pagamento: sale.forma_pagamento,
              status: "concluida",
              pagamento_status: "pago",
              coupon_code: sale.coupon_code,
              coupon_discount: sale.coupon_discount,
            })
            .select("id")
            .single();
          if (vErr || !venda) throw vErr ?? new Error("Falha ao criar venda");

          if (sale.items.length) {
            const rows = sale.items.map((i) => ({
              venda_id: venda.id,
              produto_id: i.produto_id,
              quantidade: i.quantidade,
              preco_unit: i.preco_unit,
              desconto: i.desconto,
            }));
            const { error: iErr } = await supabase.from("venda_itens").insert(rows);
            if (iErr) {
              // Trigger de estoque insuficiente bloqueou o sync. A venda já
              // ocorreu de fato (sem internet), então não basta descartar:
              // removemos a venda órfã (sem itens) e deixamos um alerta para
              // a loja revisar manualmente e decidir como tratar o estoque.
              await supabase.from("vendas").delete().eq("id", venda.id);
              await (supabase.from as any)("alertas_operacionais").insert({
                loja_id: sale.loja_id,
                tipo: "venda_offline_bloqueada_estoque",
                titulo: "Venda offline não sincronizada — estoque insuficiente",
                detalhe:
                  `Uma venda feita offline (total R$ ${sale.total.toFixed(2).replace(".", ",")}) não pôde ser sincronizada ` +
                  `porque o estoque de um dos produtos ficou insuficiente entre a venda e a sincronização. ` +
                  `A venda já ocorreu de fato — revise o estoque e registre-a manualmente. ` +
                  `Detalhe técnico: ${iErr.message}`,
                referencia_id: null,
              });
              throw iErr;
            }
          }

          // Venda offline com cupom: a venda já ocorreu de fato sem internet,
          // então não pode ser bloqueada no sync. Ainda assim, o uso precisa
          // ser contabilizado — e, se isso ultrapassar max_uses, registramos
          // um alerta para a loja revisar (ver useCoupon / increment_coupon_usage
          // para o fluxo online, que bloqueia antes de a venda ser criada).
          if (sale.coupon_code) {
            const { data: cupomRow } = await supabase
              .from("cupons")
              .select("id")
              .eq("code", sale.coupon_code)
              .eq("loja_id", sale.loja_id)
              .maybeSingle();
            if (cupomRow?.id) {
              const { data: result } = await supabase.rpc(
                "increment_coupon_usage_forcado" as any,
                { p_coupon_id: cupomRow.id },
              );
              const row = Array.isArray(result) ? result[0] : result;
              if (row?.estourou_limite) {
                await (supabase.from as any)("alertas_operacionais").insert({
                  loja_id: sale.loja_id,
                  tipo: "cupom_limite_excedido_offline",
                  titulo: `Cupom "${sale.coupon_code}" excedeu o limite de uso`,
                  detalhe:
                    "Uma venda feita offline usou este cupom depois que ele já havia atingido o limite máximo de usos. A venda foi sincronizada normalmente pois já havia ocorrido de fato.",
                  referencia_id: venda.id,
                });
              }
            }
          }

          await offlineDb.pendingSales.update(sale.id, { status: "synced" });
        } catch (e: any) {
          console.error("[offline-sync] sale failed", e);
          await offlineDb.pendingSales.update(sale.id, {
            status: "error",
            last_error: e?.message ?? "unknown",
          });
        }
      }

      // Cleanup synced rows older than 1h
      const cutoff = Date.now() - 60 * 60 * 1000;
      await offlineDb.pendingSales
        .where("status")
        .equals("synced")
        .and((s) => s.created_at < cutoff)
        .delete();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      toast.success("Conexão restabelecida — sincronizando vendas…");
      void syncNow();
    };
    const goOffline = () => {
      setOnline(false);
      toast.warning("Você está offline. As vendas serão salvas localmente.");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  // Auto-sync on mount if online and there's a queue
  useEffect(() => {
    if (online && pendingCount > 0) {
      void syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { online, syncing, pendingCount, pendingSales: pendingSales ?? [], syncNow };
}