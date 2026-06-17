import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Printer, MessageCircle, FileText } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { traduzErro } from "@/lib/errors";
import { PagamentoChips } from "@/components/recibos/PagamentoChips";
import { maskWhatsApp, maskCpf } from "@/components/recibos/masks";
import type { FormaPagamento, ReciboItem } from "@/components/recibos/types";
import { useCreateRecibo, useReciboConfig, useMarcarEnviado } from "@/hooks/recibos/useRecibos";
import { openWhatsApp } from "@/components/recibos/whatsappMessage";

interface DraftItem {
  produto: string;
  qtd: string;
  preco: string;
}

const emptyItem = (): DraftItem => ({ produto: "", qtd: "1", preco: "" });

export default function RecibosNovo() {
  const navigate = useNavigate();
  const create = useCreateRecibo();
  const marcarEnviado = useMarcarEnviado();
  const { data: config } = useReciboConfig();

  const [cliente, setCliente] = useState({ nome: "", whatsapp: "", email: "", cpf: "" });
  const [itens, setItens] = useState<DraftItem[]>([emptyItem()]);
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [desconto, setDesconto] = useState("0");
  const [recebido, setRecebido] = useState("");
  const [obs, setObs] = useState("");

  const totais = useMemo(() => {
    const linhas: ReciboItem[] = itens
      .map((i) => ({
        produto: i.produto.trim(),
        qtd: Number(i.qtd.replace(",", ".")) || 0,
        preco_unit: Number(i.preco.replace(",", ".")) || 0,
        total: 0,
      }))
      .map((i) => ({ ...i, total: Number((i.qtd * i.preco_unit).toFixed(2)) }));
    const subtotal = linhas.reduce((a, b) => a + b.total, 0);
    const desc = Number(desconto.replace(",", ".")) || 0;
    const total = Math.max(0, subtotal - desc);
    const rec = Number(recebido.replace(",", ".")) || 0;
    const troco = forma === "dinheiro" && rec > total ? rec - total : 0;
    return { linhas, subtotal, desc, total, rec, troco };
  }, [itens, desconto, recebido, forma]);

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItens((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) =>
    setItens((cur) => (cur.length === 1 ? [emptyItem()] : cur.filter((_, i) => i !== idx)));

  const podeEmitir =
    cliente.nome.trim().length > 0 && totais.linhas.some((l) => l.produto && l.total > 0);

  async function emitir(action: "whatsapp" | "imprimir" | "pdf") {
    if (!podeEmitir) {
      toast.error("Preencha cliente e ao menos 1 item válido");
      return;
    }
    try {
      const validItens = totais.linhas.filter((l) => l.produto && l.total > 0);
      const recibo = await create.mutateAsync({
        cliente_nome: cliente.nome.trim(),
        cliente_whatsapp: cliente.whatsapp.trim() || null,
        cliente_email: cliente.email.trim() || null,
        cliente_cpf: cliente.cpf.replace(/\D/g, "") || null,
        itens: validItens,
        subtotal: totais.subtotal,
        desconto: totais.desc,
        total: totais.total,
        forma_pagamento: forma,
        valor_recebido: forma === "dinheiro" && totais.rec > 0 ? totais.rec : null,
        troco: totais.troco > 0 ? totais.troco : null,
        observacao: obs.trim() || null,
      });
      toast.success(`Recibo ${recibo.numero_formatado} emitido`);
      if (action === "whatsapp" && config) {
        openWhatsApp(recibo, config);
        marcarEnviado.mutate({ id: recibo.id, canal: "whatsapp" });
        navigate(`/dashboard/recibos/${recibo.id}`);
      } else if (action === "imprimir") {
        navigate(`/dashboard/recibos/${recibo.id}?print=1`);
      } else {
        navigate(`/dashboard/recibos/${recibo.id}?print=1`);
      }
    } catch (e) {
      toast.error(traduzErro(e));
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold">Emitir Recibo</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados e envie ao cliente.</p>
        </header>

        {/* Cliente */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Cliente</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cli-nome">Nome*</Label>
              <Input id="cli-nome" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cli-wa">WhatsApp</Label>
              <Input
                id="cli-wa"
                placeholder="(11) 98765-4321"
                value={cliente.whatsapp}
                onChange={(e) => setCliente({ ...cliente, whatsapp: maskWhatsApp(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="cli-email">E-mail (opcional)</Label>
              <Input id="cli-email" type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cli-cpf">CPF (opcional)</Label>
              <Input
                id="cli-cpf"
                placeholder="000.000.000-00"
                value={cliente.cpf}
                onChange={(e) => setCliente({ ...cliente, cpf: maskCpf(e.target.value) })}
              />
            </div>
          </div>
        </Card>

        {/* Itens */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Itens</h2>
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_90px_120px_120px_40px] gap-2 text-xs text-muted-foreground font-medium px-1">
              <span>Produto</span>
              <span>Qtd</span>
              <span>Preço unit.</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {itens.map((it, idx) => {
              const linha = totais.linhas[idx];
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_120px_120px_40px] gap-2 items-center">
                  <Input value={it.produto} placeholder="Nome do produto" onChange={(e) => updateItem(idx, { produto: e.target.value })} />
                  <Input inputMode="decimal" value={it.qtd} onChange={(e) => updateItem(idx, { qtd: e.target.value })} />
                  <Input inputMode="decimal" placeholder="0,00" value={it.preco} onChange={(e) => updateItem(idx, { preco: e.target.value })} />
                  <div className="text-right font-mono text-sm font-medium">{brl(linha?.total ?? 0)}</div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} aria-label="Remover item">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setItens((c) => [...c, emptyItem()])}>
            <Plus className="h-4 w-4 mr-1.5" /> Adicionar item
          </Button>
        </Card>

        {/* Pagamento */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Pagamento</h2>
          <PagamentoChips value={forma} onChange={setForma} />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="desc">Desconto (R$)</Label>
              <Input id="desc" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </div>
            {forma === "dinheiro" && (
              <div>
                <Label htmlFor="rec">Valor recebido (R$)</Label>
                <Input id="rec" inputMode="decimal" value={recebido} onChange={(e) => setRecebido(e.target.value)} />
              </div>
            )}
          </div>
        </Card>

        {/* Observação */}
        <Card className="p-5 space-y-2">
          <Label htmlFor="obs" className="font-semibold">Observação para o cliente</Label>
          <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
        </Card>

        {/* Totais */}
        <Card className="p-5">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{brl(totais.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span className="font-mono">− {brl(totais.desc)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 mt-2 border-t">
              <span className="font-bold uppercase tracking-wider text-sm">Total</span>
              <span className="font-display text-2xl font-bold">{brl(totais.total)}</span>
            </div>
            {totais.troco > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Troco</span>
                <span className="font-mono">{brl(totais.troco)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Ações */}
        <div className="grid sm:grid-cols-3 gap-2">
          <Button
            disabled={!podeEmitir || create.isPending}
            onClick={() => emitir("whatsapp")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Emitir e enviar pelo WhatsApp
          </Button>
          <Button variant="outline" disabled={!podeEmitir || create.isPending} onClick={() => emitir("imprimir")}>
            <Printer className="h-4 w-4 mr-2" />
            Emitir e imprimir
          </Button>
          <Button variant="outline" disabled={!podeEmitir || create.isPending} onClick={() => emitir("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Emitir PDF
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}