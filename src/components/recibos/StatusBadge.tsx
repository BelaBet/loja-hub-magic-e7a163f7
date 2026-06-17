import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusRecibo } from "./types";

const MAP: Record<StatusRecibo, { label: string; cls: string }> = {
  pago: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  cancelado: { label: "Cancelado", cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export function StatusBadge({ status }: { status: StatusRecibo }) {
  const m = MAP[status];
  return (
    <Badge variant="outline" className={cn("font-medium", m.cls)}>
      {m.label}
    </Badge>
  );
}