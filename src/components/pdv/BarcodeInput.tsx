import { forwardRef, KeyboardEvent, useImperativeHandle, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scan } from "lucide-react";
import { cn } from "@/lib/utils";

export type BarcodeInputRef = { feedback: (found: boolean) => void; focus: () => void };

interface Props {
  onScan: (code: string) => void;
  loading?: boolean;
}

export const BarcodeInput = forwardRef<BarcodeInputRef, Props>(function BarcodeInput(
  { onScan, loading },
  ref
) {
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    feedback: (found) => {
      setFlash(found ? "ok" : "err");
      setTimeout(() => setFlash(null), 600);
    },
    focus: () => inputRef.current?.focus(),
  }));

  const submit = () => {
    const code = value.trim();
    if (!code) return;
    onScan(code);
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        autoComplete="off"
        placeholder="Aponte o leitor ou digite o código..."
        disabled={loading}
        className={cn(
          "font-mono text-base tracking-widest h-11 transition-colors duration-300",
          flash === "ok" && "border-primary bg-primary/10",
          flash === "err" && "border-destructive bg-destructive/10"
        )}
      />
      <Button onClick={submit} disabled={loading || !value.trim()} className="h-11 px-4 shrink-0">
        <Scan className="w-4 h-4 mr-2" />
        Buscar
      </Button>
    </div>
  );
});