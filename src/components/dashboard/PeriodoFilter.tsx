import { useEffect, useMemo, useState } from "react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

export type PeriodoPreset = "hoje" | "7d" | "30d" | "90d" | "mes" | "ano" | "custom";

export type PeriodoRange = { from: Date; to: Date };

type PeriodoFilterProps = {
  value: PeriodoRange;
  preset: PeriodoPreset;
  onChange: (range: PeriodoRange, preset: PeriodoPreset) => void;
  className?: string;
};

const PRESETS: { id: PeriodoPreset; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

export function periodoRange(preset: PeriodoPreset, custom?: { from?: Date; to?: Date }): PeriodoRange {
  const to = endOfDay(new Date());
  if (preset === "hoje") return { from: startOfDay(new Date()), to };
  if (preset === "7d") return { from: startOfDay(subDays(new Date(), 6)), to };
  if (preset === "30d") return { from: startOfDay(subDays(new Date(), 29)), to };
  if (preset === "90d") return { from: startOfDay(subDays(new Date(), 89)), to };
  if (preset === "mes") return { from: startOfMonth(new Date()), to };
  if (preset === "ano") return { from: startOfYear(new Date()), to };
  return {
    from: custom?.from ? startOfDay(custom.from) : startOfDay(subDays(new Date(), 29)),
    to: custom?.to ? endOfDay(custom.to) : to,
  };
}

export function periodoAnterior(range: PeriodoRange): PeriodoRange {
  const duration = range.to.getTime() - range.from.getTime();
  const from = new Date(range.from.getTime() - duration - 1);
  const to = new Date(range.from.getTime() - 1);
  return { from, to };
}

export function formatPeriodoLabel(range: PeriodoRange): string {
  if (
    range.from.getTime() === startOfDay(new Date()).getTime() &&
    range.to.getTime() === endOfDay(new Date()).getTime()
  ) {
    return "Hoje";
  }
  return `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`;
}

export function PeriodoFilter({ value, preset, onChange, className }: PeriodoFilterProps) {
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({ from: value.from, to: value.to });
  const label = useMemo(() => formatPeriodoLabel(value), [value]);

  useEffect(() => {
    setCustom({ from: value.from, to: value.to });
  }, [value.from, value.to]);

  const selectPreset = (id: PeriodoPreset) => {
    const newRange = periodoRange(id, custom);
    onChange(newRange, id);
  };

  const applyCustom = (range?: { from?: Date; to?: Date }) => {
    const r = periodoRange("custom", range);
    onChange(r, "custom");
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex rounded-lg border border-border p-1 bg-card">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPreset(p.id)}
            className={cn(
              "mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-md transition-colors",
              preset === p.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant={preset === "custom" ? "default" : "outline"} size="sm" className="h-9 gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === "custom" && custom.from ? label : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: custom.from, to: custom.to }}
            onSelect={(r) => {
              setCustom({ from: r?.from, to: r?.to });
              if (r?.from && r?.to) {
                applyCustom({ from: r.from, to: r.to });
              }
            }}
            numberOfMonths={1}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
