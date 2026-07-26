ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS background_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS background_image_url TEXT,
  ADD COLUMN IF NOT EXISTS overlay_color TEXT NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS overlay_opacity INTEGER NOT NULL DEFAULT 40;

ALTER TABLE public.lojas
  DROP CONSTRAINT IF EXISTS lojas_background_type_check;
ALTER TABLE public.lojas
  ADD CONSTRAINT lojas_background_type_check
    CHECK (background_type IN ('none','preset_1','preset_2','preset_3','custom_image'));

ALTER TABLE public.lojas
  DROP CONSTRAINT IF EXISTS lojas_overlay_opacity_check;
ALTER TABLE public.lojas
  ADD CONSTRAINT lojas_overlay_opacity_check
    CHECK (overlay_opacity >= 0 AND overlay_opacity <= 80);