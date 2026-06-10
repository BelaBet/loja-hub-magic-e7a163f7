import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Smartphone, UserPlus, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingPhones: Set<string>;
  onImported: () => void;
}

type PickedContact = { nome: string; telefone: string; email: string | null; selected: boolean; duplicate: boolean };

const onlyDigits = (s: string) => s.replace(/\D/g, "");

// Contact Picker API typing (not in lib.dom yet)
type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
  getProperties: () => Promise<string[]>;
};

function getContactsApi(): ContactsManager | null {
  const nav = navigator as any;
  if (nav?.contacts && typeof nav.contacts.select === "function") return nav.contacts as ContactsManager;
  return null;
}

export const isContactPickerSupported = () => !!getContactsApi();

export function ImportContactsDialog({ open, onOpenChange, existingPhones, onImported }: Props) {
  const { lojaAtivaId } = useLoja();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<PickedContact[]>([]);

  const pickFromDevice = async () => {
    const api = getContactsApi();
    if (!api) {
      toast.error("Seu navegador não suporta importar contatos. Use o Chrome no Android.");
      return;
    }
    setPicking(true);
    try {
      const supported = await api.getProperties();
      const props = ["name", "tel"].filter((p) => supported.includes(p));
      if (supported.includes("email")) props.push("email");
      const list = await api.select(props, { multiple: true });
      const mapped: PickedContact[] = list
        .map((c) => {
          const nome = (c.name?.[0] ?? "").trim();
          const telefone = (c.tel?.[0] ?? "").trim();
          const email = (c.email?.[0] ?? "").trim() || null;
          return { nome, telefone, email, selected: true, duplicate: false };
        })
        .filter((c) => c.nome && c.telefone)
        .map((c) => ({ ...c, duplicate: existingPhones.has(onlyDigits(c.telefone)) }));

      if (mapped.length === 0) {
        toast.warning("Nenhum contato com nome e telefone foi selecionado.");
      }
      setContacts(mapped);
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Erro ao acessar contatos: " + (e?.message ?? "tente novamente"));
    } finally {
      setPicking(false);
    }
  };

  const toggle = (i: number) =>
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, selected: !c.selected } : c)));

  const toggleAll = (val: boolean) =>
    setContacts((prev) => prev.map((c) => ({ ...c, selected: val && !c.duplicate })));

  const importSelected = async () => {
    if (!lojaAtivaId) return toast.error("Selecione uma loja ativa.");
    const toInsert = contacts.filter((c) => c.selected && !c.duplicate);
    if (toInsert.length === 0) return toast.warning("Nenhum contato selecionado para importar.");
    setSaving(true);
    const rows = toInsert.map((c) => ({
      loja_id: lojaAtivaId,
      nome: c.nome,
      telefone: c.telefone,
      email: c.email,
    }));
    const { error } = await supabase.from("clientes").insert(rows);
    setSaving(false);
    if (error) return toast.error("Erro ao importar: " + error.message);
    toast.success(`${toInsert.length} contato(s) importado(s)!`);
    setContacts([]);
    onOpenChange(false);
    onImported();
  };

  const selectedCount = contacts.filter((c) => c.selected && !c.duplicate).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setContacts([]); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Importar contatos do celular
          </DialogTitle>
          <DialogDescription>
            Selecione contatos do seu dispositivo para cadastrá-los como clientes.
          </DialogDescription>
        </DialogHeader>

        {contacts.length === 0 ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta função usa a agenda do seu dispositivo. Funciona melhor no <strong>Chrome para Android</strong>.
            </p>
            <Button onClick={pickFromDevice} disabled={picking} className="w-full">
              {picking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Selecionar contatos
            </Button>
            {!isContactPickerSupported() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Seu navegador não oferece o seletor de contatos. Tente abrir o app pelo Chrome no Android.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{contacts.length} contato(s) selecionado(s)</span>
              <div className="flex gap-2">
                <button className="hover:underline" onClick={() => toggleAll(true)}>Marcar todos</button>
                <span>·</span>
                <button className="hover:underline" onClick={() => toggleAll(false)}>Desmarcar</button>
              </div>
            </div>
            <ScrollArea className="max-h-72 rounded-md border">
              <ul className="divide-y">
                {contacts.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={c.selected && !c.duplicate}
                      disabled={c.duplicate}
                      onCheckedChange={() => toggle(i)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{c.telefone}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                    {c.duplicate && (
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                        <Check className="w-3 h-3" /> já existe
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {contacts.length > 0 && (
            <Button onClick={importSelected} disabled={saving || selectedCount === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Importar {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}