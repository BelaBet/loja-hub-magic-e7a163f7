import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { BarcodeInput, type BarcodeInputRef } from "@/components/pdv/BarcodeInput";
import { ProductCard } from "@/components/pdv/ProductCard";
import { AddProductForm } from "@/components/pdv/AddProductForm";
import { CartPanel } from "@/components/pdv/CartPanel";
import { ScanHistory } from "@/components/pdv/ScanHistory";
import { usePDVCart } from "@/components/pdv/usePDVCart";
import { ReceiptDialog, type ReceiptData } from "@/components/pdv/ReceiptDialog";
import type { PDVPayment, PDVProduct, ScanEvent } from "@/components/pdv/types";
import { useCoupon } from "@/hooks/useCoupon";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { OfflineBanner, ConnectionDot } from "@/components/OfflineBanner";
import { cacheProducts, findProductByEan, queuePendingSale } from "@/lib/offlineDb";
import { traduzErro } from "@/lib/errors";

type UIState =
  | { view: "idle" }
  | { view: "found"; product: PDVProduct }
  | { view: "not_found"; ean: string }
  | { view: "add_form"; ean: string };

export default function PDV() {
  const { lojaAtivaId, lojaAtiva } = useLoja();
  const cart = usePDVCart();
  const coupon = useCoupon();
  const { online, syncing, pendingCount, syncNow } = useOfflineSync();
  const [ui, setUi] = useState<UIState>({ view: "idle" });
  const [scanLoading, setScanLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ScanEvent[]>([]);
  const [payment, setPayment] = useState<PDVPayment>("dinheiro");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const barcodeRef = useRef<BarcodeInputRef>(null);

  // Sync product catalog to IndexedDB whenever we're online & have a loja.
  useEffect(() => {
    if (!online || !lojaAtivaId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, ean, nome, preco_venda, categoria, unidade_medida, fotos, estoque(quantidade)")
        .eq("loja_id", lojaAtivaId)
        .eq("ativo", true);
      if (cancelled || error || !data) return;
      const rows = data.map((d: any) => ({
        id: d.id,
        loja_id: lojaAtivaId,
        ean: d.ean,
        nome: d.nome,
        preco_venda: Number(d.preco_venda),
        categoria: d.categoria,
        unidade_medida: d.unidade_medida,
        fotos: d.fotos,
        estoque_qtd: Array.isArray(d.estoque)
          ? d.estoque.reduce((s: number, e: any) => s + Number(e.quantidade ?? 0), 0)
          : 0,
        synced_at: Date.now(),
      }));
      await cacheProducts(lojaAtivaId, rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, lojaAtivaId]);

  const fetchProductByEan = async (ean: string): Promise<PDVProduct | null> => {
    // Offline first: if no network, only check the local cache.
    if (!online && lojaAtivaId) {
      const local = await findProductByEan(lojaAtivaId, ean);
      if (!local) return null;
      return {
        id: local.id,
        ean: local.ean,
        nome: local.nome,
        preco_venda: local.preco_venda,
        categoria: local.categoria,
        unidade_medida: local.unidade_medida,
        fotos: local.fotos,
        estoque_qtd: local.estoque_qtd,
      };
    }
    const { data, error } = await supabase
      .from("produtos")
      .select("id, ean, nome, preco_venda, categoria, unidade_medida, fotos, estoque(quantidade)")
      .eq("ean", ean)
      .eq("ativo", true)
      .maybeSingle();
    if (error || !data) {
      // Network/db error — fall back to cache
      if (lojaAtivaId) {
        const local = await findProductByEan(lojaAtivaId, ean);
        if (local) {
          return {
            id: local.id,
            ean: local.ean,
            nome: local.nome,
            preco_venda: local.preco_venda,
            categoria: local.categoria,
            unidade_medida: local.unidade_medida,
            fotos: local.fotos,
            estoque_qtd: local.estoque_qtd,
          };
        }
      }
      if (error) console.error("[pdv] lookup:", error.message);
      return null;
    }
    if (!data) {
      console.error("[pdv] lookup:", error.message);
      return null;
    }
    const estoqueQtd = Array.isArray((data as any).estoque)
      ? (data as any).estoque.reduce((s: number, e: any) => s + Number(e.quantidade ?? 0), 0)
      : 0;
    return {
      id: data.id,
      ean: data.ean,
      nome: data.nome,
      preco_venda: Number(data.preco_venda),
      categoria: data.categoria,
      unidade_medida: data.unidade_medida,
      fotos: data.fotos,
      estoque_qtd: estoqueQtd,
    };
  };

  const handleScan = useCallback(async (code: string) => {
    if (scanLoading) return;
    setScanLoading(true);
    const product = await fetchProductByEan(code);
    const event: ScanEvent = {
      code,
      timestamp: new Date(),
      found: !!product,
      product_name: product?.nome,
    };
    setHistory((h) => [event, ...h].slice(0, 20));
    barcodeRef.current?.feedback(!!product);
    if (product) {
      setUi({ view: "found", product });
      toast.success(`${product.nome} encontrado`);
    } else {
      setUi({ view: "not_found", ean: code });
      toast.warning(`Código ${code} não cadastrado`);
    }
    setScanLoading(false);
  }, [scanLoading]);

  useBarcodeScanner({ onScan: handleScan, enabled: !scanLoading });

  const handleAdd = (product: PDVProduct, qty: number) => {
    cart.addItem(product, qty);
    setUi({ view: "idle" });
    toast.success(`${qty}× ${product.nome} adicionado`);
    barcodeRef.current?.focus();
  };

  const handleProductSaved = (product: PDVProduct) => {
    setUi({ view: "found", product });
    toast.success("Produto cadastrado!");
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0 || !lojaAtivaId) return;
    setSaving(true);
    const discount = coupon.appliedCoupon?.discount_amount ?? 0;
    const finalTotal = Math.max(0, cart.total - discount);

    // OFFLINE PATH — queue the sale in IndexedDB and surface the receipt.
    if (!online) {
      try {
        const localUuid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await queuePendingSale({
          local_uuid: localUuid,
          loja_id: lojaAtivaId,
          total: finalTotal,
          forma_pagamento: payment,
          coupon_code: coupon.appliedCoupon?.coupon.code ?? null,
          coupon_discount: discount,
          items: cart.items.map((i) => ({
            produto_id: i.product.id,
            quantidade: i.qty,
            preco_unit: i.unit_price,
            desconto: 0,
          })),
        });
        toast.success("Venda salva offline — será sincronizada ao reconectar");
        setReceipt({
          venda_id: localUuid,
          items: cart.items,
          total: finalTotal,
          payment,
          date: new Date(),
          loja_nome: lojaAtiva?.loja?.nome,
        });
        setReceiptOpen(true);
        cart.clear();
        coupon.removeCoupon();
        setUi({ view: "idle" });
      } catch (e: any) {
        console.error(e);
        toast.error("Falha ao salvar venda offline: " + (e?.message ?? ""));
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      // Confirma o uso do cupom ANTES de criar a venda (operação atômica no
      // banco). Se o cupom esgotou entre a aplicação no carrinho e o fechamento
      // (ex.: outro caixa usou o último uso disponível), a venda é bloqueada
      // em vez de sair com desconto aplicado sobre um cupom já esgotado.
      if (coupon.appliedCoupon) {
        const ok = await coupon.useCouponUsage(coupon.appliedCoupon.coupon.id);
        if (!ok) {
          toast.error("Este cupom acabou de esgotar. Remova-o para continuar.");
          setSaving(false);
          return;
        }
      }

      const { data: venda, error: vErr } = await supabase
        .from("vendas")
        .insert({
          loja_id: lojaAtivaId,
          total: finalTotal,
          forma_pagamento: payment,
          status: "concluida",
          pagamento_status: "pago",
          coupon_code: coupon.appliedCoupon?.coupon.code ?? null,
          coupon_discount: discount,
        })
        .select("id")
        .single();
      if (vErr || !venda) throw vErr ?? new Error("Falha ao criar venda");

      const rows = cart.items.map((i) => ({
        venda_id: venda.id,
        produto_id: i.product.id,
        quantidade: i.qty,
        preco_unit: i.unit_price,
        desconto: 0,
      }));
      const { error: iErr } = await supabase.from("venda_itens").insert(rows);
      if (iErr) {
        // Reverte a venda já criada para não deixar registro "concluída" sem itens
        // (ex.: bloqueio por estoque insuficiente em um dos produtos do carrinho).
        await supabase.from("vendas").delete().eq("id", venda.id);
        throw iErr;
      }

      toast.success("Venda registrada!");
      setReceipt({
        venda_id: venda.id,
        items: cart.items,
        total: finalTotal,
        payment,
        date: new Date(),
        loja_nome: lojaAtiva?.loja?.nome,
      });
      setReceiptOpen(true);
      cart.clear();
      coupon.removeCoupon();
      setUi({ view: "idle" });
    } catch (e: any) {
      console.error(e);
      toast.error(traduzErro(e, "Erro ao registrar venda. Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Caixa</span>
              <h1 className="font-display text-fluid-3xl font-bold tracking-tight mt-0.5">PDV</h1>
            </div>
            <ConnectionDot online={online} />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Aponte o leitor USB/Bluetooth para adicionar produtos ao carrinho
          </p>
        </div>

        <OfflineBanner
          online={online}
          pendingCount={pendingCount}
          syncing={syncing}
          onSync={syncNow}
          className="mb-4"
        />

        {/* Layout: mobile = coluna única (carrinho abaixo); lg = side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
          {/* Coluna esquerda — scanner + produto encontrado */}
          <div className="space-y-3 sm:space-y-4">
            <div className="rounded-xl border bg-card p-3 sm:p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leitura de código de barras
              </p>
              <BarcodeInput ref={barcodeRef} onScan={handleScan} loading={scanLoading} />
              <p className="text-xs text-muted-foreground">
                Leitores USB/Bluetooth enviam Enter automaticamente.
              </p>
            </div>

            {ui.view === "found" && <ProductCard product={ui.product} onAdd={handleAdd} />}

            {ui.view === "not_found" && (
              <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-destructive min-w-0 truncate">
                  Código <span className="font-mono font-medium">{ui.ean}</span> não encontrado.
                </p>
                <button
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                  onClick={() => setUi({ view: "add_form", ean: ui.ean })}
                >
                  + Cadastrar
                </button>
              </div>
            )}

            {ui.view === "add_form" && (
              <AddProductForm
                ean={ui.ean}
                onSaved={handleProductSaved}
                onCancel={() => setUi({ view: "idle" })}
              />
            )}

            {/* Histórico apenas em telas maiores para não poluir mobile */}
            <div className="hidden sm:block">
              <ScanHistory events={history} />
            </div>
          </div>

          {/* Coluna direita — carrinho: sticky em lg, normal em mobile */}
          <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)] order-first lg:order-last">
            <CartPanel
              items={cart.items}
              total={cart.total}
              payment={payment}
              onPaymentChange={setPayment}
              onUpdateQty={cart.updateQty}
              onRemove={cart.removeItem}
              onClear={cart.clear}
              onCheckout={handleCheckout}
              loading={saving}
              appliedCoupon={coupon.appliedCoupon}
              couponLoading={coupon.loading}
              couponError={coupon.error}
              onApplyCoupon={async (code) => {
                const r = await coupon.validateAndApply(code, cart.total);
                if (r.success && r.discount_amount != null) {
                  toast.success(`Cupom aplicado — economia de ${r.discount_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
                } else if (r.error) {
                  toast.error(r.error);
                }
              }}
              onRemoveCoupon={coupon.removeCoupon}
            />
          </div>
        </div>
      </div>
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={(o) => {
          setReceiptOpen(o);
          if (!o) barcodeRef.current?.focus();
        }}
        data={receipt}
      />
    </AppLayout>
  );
}