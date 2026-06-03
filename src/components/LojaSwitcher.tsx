import { Check, ChevronsUpDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLoja } from "@/contexts/LojaContext";

export function LojaSwitcher() {
  const { lojas, lojaAtiva, setLojaAtiva, switching } = useLoja();
  if (lojas.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={switching} className="gap-2 max-w-[200px]">
          <Store className="h-4 w-4 shrink-0" />
          <span className="truncate">{lojaAtiva?.loja?.nome ?? "Selecione"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {lojas.map((l) => (
          <DropdownMenuItem
            key={l.loja_id}
            onClick={() => setLojaAtiva(l.loja_id)}
            className="cursor-pointer flex items-center justify-between"
          >
            <div className="flex flex-col min-w-0">
              <span className="truncate font-medium">{l.loja?.nome}</span>
              <span className="text-xs text-muted-foreground capitalize">{l.role}</span>
            </div>
            {l.loja_id === lojaAtiva?.loja_id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}