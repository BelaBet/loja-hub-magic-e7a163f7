import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Ticket, Trash2, Power, Search, Shuffle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { brl } from "@/lib/format";
import type { Coupon, CouponType } from "@/components/pdv/coupon-types";

const CODE_RE = /^[A-Z0-9]{4,20}$/;

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function statusOf(c: Coupon): { label: string; tone: string } {
  if (!c.active) return { label: "Inativo", tone: "bg-muted text-muted-foreground" };
  if (c.used_count >= c.max_uses) return { label: "Esgotado", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
  if (c.expires_at) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(c.expires_at + "T23:59:59") < today) {
      return { label: "Expirado", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
    }
  }
  return { label: "Ativo", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
}

export default function CouponsPage() {
  const { lojaAtivaId } = useLoja();
  const [list, setList] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // form
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState<string>("10");
  const [maxUses, setMaxUses] = useState<string>("100");
  const [minOrder, setMinOrder] = useState<string>("0");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cupons" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar: " + error.message);
    setList((data as unknown as Coupon[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lojaAtivaId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lojaAtivaId) return toast.error("Selecione uma loja ativa");
    const normCode = code.trim().toUpperCase();
    if (!CODE_RE.test(normCode)) return toast.error("Código deve ter 4–20 letras/números maiúsculos");
    const v = Number(value);
    if (!(v > 0)) return toast.error("Valor inválido");
    if (type === "percentage" && v > 100) return toast.error("Percentual deve ser entre 1 e 100");
    const mu = Math.max(1, Math.floor(Number(maxUses) || 1));
    const mo = Math.max(0, Number(minOrder) || 0);

    setSaving(true);
    const { error } = await supabase.from("cupons" as any).insert({
      loja_id: lojaAtivaId,
      code: normCode,
      type,
      value: v,
      max_uses: mu,
      min_order_value: mo,
      expires_at: expiresAt || null,
      description: description.trim(),
      active: true,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("Já existe um cupom com esse código");
      return toast.error("Erro: " + error.message);
    }
    toast.success("Cupom criado!");
    setCode(""); setValue("10"); setMaxUses("100"); setMinOrder("0");
    setExpiresAt(""); setDescription(""); setType("percentage");
    load();
  };

  const toggleActive = async (c: Coupon) => {
    const { error } = await supabase.from("cupons" as any).update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.active ? "Cupom desativado" : "Cupom ativado");
    load();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Excluir cupom ${c.code}?`)) return;
    const { error } = await supabase.from("cupons" as any).delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Cupom excluído");
    load();
  };

  const filtered = list.filter((c) => c.code.includes(search.trim().toUpperCase()));

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="w-6 h-6" /> Cupons de desconto
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie cupons promocionais que seus clientes podem usar no PDV.
          </p>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-medium">Criar cupom</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="EX: PROMO10"
                  className="font-mono uppercase"
                  maxLength={20}
                />
                <Button type="button" variant="outline" onClick={() => setCode(randomCode())} title="Gerar aleatório">
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de desconto</Label>
              <Select value={type} onValueChange={(v) => setType(v as CouponType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{type === "percentage" ? "Percentual (%)" : "Valor (R$)"}</Label>
              <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Uso máximo</Label>
              <Input type="number" min={1} step={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor mínimo do pedido (R$)</Label>
              <Input type="number" min={0} step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Promoção de inverno" />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar cupom
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-medium flex-1">Cupons cadastrados</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase())}
                placeholder="Buscar código"
                className="pl-8 h-9 w-56 font-mono uppercase"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl py-10">
              Nenhum cupom encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((c) => {
                const st = statusOf(c);
                const valLabel = c.type === "percentage" ? `${Number(c.value)}%` : brl(Number(c.value));
                return (
                  <div key={c.id} className="rounded-xl border-2 border-dashed p-4 bg-card space-y-3">
                    <div className="flex items-start gap-3">
                      <Ticket className="w-5 h-5 text-primary mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-lg font-semibold tracking-wide truncate">{c.code}</p>
                        {c.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                        )}
                      </div>
                      <Badge className={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">Desconto: {valLabel}</Badge>
                      {Number(c.min_order_value) > 0 && (
                        <Badge variant="outline">Min: {brl(Number(c.min_order_value))}</Badge>
                      )}
                      <Badge variant="outline">Usos: {c.used_count}/{c.max_uses}</Badge>
                      {c.expires_at && (
                        <Badge variant="outline">Até {new Date(c.expires_at + "T00:00:00").toLocaleDateString("pt-BR")}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(c)} className="flex-1">
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        {c.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}