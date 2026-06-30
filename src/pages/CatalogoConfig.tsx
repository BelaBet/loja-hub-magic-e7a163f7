import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { Check, ImageIcon, ShoppingCart, Upload, Loader2, List, Grid3x3, Smartphone } from "lucide-react";
import { brl } from "@/lib/format";

type DisplayMode = "list" | "grid" | "instaview";
type OOSBehavior = "hide" | "show_unavailable" | "show_normal";

type Config = {
  display_mode: DisplayMode;
  accent_color: string;
  out_of_stock_behavior: OOSBehavior;
  banner_enabled: boolean;
  banner_image_url: string | null;
  banner_link_url: string | null;
};

const COLOR_SUGGESTIONS = [
  "#FACC15", "#F97316", "#EF4444", "#A855F7", "#38BDF8",
  "#1E3A8A", "#374151", "#000000", "#16A34A",
];

const DEFAULTS: Config = {
  display_mode: "grid",
  accent_color: "#16A34A",
  out_of_stock_behavior: "show_unavailable",
  banner_enabled: false,
  banner_image_url: null,
  banner_link_url: null,
};

const TAB_BY_SECTION: Record<string, string> = {
  exibicao: "exibicao",
  cor: "cor",
  estoque: "estoque",
  banner: "banner",
};

export default function CatalogoConfig() {
  const { section } = useParams<{ section?: string }>();
  const tabDefault = (section && TAB_BY_SECTION[section]) || "exibicao";
  const { lojaAtivaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [original, setOriginal] = useState<Config>(DEFAULTS);

  useEffect(() => {
    if (!lojaAtivaId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lojas")
        .select("display_mode, accent_color, out_of_stock_behavior, banner_enabled, banner_image_url, banner_link_url")
        .eq("id", lojaAtivaId)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar configurações");
      const merged: Config = { ...DEFAULTS, ...(data ?? {}) } as Config;
      setCfg(merged);
      setOriginal(merged);
      setLoading(false);
    })();
  }, [lojaAtivaId]);

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(original), [cfg, original]);

  const save = async () => {
    if (!lojaAtivaId) return;
    setSaving(true);
    const { error } = await supabase.from("lojas").update(cfg).eq("id", lojaAtivaId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    setOriginal(cfg);
    toast.success("Configurações salvas");
  };

  const onBannerFile = async (file: File) => {
    if (!lojaAtivaId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `banners/${lojaAtivaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploading(false);
      toast.error("Falha no upload");
      return;
    }
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    setCfg((c) => ({ ...c, banner_image_url: data.publicUrl }));
    setUploading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <header>
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Catálogo</p>
          <h1 className="font-display text-2xl font-bold">Personalização do catálogo público</h1>
        </header>

        <Tabs defaultValue={tabDefault} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="exibicao">Modo de exibição</TabsTrigger>
            <TabsTrigger value="cor">Cor principal</TabsTrigger>
            <TabsTrigger value="estoque">Sem estoque</TabsTrigger>
            <TabsTrigger value="banner">Banner</TabsTrigger>
          </TabsList>

          {/* MODO DE EXIBIÇÃO */}
          <TabsContent value="exibicao">
            <Card className="p-5 space-y-5">
              <DisplayModePreview mode={cfg.display_mode} accent={cfg.accent_color} />
              <RadioGroup
                value={cfg.display_mode}
                onValueChange={(v) => setCfg((c) => ({ ...c, display_mode: v as DisplayMode }))}
                className="space-y-3"
              >
                <OptionCard value="list" title="Lista" icon={<List className="h-4 w-4" />}
                  desc="Produtos empilhados, foto pequena à esquerda. Navegação mais rápida." />
                <OptionCard value="grid" title="Grade" icon={<Grid3x3 className="h-4 w-4" />}
                  desc="Cards em 2/3 colunas com foto grande no topo. Ideal para muitos produtos com fotos." />
                <OptionCard value="instaview" title="Instaview" icon={<Smartphone className="h-4 w-4" />}
                  desc="Um card por vez ocupando a tela, estilo Instagram. Para fotos bem produzidas." />
              </RadioGroup>
            </Card>
          </TabsContent>

          {/* COR PRINCIPAL */}
          <TabsContent value="cor">
            <Card className="p-5 space-y-5">
              <ColorPreview accent={cfg.accent_color} />
              <Tabs defaultValue="sugestoes">
                <TabsList>
                  <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
                  <TabsTrigger value="personalizada">Personalizada</TabsTrigger>
                </TabsList>
                <TabsContent value="sugestoes" className="pt-4">
                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-3">
                    {COLOR_SUGGESTIONS.map((color) => {
                      const active = cfg.accent_color.toUpperCase() === color.toUpperCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCfg((c) => ({ ...c, accent_color: color }))}
                          className="aspect-square rounded-lg flex items-center justify-center transition-transform hover:scale-105 ring-offset-background"
                          style={{ background: color, outline: active ? "2px solid hsl(var(--ring))" : undefined, outlineOffset: 2 }}
                          aria-label={`Cor ${color}`}
                        >
                          {active && <Check className="h-5 w-5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="personalizada" className="pt-4 space-y-3">
                  <Label>Cor personalizada</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cfg.accent_color}
                      onChange={(e) => setCfg((c) => ({ ...c, accent_color: e.target.value }))}
                      className="h-12 w-16 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={cfg.accent_color}
                      onChange={(e) => setCfg((c) => ({ ...c, accent_color: e.target.value }))}
                      placeholder="#16A34A"
                      className="font-mono uppercase max-w-[140px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          {/* SEM ESTOQUE */}
          <TabsContent value="estoque">
            <Card className="p-5">
              <RadioGroup
                value={cfg.out_of_stock_behavior}
                onValueChange={(v) => setCfg((c) => ({ ...c, out_of_stock_behavior: v as OOSBehavior }))}
                className="space-y-3"
              >
                <OptionCard value="hide" title="Não exibir no catálogo"
                  desc="Produtos com estoque zerado ficam ocultos da vitrine." />
                <OptionCard value="show_unavailable" title="Exibir como indisponível"
                  desc="Produto aparece com aparência reduzida, badge 'Esgotado' e botão desabilitado." />
                <OptionCard value="show_normal" title="Exibir normalmente"
                  desc="Produto aparece sem distinção visual (permite venda sob encomenda)." />
              </RadioGroup>
            </Card>
          </TabsContent>

          {/* BANNER */}
          <TabsContent value="banner">
            <Card className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-base">Ativar banner no catálogo</Label>
                  <p className="text-sm text-muted-foreground">Exibe a imagem no topo da vitrine pública.</p>
                </div>
                <Switch
                  checked={cfg.banner_enabled}
                  onCheckedChange={(v) => setCfg((c) => ({ ...c, banner_enabled: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Imagem do banner</Label>
                <p className="text-xs text-muted-foreground">Recomendado: 1200x400px (formato wide).</p>
                <div className="aspect-[3/1] w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center border">
                  {cfg.banner_image_url ? (
                    <img src={cfg.banner_image_url} alt="Banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mx-auto opacity-40" />
                      <p className="text-sm mt-2">Nenhuma imagem</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" disabled={uploading}>
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {cfg.banner_image_url ? "Trocar imagem" : "Enviar imagem"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && onBannerFile(e.target.files[0])}
                      />
                    </label>
                  </Button>
                  {cfg.banner_image_url && (
                    <Button variant="ghost" onClick={() => setCfg((c) => ({ ...c, banner_image_url: null }))}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner_link">Link de destino (opcional)</Label>
                <Input
                  id="banner_link"
                  placeholder="https://wa.me/55... ou uma URL externa"
                  value={cfg.banner_link_url ?? ""}
                  onChange={(e) => setCfg((c) => ({ ...c, banner_link_url: e.target.value || null }))}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 px-4 py-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCfg(original)} disabled={!dirty || saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!dirty || saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function OptionCard({ value, title, desc, icon }: { value: string; title: string; desc: string; icon?: React.ReactNode }) {
  return (
    <label
      htmlFor={`opt-${value}`}
      className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent/40 transition-colors"
    >
      <RadioGroupItem id={`opt-${value}`} value={value} className="mt-1" />
      <div className="flex-1">
        <div className="font-semibold flex items-center gap-2">{icon}{title}</div>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    </label>
  );
}

function DisplayModePreview({ mode, accent }: { mode: DisplayMode; accent: string }) {
  if (mode === "list") {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 bg-background rounded p-2 border">
            <div className="h-12 w-12 rounded bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-2 w-2/3 rounded bg-muted" />
              <div className="h-2 w-1/3 rounded" style={{ background: accent }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (mode === "instaview") {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 flex justify-center">
        <div className="w-40 bg-background border rounded-lg overflow-hidden">
          <div className="h-40 bg-muted" />
          <div className="p-2 space-y-1">
            <div className="h-2 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/3 rounded" style={{ background: accent }} />
            <div className="h-6 rounded mt-2" style={{ background: accent }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-background border rounded p-1">
          <div className="aspect-square bg-muted rounded" />
          <div className="h-2 w-3/4 mt-1 rounded bg-muted" />
          <div className="h-2 w-1/2 mt-1 rounded" style={{ background: accent }} />
        </div>
      ))}
    </div>
  );
}

function ColorPreview({ accent }: { accent: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 flex justify-center">
      <div className="w-56 bg-background border rounded-lg overflow-hidden shadow-sm">
        <div className="relative h-32 bg-muted">
          <span
            className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded text-white"
            style={{ background: accent }}
          >
            -10%
          </span>
        </div>
        <div className="p-3 space-y-2">
          <div className="text-sm font-semibold">Produto exemplo</div>
          <div className="num text-xl font-bold" style={{ color: accent }}>{brl(89.9)}</div>
          <Button className="w-full h-9 text-white hover:opacity-90" style={{ background: accent }}>
            <ShoppingCart className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}