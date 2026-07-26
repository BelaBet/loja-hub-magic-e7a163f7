-- Expande background_type para incluir os 5 novos presets fotográficos (preset_4..preset_8)
ALTER TABLE public.lojas
  DROP CONSTRAINT IF EXISTS lojas_background_type_check,
  ADD CONSTRAINT lojas_background_type_check
    CHECK (background_type IN (
      'none','preset_1','preset_2','preset_3','preset_4','preset_5','preset_6','preset_7','preset_8','custom_image'
    ));
