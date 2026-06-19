import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useInstitutions } from "@/contexts/InstitutionContext";

type Loja = { id: string; nome: string; institution_id: string | null };

const RedeConfiguracoes = () => {
  const { institutions, current, setCurrentId, refresh, loading } = useInstitutions();
  const [newName, setNewName] = useState("");
  const [newCnpj, setNewCnpj] = useState("");
  const [editName, setEditName] = useState("");
  const [editCnpj, setEditCnpj] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [linkLojaId, setLinkLojaId] = useState<string>("");

  useEffect(() => {
    if (current) {
      setEditName(current.nome);
      setEditCnpj(current.cnpj ?? "");
    }
  }, [current?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, institution_id")
        .order("created_at", { ascending: true });
      setLojas((data as Loja[]) ?? []);
    })();
  }, [current?.id]);

  const createInstitution = async () => {
    if (!newName.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("institutions").insert({
      nome: newName.trim(),
      cnpj: newCnpj.trim() || null,
      owner_user_id: u.user.id,
    });
    if (error) return toast.error(error.message);
    setNewName(""); setNewCnpj("");
    await refresh();
    toast.success("Rede criada");
  };

  const saveInstitution = async () => {
    if (!current) return;
    const { error } = await (supabase as any)
      .from("institutions")
      .update({ nome: editName, cnpj: editCnpj || null })
      .eq("id", current.id);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Rede atualizada");
  };

  const linkLoja = async () => {
    if (!current || !linkLojaId) return;
    const { error } = await supabase
      .from("lojas")
      .update({ institution_id: current.id } as any)
      .eq("id", linkLojaId);
    if (error) return toast.error(error.message);
    setLinkLojaId("");
    const { data } = await supabase.from("lojas").select("id, nome, institution_id");
    setLojas((data as Loja[]) ?? []);
    toast.success("Loja vinculada");
  };

  const unlinkLoja = async (lojaId: string) => {
    const { error } = await supabase
      .from("lojas")
      .update({ institution_id: null } as any)
      .eq("id", lojaId);
    if (error) return toast.error(error.message);
    const { data } = await supabase.from("lojas").select("id, nome, institution_id");
    setLojas((data as Loja[]) ?? []);
    toast.success("Loja desvinculada");
  };

  if (loading) return <AppLayout><div className="mono text-sm">carregando…</div></AppLayout>;

  const lojasDaRede = lojas.filter((l) => l.institution_id === current?.id);
  const lojasDisponiveis = lojas.filter((l) => !l.institution_id);

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl">
        <header>
          <div className="flex items-center gap-2 text-muted-foreground mono text-[10px] uppercase tracking-widest">
            <Network className="h-3.5 w-3.5" /> Rede
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Configurações da rede</h1>
        </header>

        {institutions.length === 0 ? (
          <Card className="p-5 space-y-3">
            <div className="font-semibold">Criar primeira rede</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div><Label>CNPJ (opcional)</Label><Input value={newCnpj} onChange={(e) => setNewCnpj(e.target.value)} /></div>
            </div>
            <Button onClick={createInstitution}><Plus className="h-4 w-4 mr-1" /> Criar rede</Button>
          </Card>
        ) : (
          <>
            {institutions.length > 1 && (
              <Select value={current?.id ?? ""} onValueChange={setCurrentId}>
                <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Card className="p-5 space-y-3">
              <div className="font-semibold">Dados da rede</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label>Nome</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                <div><Label>CNPJ</Label><Input value={editCnpj} onChange={(e) => setEditCnpj(e.target.value)} /></div>
              </div>
              <Button onClick={saveInstitution}>Salvar</Button>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="font-semibold">Lojas vinculadas</div>
              <ul className="divide-y border rounded">
                {lojasDaRede.length === 0 && (
                  <li className="p-3 text-sm text-muted-foreground">Nenhuma loja vinculada ainda.</li>
                )}
                {lojasDaRede.map((l) => (
                  <li key={l.id} className="p-3 flex items-center justify-between">
                    <span>{l.nome}</span>
                    <Button size="sm" variant="ghost" onClick={() => unlinkLoja(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 items-end pt-2">
                <div className="flex-1">
                  <Label>Vincular loja existente</Label>
                  <Select value={linkLojaId} onValueChange={setLinkLojaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma loja" /></SelectTrigger>
                    <SelectContent>
                      {lojasDisponiveis.length === 0 && (
                        <SelectItem value="__none" disabled>Nenhuma loja disponível</SelectItem>
                      )}
                      {lojasDisponiveis.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={linkLoja} disabled={!linkLojaId}>
                  <LinkIcon className="h-4 w-4 mr-1" /> Vincular
                </Button>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="font-semibold">Criar outra rede</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                <div><Label>CNPJ</Label><Input value={newCnpj} onChange={(e) => setNewCnpj(e.target.value)} /></div>
              </div>
              <Button onClick={createInstitution} variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Criar rede
              </Button>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default RedeConfiguracoes;