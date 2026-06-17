import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { traduzErro } from "@/lib/errors";
import { TemplateSeletor } from "@/components/recibos/TemplateSeletor";
import type { ReciboConfig } from "@/components/recibos/types";
import { useReciboConfig, useUpdateReciboConfig } from "@/hooks/recibos/useRecibos";

const VARIAVEIS = [
  { k: "{nome}", d: "Nome do cliente" },
  { k: "{numero}", d: "Número do recibo" },
  { k: "{total}", d: "Valor total formatado" },
  { k: "{forma}", d: "Forma de pagamento" },
  { k: "{link}", d: "Link público do recibo" },
];

const TOGGLES: { key: keyof ReciboConfig; label: string }[] = [
  { key: "mostrar_logo", label: "Mostrar logo da loja" },
  { key: "mostrar_endereco", label: "Mostrar endereço" },
  { key: "mostrar_cnpj", label: "Mostrar CNPJ" },
  { key: "mostrar_cpf_cliente", label: "Mostrar CPF do cliente" },
  { key: "mostrar_troco", label: "Mostrar troco" },
  { key: "envio_automatico_whatsapp", label: "Envio automático por WhatsApp" },
];

export default function RecibosTemplates() {
  const { data: config, isLoading } = useReciboConfig();
  const update = useUpdateReciboConfig();
  const [form, setForm] = useState<ReciboConfig | null>(null);

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  if (isLoading || !form) {
    return (
      <AppLayout>
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </AppLayout>
    );
  }

  const set = <K extends keyof ReciboConfig>(key: K, v: ReciboConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: v } : f));

  async function salvar() {
    if (!form) return;
    try {
      await update.mutateAsync(form);
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(traduzErro(e));
    }
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="sticky top-14 z-10 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Templates de Recibo</h1>
            <p className="text-sm text-muted-foreground">Personalize a aparência e o envio.</p>
          </div>
          <Button onClick={salvar} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Salvar
          </Button>
        </div>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Template ativo</h2>
          <TemplateSeletor value={form.template_ativo} onChange={(v) => set("template_ativo", v)} />
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Informações da loja</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome da loja</Label>
              <Input value={form.loja_nome_exibicao ?? ""} onChange={(e) => set("loja_nome_exibicao", e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.loja_cnpj ?? ""} onChange={(e) => set("loja_cnpj", e.target.value)} />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.loja_endereco ?? ""} onChange={(e) => set("loja_endereco", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.loja_telefone ?? ""} onChange={(e) => set("loja_telefone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>URL do logo</Label>
              <Input value={form.loja_logo_url ?? ""} onChange={(e) => set("loja_logo_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Label>Mensagem de rodapé</Label>
              <Input value={form.mensagem_rodape} onChange={(e) => set("mensagem_rodape", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Exibição no recibo</h2>
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between py-1.5">
              <Label className="font-normal">{t.label}</Label>
              <Switch
                checked={form[t.key] as boolean}
                onCheckedChange={(v) => set(t.key, v as never)}
              />
            </div>
          ))}
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Mensagem WhatsApp</h2>
          <Textarea
            rows={5}
            value={form.template_whatsapp}
            onChange={(e) => set("template_whatsapp", e.target.value)}
          />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Variáveis disponíveis:</p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {VARIAVEIS.map((v) => (
                <li key={v.k}>
                  <code className="font-mono text-foreground">{v.k}</code> — {v.d}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}