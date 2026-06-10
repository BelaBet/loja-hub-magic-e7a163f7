import { useEffect, useState } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, User, Mail, Lock, ImagePlus } from "lucide-react";

type ProfileForm = {
  nome: string;
  telefone: string;
  avatar_url: string;
};

const profileSchema = z.object({
  nome: z.string().trim().max(120, "Máx. 120 caracteres"),
  telefone: z.string().trim().max(20, "Máx. 20 caracteres"),
  avatar_url: z
    .string()
    .trim()
    .max(500, "Máx. 500 caracteres")
    .url("URL inválida")
    .or(z.literal("")),
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z
  .string()
  .min(8, "Mín. 8 caracteres")
  .max(72, "Máx. 72 caracteres");

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [form, setForm] = useState<ProfileForm>({
    nome: "",
    telefone: "",
    avatar_url: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          toast.error("Sessão expirada.");
          return;
        }
        setUserId(u.user.id);
        setCurrentEmail(u.user.email ?? "");
        setNewEmail(u.user.email ?? "");

        const { data: p } = await supabase
          .from("profiles")
          .select("nome, telefone, avatar_url")
          .eq("id", u.user.id)
          .maybeSingle();

        setForm({
          nome: p?.nome ?? (u.user.user_metadata?.full_name as string | undefined) ?? "",
          telefone: p?.telefone ?? "",
          avatar_url: p?.avatar_url ?? "",
        });
      } catch (e: any) {
        toast.error(`Erro ao carregar perfil: ${e?.message ?? e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const salvar = async () => {
    if (!userId) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const f: Partial<Record<keyof ProfileForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProfileForm;
        if (!f[k]) f[k] = issue.message;
      }
      setErrors(f);
      toast.error("Corrija os campos destacados");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          nome: parsed.data.nome || null,
          telefone: parsed.data.telefone || null,
          avatar_url: parsed.data.avatar_url || null,
        });
      if (error) throw error;
      toast.success("Perfil atualizado");
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem maior que 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("produtos")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("produtos").getPublicUrl(path);
      update("avatar_url", pub.publicUrl);
      toast.success("Foto carregada. Clique em salvar.");
    } catch (e: any) {
      toast.error(`Erro no upload: ${e?.message ?? e}`);
    } finally {
      setUploading(false);
    }
  };

  const trocarEmail = async () => {
    const v = emailSchema.safeParse(newEmail);
    if (!v.success) return toast.error(v.error.issues[0].message);
    if (newEmail === currentEmail) return toast.info("Esse já é o seu e-mail.");
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Verifique seu novo e-mail para confirmar a alteração.");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setSavingEmail(false);
    }
  };

  const trocarSenha = async () => {
    const v = passwordSchema.safeParse(newPwd);
    if (!v.success) return toast.error(v.error.issues[0].message);
    if (newPwd !== confirmPwd) return toast.error("As senhas não coincidem.");
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setNewPwd("");
      setConfirmPwd("");
      toast.success("Senha alterada com sucesso.");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">Edite seus dados pessoais e credenciais</p>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : (
          <>
            {/* Dados pessoais */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Dados pessoais</h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full border bg-muted overflow-hidden flex items-center justify-center">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Foto</Label>
                  <div className="flex gap-2 mt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-accent">
                      {uploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                      ) : (
                        <><ImagePlus className="h-4 w-4" /> Carregar imagem</>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAvatar(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {form.avatar_url && (
                      <Button variant="ghost" size="sm" onClick={() => update("avatar_url", "")}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => update("nome", e.target.value)}
                    maxLength={120}
                    placeholder="Seu nome"
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) => update("telefone", e.target.value)}
                    maxLength={20}
                    placeholder="(11) 99999-9999"
                    className={errors.telefone ? "border-destructive" : ""}
                  />
                  {errors.telefone && <p className="text-xs text-destructive mt-1">{errors.telefone}</p>}
                </div>

                <div>
                  <Label htmlFor="avatar_url">URL do avatar</Label>
                  <Input
                    id="avatar_url"
                    value={form.avatar_url}
                    onChange={(e) => update("avatar_url", e.target.value)}
                    maxLength={500}
                    placeholder="https://…"
                    className={`mono text-xs ${errors.avatar_url ? "border-destructive" : ""}`}
                  />
                  {errors.avatar_url && (
                    <p className="text-xs text-destructive mt-1">{errors.avatar_url}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={salvar} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Salvar perfil</>
                  )}
                </Button>
              </div>
            </Card>

            {/* E-mail */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">E-mail de acesso</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Atual: <span className="mono">{currentEmail}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value.trim())}
                  maxLength={255}
                  placeholder="novo@email.com"
                />
                <Button onClick={trocarEmail} disabled={savingEmail}>
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar e-mail"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enviaremos um link de confirmação para o novo endereço.
              </p>
            </Card>

            {/* Senha */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Senha</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-pwd">Nova senha</Label>
                  <Input
                    id="new-pwd"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    maxLength={72}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
                  <Input
                    id="confirm-pwd"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    maxLength={72}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={trocarSenha} disabled={savingPwd || !newPwd}>
                  {savingPwd ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Alterando…</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Alterar senha</>
                  )}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}