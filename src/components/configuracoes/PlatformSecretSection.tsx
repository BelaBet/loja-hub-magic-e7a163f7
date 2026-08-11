import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Loader2, Save, Eye, EyeOff, Trash2, ShieldCheck } from "lucide-react";

type Status = {
  configurada: boolean;
  origem: "ambiente" | "banco" | null;
  last4: string | null;
  atualizada_em: string | null;
};

/**
 * Chave secreta do provedor de pagamentos — visível apenas para super admin.
 * O valor nunca volta para o navegador: a função de backend só devolve os
 * últimos 4 dígitos e a data da última atualização.
 */
export function PlatformSecretSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("platform-secret", { method: "GET" });
    if (error) {
      toast.error("Não foi possível carregar o status da chave");
    } else {
      setStatus(data as Status);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const salvar = async () => {
    const secret = value.trim();
    if (secret.length < 10) {
      toast.error("Cole a chave secreta completa");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("platform-secret", {
      body: { secret_key: secret },
    });
    setSaving(false);
    const errMsg = (data as any)?.error;
    if (error || errMsg) {
      toast.error(errMsg ?? "Falha ao salvar a chave");
      return;
    }
    setValue("");
    toast.success("Chave validada e salva com segurança");
    carregar();
  };

  const remover = async () => {
    setSaving(true);
    const { error } = await supabase.functions.invoke("platform-secret", { method: "DELETE" });
    setSaving(false);
    if (error) {
      toast.error("Falha ao remover a chave");
      return;
    }
    toast.success("Chave removida");
    carregar();
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Chave do provedor de pagamentos</h2>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Super admin</Badge>
        </div>
        {loading ? null : status?.configurada ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary">Configurada</Badge>
        ) : (
          <Badge variant="outline">Não configurada</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        É esta chave que autoriza as cobranças no cartão, PIX e maquininha. Ela é guardada
        criptografada no backend, nunca aparece no aplicativo e não pode ser lida de volta —
        apenas substituída.
      </p>

      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          {status?.configurada && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm flex items-center gap-2 flex-wrap">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="mono">•••• {status.last4}</span>
              <span className="text-muted-foreground text-xs">
                {status.origem === "ambiente"
                  ? "definida pela plataforma"
                  : status.atualizada_em
                    ? `atualizada em ${new Date(status.atualizada_em).toLocaleString("pt-BR")}`
                    : "salva no backend"}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform-secret">
              {status?.configurada ? "Substituir chave" : "Colar chave secreta"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="platform-secret"
                type={reveal ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk_..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? "Ocultar chave" : "Mostrar chave"}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave é testada no provedor antes de ser salva — se estiver errada, nada é gravado.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={salvar} disabled={saving || value.trim().length < 10}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar chave
            </Button>
            {status?.configurada && status.origem === "banco" && (
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
