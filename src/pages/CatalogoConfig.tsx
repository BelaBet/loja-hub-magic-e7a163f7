import { traduzErro } from "@/lib/errors";
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
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { Check, ImageIcon, ShoppingCart, Upload, Loader2, List, Grid3x3, Smartphone, X, Image as ImageBgIcon } from "lucide-react";
import { brl } from "@/lib/format";
import { BACKGROUND_PRESETS, defaultOverlayFor, type BackgroundType } from "@/lib/catalogBackgrounds";

type DisplayMode = "list" | "grid" | "instaview";
type OOSBehavior = "hide" | "show_unavailable" | "show_normal";

type Config = {
  display_mode: DisplayMode;
  accent_color: string;
  out_of_stock_behavior: OOSBehavior;
  banner_enabled: boolean;
  banner_image_url: string | null;
  banner_link_url: string | null;
  background_type: BackgroundType;
  background_image_url: string | null;
  overlay_color: string;
  overlay_opacity: number;
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
  background_type: "none",
  background_image_url: null,
  overlay_color: "#000000",
  overlay_opacity: 40,
};

const TAB_BY_SECTION: Record<string, string> = {
  exibicao: "exibicao",
  cor: "cor",
  estoque: "estoque",
  banner: "banner",
  fundo: "fundo",
};

const presetEntries = Object.entries(BACKGROUND_PRESETS) as [
  Exclude<BackgroundType, "none" | "custom_image">,
  (typeof BACKGROUND_PRESETS)[keyof typeof BACKGROUND_PRESETS],
][];
const gradientPresets = presetEntries.filter(([, p]) => p.kind === "gradient") as [
  Exclude<BackgroundType, "none" | "custom_image">,
  { kind: "gradient"; label: string; css: string },
][];
const photoPresets = presetEntries.filter(([, p]) => p.kind === "photo") as [
  Exclude<BackgroundType, "none" | "custom_image">,
  { kind: "photo"; label: string; image: string },
][];

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
        .select("display_mode, accent_color, out_of_stock_behavior, banner_enabled, banner_image_url, banner_link_url, background_type, background_image_url, overlay_color, overlay_opacity")
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
    const path = `${lojaAtivaId}/banners/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploading(false);
      toast.error(traduzErro(error, "Falha no upload"));
      return;
    }
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    setCfg((c) => ({ ...c, banner_image_url: data.publicUrl }));
    setUploading(false);
  };

  const [uploadingBg, setUploadingBg] = useState(false);

  const onBackgroundFile = async (file: File) => {
    if (!lojaAtivaId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploadingBg(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${lojaAtivaId}/backgrounds/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploadingBg(false);
      toast.error(traduzErro(error, "Falha no upload"));
      return;
    }
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    setCfg((c) => ({
      ...c,
      background_type: "custom_image",
      background_image_url: data.publicUrl,
      ...defaultOverlayFor("custom_image"),
    }));
    setUploadingBg(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <header>
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Catálogo</p>
          <h1 className="font-display text-2xl font-bold">Personalização do catálogo público</h1>
        </header>

        <Tabs defaultValue={tabDefault} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="exibicao">Modo de exibição</TabsTrigger>
            <TabsTrigger value="cor">Cor principal</TabsTrigger>
            <TabsTrigger value="estoque">Sem estoque</TabsTrigger>
            <TabsTrigger value="banner">Banner</TabsTrigger>
            <TabsTrigger value="fundo">Plano de fundo</TabsTrigger>
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

          {/* PLANO DE FUNDO */}
          <TabsContent value="fundo">
            <Card className="p-5 space-y-6">
              <BackgroundPreview
                type={cfg.background_type}
                imageUrl={cfg.background_image_url}
                overlayColor={cfg.overlay_color}
                overlayOpacity={cfg.overlay_opacity}
              />

              <div className="space-y-3">
                <Label className="text-base">Plano de fundo</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setCfg((c) => ({ ...c, background_type: "none" }))}
                    className="h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1 bg-white text-muted-foreground transition-colors"
                    style={{ borderColor: cfg.background_type === "none" ? "hsl(var(--primary))" : undefined }}
                  >
                    {cfg.background_type === "none" && <Check className="h-4 w-4 text-foreground" />}
                    <span className="text-xs font-medium">Nenhum</span>
                  </button>
                  {gradientPresets.map(([key, preset]) => (
                    <PresetTile
                      key={key}
                      selected={cfg.background_type === key}
                      style={{ background: preset.css }}
                      label={preset.label}
                      onClick={() =>
                        setCfg((c) => ({ ...c, background_type: key, background_image_url: null, ...defaultOverlayFor(key) }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">Fotos de ambientes de loja</Label>
                <p className="text-xs text-muted-foreground">
                  Imagens prontas de vitrines e provadores. Um véu fosco é aplicado por cima automaticamente para as peças do catálogo se destacarem.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {photoPresets.map(([key, preset]) => (
                    <PresetTile
                      key={key}
                      selected={cfg.background_type === key}
                      style={{ backgroundImage: `url(${preset.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
                      label={preset.label}
                      onClick={() =>
                        setCfg((c) => ({ ...c, background_type: key, background_image_url: null, ...defaultOverlayFor(key) }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Ou envie uma imagem própria</Label>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máximo 5MB.</p>
                {cfg.background_type === "custom_image" && cfg.background_image_url ? (
                  <div className="relative rounded-lg overflow-hidden border aspect-[16/9] bg-muted">
                    <img src={cfg.background_image_url} alt="Fundo" className="h-full w-full object-cover" />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => setCfg((c) => ({ ...c, background_type: "none", background_image_url: null }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button asChild variant="outline" disabled={uploadingBg}>
                    <label className="cursor-pointer">
                      {uploadingBg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Escolher imagem
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && onBackgroundFile(e.target.files[0])}
                      />
                    </label>
                  </Button>
                )}
              </div>

              {cfg.background_type !== "none" && (
                <div className="space-y-5 pt-2 border-t">
                  <p className="text-sm font-medium pt-4">Ajustes da imagem</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Opacidade do overlay</Label>
                      <span className="mono text-xs text-muted-foreground">{cfg.overlay_opacity}%</span>
                    </div>
                    <div className="py-3 -my-3">
                      <Slider
                        value={[cfg.overlay_opacity]}
                        onValueChange={([v]) => setCfg((c) => ({ ...c, overlay_opacity: v }))}
                        min={0}
                        max={80}
                        step={1}
                        className="[&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:touch-none py-[13px]"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O overlay escurece (ou clareia) o fundo para garantir que o texto fique legível.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor do overlay</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={cfg.overlay_color}
                        onChange={(e) => setCfg((c) => ({ ...c, overlay_color: e.target.value }))}
                        className="h-12 w-16 rounded-lg border cursor-pointer"
                      />
                      <Input
                        value={cfg.overlay_color}
                        onChange={(e) => setCfg((c) => ({ ...c, overlay_color: e.target.value }))}
                        placeholder="#000000"
                        className="font-mono uppercase max-w-[140px]"
                      />
                    </div>
                  </div>
                </div>
              )}
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

function PresetTile({
  selected,
  style,
  label,
  onClick,
}: {
  selected: boolean;
  style: React.CSSProperties;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-20 rounded-lg border-2 flex items-end justify-start p-2 relative overflow-hidden transition-transform hover:scale-[1.02]"
      style={{ ...style, borderColor: selected ? "hsl(var(--primary))" : "transparent" }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
      {selected && (
        <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center z-10">
          <Check className="h-3 w-3 text-foreground" />
        </span>
      )}
      <span className="relative z-10 text-[11px] font-semibold text-white drop-shadow">{label}</span>
    </button>
  );
}

function BackgroundPreview({
  type,
  imageUrl,
  overlayColor,
  overlayOpacity,
}: {
  type: BackgroundType;
  imageUrl: string | null;
  overlayColor: string;
  overlayOpacity: number;
}) {
  const preset = type !== "none" && type !== "custom_image" ? BACKGROUND_PRESETS[type] : undefined;
  const bg = preset?.kind === "gradient" ? preset.css : undefined;
  const previewImage = type === "custom_image" ? imageUrl : preset?.kind === "photo" ? preset.image : null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 flex justify-center">
      <div className="relative w-full max-w-xs aspect-[9/16] rounded-xl overflow-hidden border shadow-sm bg-white">
        {type === "none" ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageBgIcon className="h-8 w-8 opacity-30" />
            <span className="text-xs">Catálogo sem fundo</span>
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: bg,
                backgroundImage: previewImage ? `url(${previewImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }}
            />
            <div className="absolute inset-0 flex flex-col p-3 gap-2">
              <div className="h-8 rounded-md bg-white/25 backdrop-blur-sm" />
              <div className="flex-1 grid grid-cols-2 gap-2 mt-2">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-lg bg-white/90 backdrop-blur-sm p-2">
                    <div className="aspect-square rounded bg-muted" />
                    <div className="h-2 w-3/4 mt-2 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
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