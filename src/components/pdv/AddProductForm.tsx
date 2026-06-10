import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import type { PDVProduct } from "./types";

interface Props {
  ean: string;
  onSaved: (product: PDVProduct) => void;
  onCancel: () => void;
}

export function AddProductForm({ ean, onSaved, onCancel }: Props) {
  const { lojaAtivaId } = useLoja();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [estoqueIni, setEstoqueIni] = useState("0");
  const [categoria, setCategoria] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!nome.trim() || !preco) {
      setError("Informe pelo menos nome e preço.");
      return;
    }
    if (!lojaAtivaId) {
      setError("Nenhuma loja ativa.");
      return;
    }
    setLoading(true);
    setError("");

    const precoNum = parseFloat(preco.replace(",", "."));
    const estoqueNum = parseFloat(estoqueIni.replace(",", ".")) || 0;

    const { data: prod, error: pErr } = await supabase
      .from("produtos")
      .insert({
        loja_id: lojaAtivaId,
        nome: nome.trim(),
        ean,
        preco_venda: precoNum,
        categoria: categoria.trim() || null,
        ativo: true,
      })
      .select("id, ean, nome, preco_venda, categoria, unidade_medida, fotos")
      .single();

    if (pErr || !prod) {
      setLoading(false);
      setError(pErr?.message ?? "Erro ao salvar produto.");
      return;
    }

    if (estoqueNum > 0) {
      const { error: eErr } = await supabase.from("estoque").insert({
        loja_id: lojaAtivaId,
        produto_id: prod.id,
        quantidade: estoqueNum,
      });
      if (eErr) toast.warning("Produto criado, mas falhou ao registrar estoque: " + eErr.message);
    }

    setLoading(false);
    onSaved({
      id: prod.id,
      ean: prod.ean,
      nome: prod.nome,
      preco_venda: Number(prod.preco_venda),
      categoria: prod.categoria,
      unidade_medida: prod.unidade_medida,
      fotos: prod.fotos,
      estoque_qtd: estoqueNum,
    });
  };

  return (
    <div className="rounded-xl border border-dashed bg-muted/40 p-4 space-y-3 animate-in fade-in duration-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cadastrar produto — <span className="font-mono">{ean}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="apf-nome" className="text-xs">Nome do produto *</Label>
          <Input id="apf-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Coca-Cola 350ml" autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="apf-preco" className="text-xs">Preço (R$) *</Label>
          <Input id="apf-preco" type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="apf-est" className="text-xs">Estoque inicial</Label>
          <Input id="apf-est" type="number" min="0" value={estoqueIni} onChange={(e) => setEstoqueIni(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="apf-cat" className="text-xs">Categoria</Label>
          <Input id="apf-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Bebidas" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={loading} size="sm">
          <Save className="w-3 h-3 mr-1" />
          {loading ? "Salvando…" : "Salvar produto"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}