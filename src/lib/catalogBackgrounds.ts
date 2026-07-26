export type BackgroundType = "none" | "preset_1" | "preset_2" | "preset_3" | "custom_image";

export const BACKGROUND_PRESETS: Record<
  Exclude<BackgroundType, "none" | "custom_image">,
  { label: string; css: string }
> = {
  preset_1: { label: "Gradiente vibrante", css: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  preset_2: { label: "Textura neutra", css: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" },
  preset_3: { label: "Dark premium", css: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
};

/** Fundos escuros/imagens onde o conteúdo precisa de contraste extra (glass cards, texto branco). */
export const isDarkOrImageBackground = (type: BackgroundType) =>
  type === "preset_3" || type === "custom_image";
