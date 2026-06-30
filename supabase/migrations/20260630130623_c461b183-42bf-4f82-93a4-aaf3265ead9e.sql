
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#16A34A',
  ADD COLUMN IF NOT EXISTS out_of_stock_behavior TEXT NOT NULL DEFAULT 'show_unavailable',
  ADD COLUMN IF NOT EXISTS banner_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_link_url TEXT;

ALTER TABLE public.lojas
  DROP CONSTRAINT IF EXISTS lojas_display_mode_check,
  ADD CONSTRAINT lojas_display_mode_check
    CHECK (display_mode IN ('list','grid','instaview'));

ALTER TABLE public.lojas
  DROP CONSTRAINT IF EXISTS lojas_oos_behavior_check,
  ADD CONSTRAINT lojas_oos_behavior_check
    CHECK (out_of_stock_behavior IN ('hide','show_unavailable','show_normal'));
