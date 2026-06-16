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
            if (iErr) throw iErr;
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