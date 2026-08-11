import { useEffect, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, TriangleAlert, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLoja } from "@/contexts/LojaContext";
import { useAlertasOperacionais, type AlertaOperacional } from "@/hooks/useAlertasOperacionais";
import {
  getLocalNotifications,
  subscribeLocalNotifications,
  markLocalNotificationRead,
  markAllLocalNotificationsRead,
  type LocalNotification,
} from "@/lib/localNotifications";

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Tipos considerados críticos (dinheiro pode ter mudado de mãos sem refletir
// no sistema) ganham um ícone diferenciado na lista.
const CRITICOS = new Set([
  "webhook_captura_falhou",
  "webhook_update_venda_falhou",
  "webhook_erro_inesperado",
]);

function AlertaItem({ alerta, onRead }: { alerta: AlertaOperacional; onRead: (id: string) => void }) {
  const critico = CRITICOS.has(alerta.tipo);
  return (
    <button
      type="button"
      onClick={() => !alerta.lido && onRead(alerta.id)}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-muted/50",
        !alerta.lido && "bg-primary/5",
      )}
    >
      <div className="flex items-start gap-2">
        {critico ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
        ) : (
          <TriangleAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn("text-sm leading-tight", !alerta.lido && "font-semibold")}>{alerta.titulo}</p>
            {!alerta.lido && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          {alerta.detalhe && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{alerta.detalhe}</p>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-1">{fmtData(alerta.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

export function AlertsBell() {
  const { lojaAtivaId } = useLoja();
  const { alertas, unreadCount, marcarLido, marcarTodasLidas } = useAlertasOperacionais(lojaAtivaId);
  const [locais, setLocais] = useState<LocalNotification[]>(() => getLocalNotifications());

  useEffect(() => subscribeLocalNotifications(setLocais), []);

  const unreadLocais = locais.filter((n) => !n.lido).length;
  const totalUnread = unreadCount + unreadLocais;
  const vazio = alertas.length === 0 && locais.length === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0" aria-label="Alertas">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                markAllLocalNotificationsRead();
                void marcarTodasLidas();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        {vazio ? (
          <p className="text-sm text-muted-foreground py-8 text-center px-4">
            Nenhuma notificação por aqui.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            {locais.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.lido && markLocalNotificationRead(n.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-muted/50",
                  !n.lido && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-sm leading-tight", !n.lido && "font-semibold")}>{n.titulo}</p>
                      {!n.lido && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {n.detalhe && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{n.detalhe}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{fmtData(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
            {alertas.map((a) => (
              <AlertaItem key={a.id} alerta={a} onRead={(id) => void marcarLido(id)} />
            ))}
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
