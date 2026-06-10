import { CheckCircle2, XCircle } from "lucide-react";
import type { ScanEvent } from "./types";

export function ScanHistory({ events }: { events: ScanEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de leituras
        </p>
      </div>
      <ul className="divide-y max-h-48 overflow-y-auto">
        {events.map((ev, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            {ev.found ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            )}
            <span className="font-mono text-xs text-foreground">{ev.code}</span>
            <span className="flex-1 text-xs text-muted-foreground truncate">{ev.product_name ?? "—"}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {ev.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}