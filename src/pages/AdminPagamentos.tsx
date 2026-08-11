import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Shield, CreditCard, CheckCircle2, XCircle, Loader2, RefreshCw, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Loja = { id: string; nome: string; pagarme_recipient_id: string | null };
type RecipientInfo = { id: string; name?: string; status?: string; email?: string } | null;

const RECIPIENT_RE = /^re_[a-zA-Z0-9]+$/;

async function callFn(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const { data, error } = await supabase.functions.invoke("update-pagarme-recipient", {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) {
    const ctx = (error as any).context;
    let msg = error.message;
    try {
      const parsed = ctx?.body ? JSON.parse(await new Response(ctx.body).text()) : null;
      if (parsed?.error) msg = parsed.error;
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminPagamentos() {
  const { lojaId } = useParams<{ lojaId: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loja, setLoja] = useState<Loja | null>(null);

  const [novoRecipient, setNovoRecipient] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [statusAtual, setStatusAtual] = useState<{ ok: boolean; recipient: RecipientInfo; erro?: string } | null>(null);
  const [confirmRemover, setConfirmRemover] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: roleData } = await supabase.rpc("is_super_admin");
      const ok = roleData === true;
      setIsSuper(ok);
      setAuthChecked(true);
      if (!ok || !lojaId) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, pagarme_recipient_id")
        .eq("id", lojaId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Loja não encontrada");
      } else {
        setLoja(data);
      }
      setLoading(false);
    })();
  }, [lojaId]);

  const testarAtual = async () => {
    if (!loja) return;
    if (!loja.pagarme_recipient_id) {
      setStatusAtual({ ok: false, recipient: null, erro: "Nenhum recipient vinculado ainda." });
      return;
    }
    setTestando(true);
    setStatusAtual(null);
    try {
      const res = await callFn({ loja_id: loja.id, recipient_id: loja.pagarme_recipient_id, dry_run: true });
      setStatusAtual({ ok: true, recipient: res.recipient });
    } catch (e: any) {
      setStatusAtual({ ok: false, recipient: null, erro: e.message });
    } finally {
      setTestando(false);
    }
  };

  // Testa automaticamente ao carregar, pra já mostrar a saúde da conexão.
  useEffect(() => {
    if (loja) void testarAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja?.id]);

  const salvar = async () => {
    if (!loja) return;
    const trimmed = novoRecipient.trim();
    if (!RECIPIENT_RE.test(trimmed)) {
      toast.error("Formato inválido. Esperado: re_xxxxxxxxxxxxxxxx");
      return;
    }
    setSalvando(true);
    try {
      const res = await callFn({ loja_id: loja.id, recipient_id: trimmed });
      setLoja({ ...loja, pagarme_recipient_id: trimmed });
      setNovoRecipient("");
      setStatusAtual({ ok: true, recipient: res.recipient });
      toast.success(`Recipient vinculado: ${res.recipient?.name ?? trimmed}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!loja) return;
    setSalvando(true);
    try {
      await callFn({ loja_id: loja.id, recipient_id: null });
      setLoja({ ...loja, pagarme_recipient_id: null });
      setStatusAtual(null);
      toast.success("Recipient removido");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    } finally {
      setSalvando(false);
      setConfirmRemover(false);
    }
  };

  if (!authChecked || loading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuper) return <Navigate to="/dashboard" replace />;
  if (!loja) return <Navigate to="/admin" replace />;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/admin">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Instituições
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground mono text-[10px] uppercase tracking-widest">
            <Shield className="h-3.5 w-3.5" /> Super Admin
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Configurações de pagamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loja.nome} · vincula a conta (recipient) do Pagar.me que recebe o repasse do split de cada venda desta loja.
          </p>
        </div>

        <Card className="p-4 sm:p-5 flex items-start gap-3 bg-amber-500/5 border-amber-500/30">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Alterar isso muda para onde vai o dinheiro da loja em toda venda futura com split. Cada alteração fica
            registrada como alerta na própria loja, visível pra ela no sino de notificações.
          </p>
        </Card>

        {/* Status atual */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Recipient atual</Label>
            <Button size="sm" variant="outline" className="h-7" onClick={() => void testarAtual()} disabled={testando || !loja.pagarme_recipient_id}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", testando && "animate-spin")} />
              Testar conexão
            </Button>
          </div>

          {!loja.pagarme_recipient_id ? (
            <p className="text-sm text-muted-foreground">Nenhum recipient vinculado ainda.</p>
          ) : (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono">{loja.pagarme_recipient_id}</code>
                {testando ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : statusAtual?.ok ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : statusAtual && !statusAtual.ok ? (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <XCircle className="h-3 w-3" /> Problema
                  </Badge>
                ) : null}
              </div>
              {statusAtual?.ok && statusAtual.recipient && (
                <p className="text-xs text-muted-foreground">
                  {statusAtual.recipient.name ?? "—"} · status Pagar.me: {statusAtual.recipient.status ?? "?"}
                </p>
              )}
              {statusAtual && !statusAtual.ok && statusAtual.erro && (
                <p className="text-xs text-destructive">{statusAtual.erro}</p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 -ml-2"
                onClick={() => setConfirmRemover(true)}
              >
                Remover vínculo
              </Button>
            </div>
          )}
        </Card>

        <Separator />

        {/* Vincular novo */}
        <Card className="p-4 sm:p-5 space-y-3">
          <Label className="text-base">
            {loja.pagarme_recipient_id ? "Trocar recipient" : "Vincular recipient"}
          </Label>
          <p className="text-xs text-muted-foreground">
            Antes de salvar, o valor é conferido diretamente no Pagar.me — se o recipient não existir ou estiver
            inativo, nada é salvo.
          </p>
          <div className="flex gap-2">
            <Input
              value={novoRecipient}
              onChange={(e) => setNovoRecipient(e.target.value.trim())}
              placeholder="re_xxxxxxxxxxxxxxxx"
              className="font-mono"
            />
            <Button onClick={() => void salvar()} disabled={salvando || !novoRecipient} className="shrink-0">
              {salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </Card>
      </div>

      <AlertDialog open={confirmRemover} onOpenChange={setConfirmRemover}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o recipient desta loja?</AlertDialogTitle>
            <AlertDialogDescription>
              Novas vendas com split não terão para onde direcionar o repasse até que um novo recipient seja
              vinculado. As vendas já existentes não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void remover()}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
