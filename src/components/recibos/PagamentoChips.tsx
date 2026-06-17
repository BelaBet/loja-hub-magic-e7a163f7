import { cn } from "@/lib/utils";
import { FORMA_LABEL, type FormaPagamento } from "./types";

const ORDER: FormaPagamento[] = ["dinheiro", "pix", "credito", "debito", "boleto"];

export function PagamentoChips({
  value,
  onChange,
}: {
  value: FormaPagamento;
  onChange: (v: FormaPagamento) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((f) => {
        const active = value === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={cn(
              "h-9 px-4 rounded-full text-sm font-medium border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted",
            )}
          >
            {FORMA_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}