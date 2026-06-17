import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateRecibo } from "./types";

const OPTIONS: { id: TemplateRecibo; label: string; desc: string; preview: string }[] = [
  { id: "padrao", label: "Padrão", desc: "Completo, com logo e dados da loja", preview: "bg-white border-zinc-300" },
  { id: "minimalista", label: "Minimalista", desc: "Só o essencial", preview: "bg-zinc-50 border-zinc-200" },
  { id: "dark", label: "Dark Premium", desc: "Fundo escuro elegante", preview: "bg-zinc-900 border-zinc-700" },
];

export function TemplateSeletor({
  value,
  onChange,
  compact,
}: {
  value: TemplateRecibo;
  onChange: (v: TemplateRecibo) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-2" : "grid sm:grid-cols-3 gap-3")}>
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "w-full text-left rounded-lg border p-3 transition-all",
              active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
            )}
          >
            <div className={cn("h-16 w-full rounded-md mb-2 border", opt.preview)} />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{opt.label}</div>
                {!compact && <div className="text-xs text-muted-foreground">{opt.desc}</div>}
              </div>
              {active && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}