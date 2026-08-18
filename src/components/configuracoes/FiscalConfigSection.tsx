import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Loader2, Save, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Status = {
  configurado: boolean;
  last4: string | null;
  ambiente: "homologacao" | "producao";
  valido: boolean | null;
  atualizado_em: string | null;
};

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "simples_excesso", label: "Simples Nacional (excesso de sublimite)" },
  { value: "regime_normal", label: "Regime Normal" },
];

/**
 * Configuração fiscal da loja: token Focus NFe (usado pra emitir NFC-e/NF-e)
 * e ambiente (homologação = testes, sem valor fiscal / produção = valendo
 * de verdade). Visível pra admin/gerente da própria loja.
 */
export function FiscalConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">("homologacao");
  const [regime, setRegime] = useState("simples_nacional");

  const carregarCredencial = async () => {
    const { data, error } = await supabase.functions.invoke("loja-fiscal-credenciais", { method: "GET" });
    if (!error) {
      setStatus(data as Status);
      if (data?.ambiente) setAmbiente(data.ambiente);
    }
  };

  const carregarConfigFiscal = async () => {
    const { data: lojaId } = await supabase.rpc("get_loja_id");
    if (!lojaId) return;
    const { data } = await supabase.from("lojas").select("config_fiscal").eq("id", lojaId).maybeSingle();
    const cf = (data as any)?.config_fiscal;
    if (cf?.regime_tributario) setRegime(cf.regime_tributario);
    if (cf?.ambiente) setAmbiente(cf.ambiente);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([carregarCredencial(), carregarConfigFiscal()]);
      setLoading(false);
    })();
  }, []);

  const extrairErro = async (error: unknown, data: unknown): Promise<string> => {
    const fromData = (data as any)?.error;
    if (fromData) return fromData;
    const ctx = (error as any)?.context;
    if (ctx?.body) {
      try {
        const parsed = JSON.parse(await new Response(ctx.body).text());
        if (parsed?.error) return parsed.error;
      } catch { /* fallback abaixo */ }
    }
    return "Não foi possível salvar. Tente novamente.";
  };

  const salvarAmbienteRegime = async (novoAmbiente: string, novoRegime: string) => {
    const { data: lojaId } = await supabase.rpc("get_loja_id");
    if (!lojaId) return;
    const { data: atual } = await supabase.from("lojas").select("config_fiscal").eq("id", lojaId).maybeSingle();
    const cf = { ...((atual as any)?.config_fiscal ?? {}), ambiente: novoAmbiente, regime_tributario: novoRegime };
    await supabase.from("lojas").update({ config_fiscal: cf } as any).eq("id", lojaId);
  };

  const salvarToken = async () => {
    const trimmed = token.trim();
    if (trimmed.length < 8) {
      toast.error("Cole o token completo do Focus NFe");
      return;
    }
    setSaving(true);
    try {
      await salvarAmbienteRegime(ambiente, regime);
      const { data, error } = await supabase.functions.invoke("loja-fiscal-credenciais", {
        body: { focus_nfe_token: trimmed },
      });
      if (error || (data as any)?.error) throw new Error(await extrairErro(error, data));
      setToken("");
      toast.success(`Token Focus NFe validado e salvo (ambiente: ${ambiente === "producao" ? "produção" : "homologação"})`);
      await carregarCredencial();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removerToken = async () => {
    setSaving(true);
    try {
      const { error, data } = await supabase.functions.invoke("loja-fiscal-credenciais", { method: "DELETE" });
      if (error || (data as any)?.error) throw new Error(await extrairErro(error, data));
      toast.success("Token removido");
      await carregarCredencial();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Configuração fiscal (NF-e / NFC-e)</h2>
        </div>
        {loading ? null : status?.configurado ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary">Configurado</Badge>
        ) : (
          <Badge variant="outline">Não configurado</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Necessário pra emitir notas fiscais das vendas. Requer uma conta no{" "}
        <a href="https://focusnfe.com.br" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          Focus NFe
        </a>{" "}
        com a empresa (CNPJ desta loja) já cadastrada lá.
      </p>

      {ambiente === "homologacao" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Ambiente de <strong>homologação</strong> (testes) — as notas emitidas aqui não têm valor fiscal.
            Troque para "Produção" só quando estiver pronta para emitir notas de verdade.
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          {status?.configurado && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono">•••• {status.last4}</code>
                {status.valido === true ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : status.valido === false ? (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <XCircle className="h-3 w-3" /> Problema
                  </Badge>
                ) : null}
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 -ml-2" onClick={removerToken} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
              </Button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={ambiente} onValueChange={(v: "homologacao" | "producao") => setAmbiente(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Regime tributário</Label>
              <Select value={regime} onValueChange={setRegime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIMES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="focus-token">{status?.configurado ? "Trocar token" : "Token da API Focus NFe"}</Label>
            <Input
              id="focus-token"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cole o token aqui"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mono"
            />
            <p className="text-xs text-muted-foreground">
              O token é conferido direto no Focus NFe antes de salvar (no ambiente selecionado acima).
            </p>
          </div>

          <Button onClick={salvarToken} disabled={saving || !token}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar configuração fiscal
          </Button>
        </>
      )}
    </Card>
  );
}
