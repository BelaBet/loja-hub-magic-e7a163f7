import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricaCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "success" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="mt-2 text-2xl font-display font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}