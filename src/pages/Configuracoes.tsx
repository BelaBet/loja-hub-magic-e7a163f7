import { useEffect, useState } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Settings, Store, CreditCard, ExternalLink, Receipt, Upload, X } from "lucide-react";
import { MaquininhasSection } from "@/components/configuracoes/MaquininhasSection";
import { brl } from "@/lib/format";

type LojaForm = {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  endereco: string;
  pagarme_recipient_id: string;
};

type ReciboConfig = {
  logo_url: string;
  cor_primaria: string;
  rodape: string;
  mostrar_cnpj: boolean;
  mostrar_endereco: boolean;
  mostrar_telefone: boolean;
};

const DEFAULT_RECIBO: ReciboConfig = {
  logo_url: "",
  cor_primaria: "#0ea5e9",
  rodape: "Obrigado pela preferência!",
  mostrar_cnpj: true,
  mostrar_endereco: true,
  mostrar_telefone: true,
};

const lojaSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120, "Máx. 120 caracteres"),
  email: z
    .string()
    .trim()
    .max(255, "Máx. 255 caracteres")
    .email("E-mail inválido")
    .or(z.literal("")),
  telefone: z.string().trim().max(20, "Máx. 20 caracteres"),
  cnpj: z.string().trim().max(18, "Máx. 18 caracteres"),
  endereco: z.string().trim().max(255, "Máx. 255 caracteres"),
  pagarme_recipient_id: z
    .string()
    .trim()
    .max(40, "Máx. 40 caracteres")
    .regex(/^(re_[a-zA-Z0-9]+)?$/, "Formato: re_xxxxxxxxxxxxxxxx (ou deixe vazio)"),
});

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [form, setForm] = useState<LojaForm>({
    nome: "",
    email: "",
    telefone: "",
    cnpj: "",
    endereco: "",
    pagarme_recipient_id: "",
  });
  const [recibo, setRecibo] = useState<ReciboConfig>(DEFAULT_RECIBO);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LojaForm, string>>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: loja, error } = await supabase
          .from("lojas")
          .select("id,nome,email,telefone,cnpj,pagarme_recipient_id,endereco,recibo_config")
          .maybeSingle();
        if (error) throw error;
        if (loja) {
          setLojaId(loja.id);
          setForm({
            nome: loja.nome ?? "",
            email: loja.email ?? "",
            telefone: loja.telefone ?? "",
            cnpj: loja.cnpj ?? "",
            endereco: (loja as any).endereco ?? "",
            pagarme_recipient_id: loja.pagarme_recipient_id ?? "",
          });
          const rc = ((loja as any).recibo_config ?? {}) as Partial<ReciboConfig>;
          setRecibo({ ...DEFAULT_RECIBO, ...rc });
          // has_loja_role('admin') — só admin pode editar
          const { data: isAdmin } = await supabase.rpc("has_loja_role", { _role: "admin" });
          setCanEdit(isAdmin === true);
        } else {
          toast.error("Loja não encontrada. Apenas administradores acessam esta página.");
        }
      } catch (e: any) {
        toast.error(`Erro ao carregar: ${e.message ?? e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof LojaForm>(key: K, value: LojaForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const updateRecibo = <K extends keyof ReciboConfig>(key: K, value: ReciboConfig[K]) => {
    setRecibo((r) => ({ ...r, [key]: value }));
  };

  const uploadLogo = async (file: File) => {
    if (!lojaId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${lojaId}/recibo-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("produtos").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (error) throw error;
      const { data } = supabase.storage.from("produtos").getPublicUrl(path);
      updateRecibo("logo_url", data.publicUrl);
      toast.success("Logo enviada");
    } catch (e: any) {
      toast.error(`Erro no upload: ${e.message ?? e}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const salvar = async () => {
    const parsed = lojaSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof LojaForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof LojaForm;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Corrija os campos destacados");
      return;
    }
    if (!lojaId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lojas")
        .update({
          nome: parsed.data.nome,
          email: parsed.data.email || null,
          telefone: parsed.data.telefone || null,
          cnpj: parsed.data.cnpj || null,
          endereco: parsed.data.endereco || null,
          pagarme_recipient_id: parsed.data.pagarme_recipient_id || null,
          recibo_config: recibo,
        } as any)
        .eq("id", lojaId);
      if (error) throw error;
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground">Dados da loja e integrações</p>
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
            {!canEdit && (
              <Card className="p-4 border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 text-sm">
                Apenas administradores podem editar essas configurações. Você pode visualizar, mas não salvar.
              </Card>
            )}

            {/* Dados da loja */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Dados da loja</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="nome">Nome da loja *</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => update("nome", e.target.value)}
                    disabled={!canEdit}
                    maxLength={120}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    disabled={!canEdit}
                    maxLength={255}
                    placeholder="contato@loja.com"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) => update("telefone", e.target.value)}
                    disabled={!canEdit}
                    maxLength={20}
                    placeholder="(11) 99999-9999"
                    className={errors.telefone ? "border-destructive" : ""}
                  />
                  {errors.telefone && <p className="text-xs text-destructive mt-1">{errors.telefone}</p>}
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={form.cnpj}
                    onChange={(e) => update("cnpj", e.target.value)}
                    disabled={!canEdit}
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    className={`mono ${errors.cnpj ? "border-destructive" : ""}`}
                  />
                  {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj}</p>}
                </div>
              </div>
            </Card>

            {/* Pagar.me */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">Pagar.me — Split de pagamentos</h2>
                </div>
                {form.pagarme_recipient_id ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">Configurado</Badge>
                ) : (
                  <Badge variant="outline">Não configurado</Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Informe o <strong>Recipient ID</strong> da sua loja no Pagar.me para que os pagamentos sejam divididos
                automaticamente entre a plataforma e a sua conta. Sem ele, o valor vai integralmente para a conta principal.
              </p>

              <div>
                <Label htmlFor="recipient">Recipient ID (re_xxxxxxxxxxxxxxxx)</Label>
                <Input
                  id="recipient"
                  value={form.pagarme_recipient_id}
                  onChange={(e) => update("pagarme_recipient_id", e.target.value.trim())}
                  disabled={!canEdit}
                  maxLength={40}
                  placeholder="re_xxxxxxxxxxxxxxxx"
                  className={`mono ${errors.pagarme_recipient_id ? "border-destructive" : ""}`}
                />
                {errors.pagarme_recipient_id && (
                  <p className="text-xs text-destructive mt-1">{errors.pagarme_recipient_id}</p>
                )}
                <a
                  href="https://dashboard.pagar.me/#/recebedores"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  Onde encontro meu Recipient ID? <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Card>

            {/* Maquininhas */}
            <MaquininhasSection canEdit={canEdit} />

            {/* Personalização do recibo */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Personalização do Recibo</h2>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                        {recibo.logo_url ? (
                          <img src={recibo.logo_url} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <Receipt className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="inline-flex">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={!canEdit || uploadingLogo}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadLogo(f);
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                          <Button asChild variant="outline" size="sm" disabled={!canEdit || uploadingLogo}>
                            <span>
                              {uploadingLogo ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Enviando…</>
                              ) : (
                                <><Upload className="h-3.5 w-3.5 mr-1.5" /> Enviar logo</>
                              )}
                            </span>
                          </Button>
                        </label>
                        {recibo.logo_url && (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => updateRecibo("logo_url", "")}
                            className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 w-fit"
                          >
                            <X className="h-3 w-3" /> Remover
                          </button>
                        )}
                        <p className="text-xs text-muted-foreground">PNG/JPG até 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cor-primaria">Cor primária</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(recibo.cor_primaria) ? recibo.cor_primaria : "#0ea5e9"}
                        onChange={(e) => updateRecibo("cor_primaria", e.target.value)}
                        disabled={!canEdit}
                        className="h-10 w-12 rounded border cursor-pointer disabled:cursor-not-allowed"
                      />
                      <Input
                        id="cor-primaria"
                        value={recibo.cor_primaria}
                        onChange={(e) => updateRecibo("cor_primaria", e.target.value)}
                        disabled={!canEdit}
                        maxLength={7}
                        placeholder="#0ea5e9"
                        className="mono"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={form.endereco}
                      onChange={(e) => update("endereco", e.target.value)}
                      disabled={!canEdit}
                      maxLength={255}
                      placeholder="Rua, número — Bairro, Cidade/UF"
                      className={errors.endereco ? "border-destructive" : ""}
                    />
                    {errors.endereco && <p className="text-xs text-destructive mt-1">{errors.endereco}</p>}
                  </div>

                  <div>
                    <Label htmlFor="rodape">Mensagem de rodapé</Label>
                    <Textarea
                      id="rodape"
                      value={recibo.rodape}
                      onChange={(e) => updateRecibo("rodape", e.target.value.slice(0, 200))}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Obrigado pela preferência!"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{recibo.rodape.length}/200</p>
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Exibir no recibo
                    </p>
                    {([
                      ["mostrar_cnpj", "CNPJ"],
                      ["mostrar_endereco", "Endereço"],
                      ["mostrar_telefone", "Telefone"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={key} className="font-normal cursor-pointer">{label}</Label>
                        <Switch
                          id={key}
                          checked={recibo[key]}
                          onCheckedChange={(v) => updateRecibo(key, v)}
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Preview
                  </p>
                  <ReciboPreview
                    loja={{
                      nome: form.nome || "Minha Loja",
                      cnpj: form.cnpj,
                      telefone: form.telefone,
                      endereco: form.endereco,
                    }}
                    config={recibo}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-2 sticky bottom-4">
              <Button
                onClick={salvar}
                disabled={!canEdit || saving}
                size="lg"
                className="shadow-lg"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Salvar alterações</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}