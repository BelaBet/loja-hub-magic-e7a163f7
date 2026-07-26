import bgClean from "@/assets/catalog-backgrounds/loja-clean-bege.jpg";
import bgUrban from "@/assets/catalog-backgrounds/loja-urban-style.jpg";
import bgMadeira from "@/assets/catalog-backgrounds/loja-madeira-natural.jpg";
import bgAtelie from "@/assets/catalog-backgrounds/loja-atelie-arco.jpg";
import bgDourada from "@/assets/catalog-backgrounds/loja-boutique-dourada.jpg";

export type BackgroundType =
  | "none"
  | "preset_1"
  | "preset_2"
  | "preset_3"
  | "preset_4"
  | "preset_5"
  | "preset_6"
  | "preset_7"
  | "preset_8"
  | "custom_image";

type PresetKey = Exclude<BackgroundType, "none" | "custom_image">;

type PresetGradient = { kind: "gradient"; label: string; css: string };
type PresetPhoto = { kind: "photo"; label: string; image: string };
type Preset = PresetGradient | PresetPhoto;

export const BACKGROUND_PRESETS: Record<PresetKey, Preset> = {
  preset_1: { kind: "gradient", label: "Gradiente vibrante", css: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  preset_2: { kind: "gradient", label: "Textura neutra", css: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" },
  preset_3: { kind: "gradient", label: "Dark premium", css: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  preset_4: { kind: "photo", label: "Boutique clean", image: bgClean },
  preset_5: { kind: "photo", label: "Urban style", image: bgUrban },
  preset_6: { kind: "photo", label: "Vitrine madeira", image: bgMadeira },
  preset_7: { kind: "photo", label: "Ateliê com arco", image: bgAtelie },
  preset_8: { kind: "photo", label: "Boutique dourada", image: bgDourada },
};

const isPresetKey = (type: BackgroundType): type is PresetKey =>
  type !== "none" && type !== "custom_image";

/** Fundos onde o conteúdo precisa de contraste extra (glass cards, texto branco): fotos e imagem própria. */
export const isDarkOrImageBackground = (type: BackgroundType) => {
  if (type === "custom_image") return true;
  if (isPresetKey(type)) return BACKGROUND_PRESETS[type].kind === "photo";
  return false;
};

export const isPhotoBackground = (type: BackgroundType) =>
  type === "custom_image" || (isPresetKey(type) && BACKGROUND_PRESETS[type].kind === "photo");

/**
 * Overlay recomendado ao selecionar um tipo de fundo. Para fotos (presets ou upload
 * próprio), aplica um véu fosco branco translúcido para as peças do catálogo ganharem
 * destaque sobre a imagem. Para gradientes, mantém um véu escuro discreto.
 */
export const defaultOverlayFor = (type: BackgroundType): { color: string; opacity: number } => {
  if (isPhotoBackground(type)) return { color: "#FFFFFF", opacity: 55 };
  return { color: "#000000", opacity: 40 };
};

