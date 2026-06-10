import { useCallback, useRef, useState } from "react";
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

type UIState =
  | { view: "idle" }
  | { view: "found"; product: PDVProduct }
  | { view: "not_found"; ean: string }
  | { view: "add_form"; ean: string };

export default function PDV() {
  const { lojaAtivaId, lojaAtiva } = useLoja();
  const cart = usePDVCart();
  const coupon = useCoupon();
  const [ui, setUi] = useState<UIState>({ view: "idle" });
  const [scanLoading, setScanLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ScanEvent[]>([]);
  const [payment, setPayment] = useState<PDVPayment>("dinheiro");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const barcodeRef = useRef<BarcodeInputRef>(null);

  const fetchProductByEan = async (ean: string): Promise<PDVProduct | null> => {
    const { data, error } = await supabase
      .from("produtos")
      .select("id, ean, nome, preco_venda, categoria, unidade_medida, fotos, estoque(quantidade)")
      .eq("ean", ean)
      .eq("ativo", true)
      .maybeSingle();
    if (error) {
      console.error("[pdv] lookup:", error.message);
      return null;
    }
    if (!data) return null;
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
    try {
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
      if (iErr) throw iErr;

      if (coupon.appliedCoupon) {
        await coupon.useCouponUsage(coupon.appliedCoupon.coupon.id);
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
      toast.error("Erro ao registrar venda: " + (e?.message ?? "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">PDV — Leitor de código de barras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aponte o leitor USB/Bluetooth para adicionar produtos ao carrinho
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-3">
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
              <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-destructive">
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

            <ScanHistory events={history} />
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)]">
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