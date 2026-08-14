import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Landmark, Loader2, Save, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Status = {
  configurado: boolean;
  recipient_id: string | null;
  origem: "banco" | "ambiente" | "fallback" | null;
  valida: boolean | null;
  nome: string | null;
  status_recipient: string | null;
  diagnostico: string | null;
  atualizado_em: string | null;
};

const ORIGEM_LABEL: Record<string, string> = {
  banco: "salvo aqui",
  ambiente: "definido pela plataforma (env)",
  fallback: "valor padrão do código",
};

/**
 * Recipient_id da PLATAFORMA (Ankor Tech) — quem recebe a taxa da
 * plataforma em toda venda com split. Diferente do recipient de cada loja
 * (que fica em /admin/lojas/:id/pagamentos), esse é único e vale pra todas
 * as lojas de uma vez. Visível apenas para super admin.
 */
export function PlatformRecipientSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [value, setValue] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("platform-recipient", { method: "GET" });
    if (error) {
      toast.error("Não foi possível carregar o recipient da plataforma");
    } else {
      setStatus(data as Status);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  // supabase-js embute o corpo da resposta de erro (não-2xx) em
  // error.context — sem isso, só sobra a mensagem genérica "Edge Function
  // returned a non-2xx status code" em vez do motivo real vindo da function.
  const extrairErro = async (error: unknown, data: unknown): Promise<string | null> => {
    const fromData = (data as any)?.error;
    if (fromData) return fromData;
    const ctx = (error as any)?.context;
    if (ctx?.body) {
      try {
        const parsed = JSON.parse(await new Response(ctx.body).text());
        if (parsed?.error) return parsed.error;
      } catch {
        // segue pro fallback
      }
    }
    return null;
  };

  const salvar = async () => {
    const recipientId = value.trim();
    if (!/^re_[a-zA-Z0-9]+$/.test(recipientId)) {
      toast.error("Formato inválido. Esperado: re_xxxxxxxxxxxxxxxx");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("platform-recipient", {
      body: { recipient_id: recipientId },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((await extrairErro(error, data)) ?? "Falha ao salvar o recipient");
      return;
    }
    setValue("");
    toast.success(`Recipient da plataforma atualizado: ${data?.nome ?? recipientId}`);
    carregar();
  };

  const remover = async () => {
    setSaving(true);
    const { error, data } = await supabase.functions.invoke("platform-recipient", { method: "DELETE" });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((await extrairErro(error, data)) ?? "Falha ao remover");
      return;
    }
    toast.success("Voltou a usar o secret de ambiente / valor padrão");
    carregar();
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Recipient da plataforma</h2>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Super admin</Badge>
        </div>
        {loading ? null : status?.configurado ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary">Configurado</Badge>
        ) : (
          <Badge variant="outline">Não configurado</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        É este recipient que recebe a taxa da plataforma (Ankor Tech) em toda venda com split, em
        <strong> todas as lojas</strong>. É diferente do recipient de cada loja, que fica na tela de
        Pagamentos de cada uma. Alterar isso afeta o repasse de todas as vendas futuras com split.
      </p>

      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          {status?.configurado && status.recipient_id && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <code className="text-sm font-mono">{status.recipient_id}</code>
                {status.valida === true ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : status.valida === false ? (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <XCircle className="h-3 w-3" /> Problema
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" /> Não testado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {ORIGEM_LABEL[status.origem ?? "fallback"]}
                {status.nome && ` · ${status.nome}`}
                {status.status_recipient && ` · status Pagar.me: ${status.status_recipient}`}
              </p>
              {status.diagnostico && (
                <p className="text-xs text-destructive">{status.diagnostico}</p>
              )}
              {status.atualizado_em && status.origem === "banco" && (
                <p className="text-xs text-muted-foreground">
                  atualizado em {new Date(status.atualizado_em).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform-recipient">
              {status?.configurado ? "Trocar recipient" : "Vincular recipient"}
            </Label>
            <Input
              id="platform-recipient"
              autoComplete="off"
              spellCheck={false}
              placeholder="re_xxxxxxxxxxxxxxxx"
              value={value}
              onChange={(e) => setValue(e.target.value.trim())}
              className="mono"
            />
            <p className="text-xs text-muted-foreground">
              O valor é conferido diretamente no Pagar.me antes de salvar — se o recipient não existir
              ou estiver inativo, nada é gravado.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={salvar} disabled={saving || !value}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar recipient
            </Button>
            {status?.configurado && status.origem === "banco" && (
              <Button variant="ghost" onClick={remover} disabled={saving} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
