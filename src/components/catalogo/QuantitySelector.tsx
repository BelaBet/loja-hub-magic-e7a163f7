import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  max?: number | null;
  size?: "sm" | "md";
};

export function QuantitySelector({ value, onChange, max, size = "md" }: Props) {
  const limit = max ?? Infinity;
  const dec = () => onChange(Math.max(1, value - 1));
  const inc = () => onChange(Math.min(limit, value + 1));
  const h = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={dec}
        disabled={value <= 1}
        className={h}
        aria-label="Diminuir quantidade"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="num min-w-[2ch] text-center font-semibold tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={inc}
        disabled={value >= limit}
        className={h}
        aria-label="Aumentar quantidade"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}