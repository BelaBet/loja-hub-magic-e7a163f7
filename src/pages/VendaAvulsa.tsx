import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Zap } from "lucide-react";
import { traduzErro } from "@/lib/errors";
import type { PDVPayment } from "@/components/pdv/types";

export default function VendaAvulsa() {
  const navigate = useNavigate();
  const { lojaAtivaId } = useLoja();
  const [valorStr, setValorStr] = useState("");
  const [descricao, setDescricao] = useState("");
  const [payment, setPayment] = useState<PDVPayment>("dinheiro");
  const [saving, setSaving] = useState(false);

  const formatValor = (s: string) => {
    const digits = s.replace(/\D/g, "");
    const cents = Number(digits) || 0;
    return (cents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const parseValor = (s: string) => {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : NaN;
  };
  const valor = parseValor(valorStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lojaAtivaId) return;
    if (!isFinite(valor) || valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    setSaving(true);
    try {
      const { data: venda, error } = await supabase
        .from("vendas")
        .insert({
          loja_id: lojaAtivaId,
          total: valor,
          forma_pagamento: payment,
          status: "concluida",
          pagamento_status: "pago",
          observacoes: descricao || null,
        })
        .select("id")
        .single();
      if (error || !venda) throw error ?? new Error("Falha ao registrar venda");
      toast.success("Venda avulsa registrada!");
      navigate(`/vendas/${venda.id}/recibo`);
    } catch (err: any) {
      console.error(err);
      toast.error(traduzErro(err, "Erro ao registrar venda avulsa"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold">Venda avulsa</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Registre uma venda rápida apenas pelo valor — sem produto no catálogo, sem baixa de estoque.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={valorStr}
              onChange={(e) => setValorStr(formatValor(e.target.value))}
              className="h-12 text-xl font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              id="descricao"
              placeholder="Ex.: Serviço de entrega, taxa, ajuste…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as PDVPayment)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !isFinite(valor) || valor <= 0}>
              {saving ? "Salvando…" : "Registrar venda"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}