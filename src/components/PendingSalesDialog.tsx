import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, AlertTriangle, Clock, CheckCircle2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";
import type { PendingSale } from "@/lib/offlineDb";

const PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Cartão débito",
  cartao_credito: "Cartão crédito",
};

const STATUS_INFO: Record<PendingSale["status"], { label: string; cls: string; icon: typeof Clock }> = {
  pending_sync: { label: "Aguardando", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", icon: Clock },
  syncing: { label: "Sincronizando", cls: "bg-primary/10 text-primary border-primary/20", icon: RefreshCw },
  synced: { label: "Sincronizada", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  error: { label: "Erro — vai tentar de novo", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", icon: AlertTriangle },
  failed: { label: "Falha — precisa revisar", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
};

const fmtData = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface Props {
  sales: PendingSale[];
  onDiscard: (id: number) => Promise<void>;
  onRetry: (id: number) => Promise<void>;
  trigger?: React.ReactNode;
}

export function PendingSalesDialog({ sales, onDiscard, onRetry, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<PendingSale | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pendentes = sales
    .filter((s) => s.status !== "synced")
    .sort((a, b) => b.created_at - a.created_at);

  const handleRetry = async (s: PendingSale) => {
    if (s.id == null) return;
    setBusyId(s.id);
    await onRetry(s.id);
    setBusyId(null);
  };

  const handleDiscard = async () => {
    if (confirmDiscard?.id == null) return;
    setBusyId(confirmDiscard.id);
    await onDiscard(confirmDiscard.id);
    setBusyId(null);
    setConfirmDiscard(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline" className="h-7 shrink-0">
              <Settings2 className="h-3 w-3 mr-1" />
              Gerenciar
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vendas offline pendentes</DialogTitle>
          </DialogHeader>

          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma venda pendente de sincronização.
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
              {pendentes.map((s) => {
                const info = STATUS_INFO[s.status];
                const Icon = info.icon;
                const isBusy = busyId === s.id;
                return (
                  <div key={s.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold num">{brl(s.total)}</span>
                          <Badge variant="outline" className={cn("text-[10px] gap-1", info.cls)}>
                            <Icon className={cn("h-2.5 w-2.5", s.status === "syncing" && "animate-spin")} />
                            {info.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {PAGAMENTO_LABEL[s.forma_pagamento] ?? s.forma_pagamento} · {s.items.length} {s.items.length === 1 ? "item" : "itens"} · {fmtData(s.created_at)}
                        </p>
                        {s.coupon_code && (
                          <p className="text-xs text-muted-foreground">Cupom: {s.coupon_code}</p>
                        )}
                      </div>
                    </div>

                    {s.last_error && (s.status === "error" || s.status === "failed") && (
                      <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
                        {s.last_error}
                      </p>
                    )}

                    {s.status === "failed" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1"
                          disabled={isBusy}
                          onClick={() => handleRetry(s)}
                        >
                          <RefreshCw className={cn("h-3 w-3 mr-1.5", isBusy && "animate-spin")} />
                          Tentar de novo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isBusy}
                          onClick={() => setConfirmDiscard(s)}
                        >
                          <Trash2 className="h-3 w-3 mr-1.5" />
                          Descartar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDiscard} onOpenChange={(o) => !o && setConfirmDiscard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda de {confirmDiscard ? brl(confirmDiscard.total) : ""} feita offline será apagada do dispositivo
              e não será registrada no sistema. Essa ação não pode ser desfeita — só descarte se já tiver certeza
              de que vai registrar essa venda manualmente (ou de que ela não deve entrar no sistema).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDiscard}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
