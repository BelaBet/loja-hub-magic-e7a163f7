import { useState, KeyboardEvent } from "react";
import { Loader2, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import type { AppliedCoupon } from "./coupon-types";

interface Props {
  appliedCoupon: AppliedCoupon | null;
  loading?: boolean;
  error?: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

export function CouponInput({ appliedCoupon, loading, error, onApply, onRemove }: Props) {
  const [code, setCode] = useState("");

  const submit = () => {
    if (!code.trim() || loading) return;
    onApply(code);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-2">
        <Ticket className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-emerald-900 dark:text-emerald-200 truncate">
            {appliedCoupon.coupon.code}
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Economia de {brl(appliedCoupon.discount_amount)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="h-6 w-6 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900"
          aria-label="Remover cupom"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          onKeyDown={onKey}
          placeholder="CÓDIGO DO CUPOM"
          className="font-mono uppercase h-9"
          maxLength={20}
          disabled={loading}
        />
        <Button type="button" onClick={submit} disabled={loading || !code.trim()} className="h-9 shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}