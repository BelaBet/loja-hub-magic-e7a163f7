import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { traduzErro } from "@/lib/errors";
import {
  Users,
  UserPlus,
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShoppingCart,
  Crown,
} from "lucide-react";

type Vendedor = {
  id: string;          // loja_usuarios.id
  user_id: string;
  role: string;
  created_at: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  eu: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  vendedor: "Vendedor",
};

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: ShieldCheck,
  vendedor: ShoppingCart,
};

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const initials = (nome: string | null, email: string | null) => {
  const n = nome ?? email ?? "?";
  return n.slice(0, 2).toUpperCase();
};

const Vendedores = () => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNome, setInviteNome] = useState("");
  const [inviteRole, setInviteRole] = useState("vendedor");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<Vendedor | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);

      // Buscar loja_id do usuário logado
      const { data: myLoja } = await supabase
        .from("loja_usuarios")
        .select("loja_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myLoja) { setLoading(false); return; }
      setLojaId(myLoja.loja_id);
      setIsOwnerOrAdmin(["owner", "admin"].includes(myLoja.role));

      // Buscar todos os usuários da loja
      const { data: membros, error } = await supabase
        .from("loja_usuarios")
        .select("id, user_id, role, created_at")
        .eq("loja_id", myLoja.loja_id)
        .order("created_at");

      if (error) { toast.error(traduzErro(error)); setLoading(false); return; }

      // Buscar profiles de todos
      const ids = (membros ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, telefone")
        .in("id", ids);

      // Buscar emails via auth.users (disponível através dos metadados da sessão)
      // Como não temos acesso direto ao auth.users no client, usamos os metadados do usuário atual
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const lista: Vendedor[] = (membros ?? []).map((m) => {
        const p = profileMap.get(m.user_id);
        const isMe = m.user_id === user.id;
        const emailFallback = isMe ? (user.email ?? null) : null;
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          nome: p?.nome ?? null,
          telefone: p?.telefone ?? null,
          email: emailFallback,
          eu: isMe,
        };
      });

      setVendedores(lista);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lojaId) return;
    setInviteLoading(true);
    try {
      // Criar conta com senha temporária e forçar reset
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteEmail.trim().toLowerCase(),
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/reset-password`,
          data: { full_name: inviteNome.trim() || undefined },
        },
      });

      if (signUpError) {
        // Se usuário já existe, tentar encontrá-lo pelo email via loja_usuarios + profiles
        toast.error("Não foi possível criar o acesso: " + traduzErro(signUpError));
        setInviteLoading(false);
        return;
      }

      const newUserId = signUpData.user?.id;
      if (!newUserId) {
        toast.error("Erro ao obter ID do novo usuário.");
        setInviteLoading(false);
        return;
      }

      // Criar profile com nome
      if (inviteNome.trim()) {
        await supabase.from("profiles").upsert({
          id: newUserId,
          nome: inviteNome.trim(),
          updated_at: new Date().toISOString(),
        });
      }

      // Vincular à loja
      const { error: lojaError } = await supabase.from("loja_usuarios").insert({
        user_id: newUserId,
        loja_id: lojaId,
        role: inviteRole,
      });

      if (lojaError) {
        toast.error(traduzErro(lojaError));
        setInviteLoading(false);
        return;
      }

      // Enviar reset de senha para que o vendedor defina a própria senha
      await supabase.auth.resetPasswordForEmail(inviteEmail.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      toast.success(`Convite enviado para ${inviteEmail}! O vendedor receberá um e-mail para definir a senha.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteNome("");
      setInviteRole("vendedor");
      void load();
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (v: Vendedor, novoRole: string) => {
    const { error } = await supabase
      .from("loja_usuarios")
      .update({ role: novoRole })
      .eq("id", v.id);
    if (error) { toast.error(traduzErro(error)); return; }
    toast.success("Função atualizada.");
    void load();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    const { error } = await supabase
      .from("loja_usuarios")
      .delete()
      .eq("id", removeTarget.id);
    setRemoveLoading(false);
    if (error) { toast.error(traduzErro(error)); return; }
    toast.success(`${removeTarget.nome ?? "Vendedor"} removido da loja.`);
    setRemoveTarget(null);
    void load();
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Equipe
            </span>
            <h1 className="font-display text-fluid-3xl font-bold tracking-tight mt-1">
              Vendedores
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Gerencie quem tem acesso ao PDV da sua loja.
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => setInviteOpen(true)} className="shrink-0 gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          )}
        </header>

        {/* Lista */}
        <Card className="divide-y divide-border">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : vendedores.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado ainda.</p>
            </div>
          ) : (
            vendedores.map((v) => {
              const RoleIcon = ROLE_ICON[v.role] ?? ShoppingCart;
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {initials(v.nome, v.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                        {v.nome ?? v.email ?? "Sem nome"}
                      </span>
                      {v.eu && (
                        <span className="mono text-[9px] uppercase tracking-widest text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {v.email && (
                        <span className="mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {v.email}
                        </span>
                      )}
                      {v.telefone && (
                        <span className="mono text-[10px] text-muted-foreground">{v.telefone}</span>
                      )}
                      <span className="mono text-[10px] text-muted-foreground">
                        desde {fmtData(v.created_at)}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 text-[10px] hidden sm:inline-flex"
                  >
                    <RoleIcon className="h-3 w-3" />
                    {ROLE_LABEL[v.role] ?? v.role}
                  </Badge>

                  {isOwnerOrAdmin && !v.eu && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => handleChangeRole(v, "admin")}
                          disabled={v.role === "admin"}
                        >
                          <ShieldCheck className="h-4 w-4 mr-2" /> Tornar admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleChangeRole(v, "vendedor")}
                          disabled={v.role === "vendedor"}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" /> Tornar vendedor
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRemoveTarget(v)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Remover da loja
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })
          )}
        </Card>

        {/* Info card */}
        <Card className="p-4 bg-muted/40 border-dashed">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Como funciona:</span>{" "}
            Ao adicionar um vendedor, ele receberá um e-mail para definir sua senha e
            acessar o PDV. Vendedores veem apenas o que é necessário para realizar vendas.
            Administradores têm acesso completo, exceto configurações de pagamento.
          </p>
        </Card>
      </div>

      {/* Dialog — Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar vendedor</DialogTitle>
            <DialogDescription>
              Um e-mail será enviado para o vendedor definir sua senha de acesso.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-nome">Nome</Label>
              <Input
                id="invite-nome"
                placeholder="João Silva"
                value={inviteNome}
                onChange={(e) => setInviteNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail *</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="vendedor@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Função</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-3.5 w-3.5" /> Vendedor
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {inviteRole === "admin"
                  ? "Acesso completo ao dashboard, relatórios e configurações."
                  : "Acesso ao PDV, catálogo e histórico de vendas próprias."}
              </p>
            </div>
            <DialogFooter className="gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={inviteLoading} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {inviteLoading ? "Enviando…" : "Enviar convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar remoção */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover vendedor</DialogTitle>
            <DialogDescription>
              <strong>{removeTarget?.nome ?? removeTarget?.email}</strong> perderá acesso à
              loja imediatamente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeLoading}>
              {removeLoading ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Vendedores;
