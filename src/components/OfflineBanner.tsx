import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PendingSalesDialog } from "@/components/PendingSalesDialog";
import type { PendingSale } from "@/lib/offlineDb";

interface Props {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
  className?: string;
  pendingSales?: PendingSale[];
  onDiscardSale?: (id: number) => Promise<void>;
  onRetrySale?: (id: number) => Promise<void>;
}

export function OfflineBanner({
  online, pendingCount, syncing, onSync, className,
  pendingSales, onDiscardSale, onRetrySale,
}: Props) {
  if (online && pendingCount === 0) return null;

  const failedCount = pendingSales?.filter((s) => s.status === "failed").length ?? 0;
  const canManage = pendingSales && onDiscardSale && onRetrySale;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        online
          ? failedCount > 0
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-destructive/40 bg-destructive/10 text-destructive",
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        {online ? <Wifi className="h-4 w-4 shrink-0" /> : <CloudOff className="h-4 w-4 shrink-0" />}
        <span className="truncate">
          {failedCount > 0
            ? `${failedCount} venda${failedCount === 1 ? "" : "s"} offline precisa${failedCount === 1 ? "" : "m"} de revisão`
            : online
              ? `${pendingCount} venda${pendingCount === 1 ? "" : "s"} aguardando sincronização`
              : pendingCount > 0
                ? `Modo Offline — ${pendingCount} venda${pendingCount === 1 ? "" : "s"} aguardando sincronização`
                : "Modo Offline — vendas serão salvas localmente"}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canManage && pendingCount > 0 && (
          <PendingSalesDialog sales={pendingSales} onDiscard={onDiscardSale} onRetry={onRetrySale} />
        )}
        {online && pendingCount > 0 && (
          <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="h-7 shrink-0">
            <RefreshCw className={cn("h-3 w-3 mr-1", syncing && "animate-spin")} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConnectionDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        online ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-500 animate-pulse" : "bg-destructive",
        )}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}