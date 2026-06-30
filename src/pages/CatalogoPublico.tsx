import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { brl } from "@/lib/format";
import { Search, Package, MessageCircle, Store, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCatalogCart } from "@/hooks/useCatalogCart";
import { QuantitySelector } from "@/components/catalogo/QuantitySelector";
import { CartDrawer } from "@/components/catalogo/CartDrawer";
import { CheckoutForm, type CheckoutData } from "@/components/catalogo/CheckoutForm";
import { buildOrderWhatsAppMessage } from "@/lib/buildOrderWhatsAppMessage";
import { whatsappDigits } from "@/components/recibos/masks";

type ProdutoPub = {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  preco_venda: number;
  fotos: string[] | null;
  descricao: string | null;
  estoque: { quantidade: number }[];
};

type Loja = {
  id: string;
  nome: string;
  logo_url: string | null;
  telefone: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  display_mode?: "list" | "grid" | "instaview" | null;
  accent_color?: string | null;
  out_of_stock_behavior?: "hide" | "show_unavailable" | "show_normal" | null;
  banner_enabled?: boolean | null;
  banner_image_url?: string | null;
  banner_link_url?: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const CatalogoPublico = () => {
  const { lojaId } = useParams();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [produtos, setProdutos] = useState<ProdutoPub[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<ProdutoPub | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cart = useCatalogCart(lojaId);

  useEffect(() => {
    if (!lojaId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/catalogo-publico?loja_id=${lojaId}`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar catálogo");
        setLoja(json.loja);
        setProdutos(json.produtos);
        document.title = `${json.loja.nome} — Catálogo`;
      } catch (e: any) {
        setErro(e.message ?? "Erro ao carregar catálogo");
      } finally {
        setLoading(false);
      }
    })();
  }, [lojaId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const oos = loja?.out_of_stock_behavior ?? "show_unavailable";
    let base = produtos;
    if (oos === "hide") {
      base = base.filter((p) => {
        const qtd = p.estoque?.[0]?.quantidade;
        return qtd === undefined || qtd === null || qtd > 0;
      });
    }
    if (!s) return base;
    return base.filter(
      (p) =>
        p.nome.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.categoria?.toLowerCase().includes(s),
    );
  }, [produtos, q, loja?.out_of_stock_behavior]);

  const whatsappLink = (texto: string) => {
    if (!loja?.telefone) return null;
    const tel = loja.telefone.replace(/\D/g, "");
    return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
  };

  const setQty = (id: string, v: number) =>
    setQtyByProduct((prev) => ({ ...prev, [id]: v }));

  const handleAdd = (p: ProdutoPub) => {
    const estoque = p.estoque?.[0]?.quantidade ?? null;
    const qty = qtyByProduct[p.id] ?? 1;
    cart.addItem(
      {
        id: p.id,
        nome: p.nome,
        preco_venda: p.preco_venda,
        foto: p.fotos?.[0] ?? null,
        estoque,
      },
      qty,
    );
    setQty(p.id, 1);
    toast.success("Produto adicionado!");
  };

  const handleConfirmCheckout = (data: CheckoutData) => {
    if (!loja) return;
    const tel = whatsappDigits(loja.telefone);
    if (!tel) {
      toast.error("Esta loja não tem WhatsApp configurado.");
      return;
    }
    const msg = buildOrderWhatsAppMessage(loja.nome, cart.items, cart.totalValue, data);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
    cart.clear();
    setCheckoutOpen(false);
    setCartOpen(false);
    toast.success("Pedido enviado pelo WhatsApp!");
  };

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h1 className="font-display text-xl font-bold">Catálogo indisponível</h1>
          <p className="text-muted-foreground text-sm mt-2">{erro}</p>
        </Card>
      </div>
    );
  }

  const cores = {
    "--brand-primary": loja?.cor_primaria || "#3F3C7A",
    "--brand-secondary": loja?.cor_secundaria || "#D8A14A",
    "--catalog-accent-color": loja?.accent_color || loja?.cor_primaria || "#16A34A",
  } as React.CSSProperties;

  const accent = loja?.accent_color || loja?.cor_primaria || "#16A34A";
  const mode = loja?.display_mode || "grid";
  const oosBehavior = loja?.out_of_stock_behavior || "show_unavailable";

  return (
    <div className="min-h-screen bg-background" style={cores}>
      <header
        className="border-b sticky top-0 z-10 text-white"
        style={{ background: "var(--brand-primary)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          {loja?.logo_url ? (
            <img src={loja.logo_url} alt={loja.nome} className="h-10 w-10 rounded-lg object-cover bg-white/10" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center text-white">
              <Store className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold truncate text-white">
              {loading ? <Skeleton className="h-5 w-40" /> : loja?.nome}
            </h1>
            <p className="mono text-[10px] uppercase tracking-widest text-white/70">
              Catálogo
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative h-11 w-11 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center text-white"
            aria-label="Abrir carrinho"
          >
            <ShoppingCart className="h-5 w-5" />
            {cart.totalItems > 0 && (
              <span
                className="num absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center text-white shadow-soft-md"
                style={{ background: "var(--brand-secondary)" }}
              >
                {cart.totalItems}
              </span>
            )}
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produtos…"
              className="pl-9 h-11 text-base bg-white text-foreground"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-0 overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
            <p className="mt-3 text-muted-foreground">Nenhum produto encontrado</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((p) => {
              const foto = p.fotos?.[0];
              const estoqueQtd = p.estoque?.[0]?.quantidade ?? null;
              const semEstoque = estoqueQtd !== null && estoqueQtd <= 0;
              const qty = qtyByProduct[p.id] ?? 1;
              return (
                <Card
                  key={p.id}
                  className="p-0 overflow-hidden hover:shadow-soft-md transition-shadow flex flex-col"
                >
                  <div
                    className="relative aspect-square bg-muted cursor-pointer"
                    onClick={() => setPreview(p)}
                  >
                    {foto ? (
                      <img src={foto} alt={p.nome} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-10 w-10 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    {semEstoque && (
                      <Badge className="absolute top-2 left-2 bg-destructive/10 text-destructive border-0 mono text-[10px]">
                        Sem estoque
                      </Badge>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3
                      className="font-display font-semibold leading-tight line-clamp-2 cursor-pointer"
                      onClick={() => setPreview(p)}
                    >
                      {p.nome}
                    </h3>
                    {p.categoria && (
                      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                        {p.categoria}
                      </div>
                    )}
                    <div
                      className="num text-xl font-bold mt-2"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      {brl(p.preco_venda)}
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {semEstoque ? (
                        <Button disabled className="w-full h-11">
                          Esgotado
                        </Button>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <QuantitySelector
                              value={qty}
                              onChange={(v) => setQty(p.id, v)}
                              max={estoqueQtd}
                              size="sm"
                            />
                            {estoqueQtd !== null && qty >= estoqueQtd && (
                              <span className="mono text-[10px] text-muted-foreground">
                                Máx: {estoqueQtd}
                              </span>
                            )}
                          </div>
                          <Button
                            className="w-full h-11 text-white hover:opacity-90"
                            style={{ background: "var(--brand-primary)" }}
                            onClick={() => handleAdd(p)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Adicionar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <ResponsiveModal
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.nome}
        contentClassName="max-w-lg"
      >
        {preview && (
          <div className="space-y-4 pb-2">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {preview.fotos?.[0] ? (
                <img src={preview.fotos[0]} alt={preview.nome} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground opacity-30" />
              )}
            </div>
            {preview.categoria && (
              <Badge variant="outline" className="mono text-[10px]">{preview.categoria}</Badge>
            )}
            <div
              className="num text-3xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              {brl(preview.preco_venda)}
            </div>
            {preview.descricao && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{preview.descricao}</p>
            )}
            {loja?.telefone && (
              <a
                href={
                  whatsappLink(`Olá! Tenho interesse no produto: ${preview.nome} (${brl(preview.preco_venda)})`) ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className="w-full h-12 text-white hover:opacity-90"
                  style={{ background: "var(--brand-secondary)" }}
                >
                  <MessageCircle className="h-4 w-4 mr-1" /> Tenho interesse no WhatsApp
                </Button>
              </a>
            )}
          </div>
        )}
      </ResponsiveModal>

      <footer className="py-8 text-center mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Catálogo digital
      </footer>

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cart.items}
        total={cart.totalValue}
        onUpdateQty={cart.updateQty}
        onRemove={cart.removeItem}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
        brandColor={loja?.cor_primaria || "#3F3C7A"}
      />

      <CheckoutForm
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onConfirm={handleConfirmCheckout}
        brandColor={loja?.cor_secundaria || loja?.cor_primaria || "#D8A14A"}
      />
    </div>
  );
};

export default CatalogoPublico;