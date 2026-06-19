
-- =========================================================
-- 1) institutions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2) institution_usuarios (membros da rede)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.institution_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','network_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_usuarios TO authenticated;
GRANT ALL ON public.institution_usuarios TO service_role;

ALTER TABLE public.institution_usuarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_institution_usuarios_user ON public.institution_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_institution_usuarios_inst ON public.institution_usuarios(institution_id);

-- =========================================================
-- 3) lojas.institution_id
-- =========================================================
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lojas_institution ON public.lojas(institution_id);

-- =========================================================
-- 4) Helper functions (security definer)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_institution_owner(_inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institutions
    WHERE id = _inst AND owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_institution_access(_inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = _inst AND i.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.institution_usuarios m
      WHERE m.institution_id = _inst AND m.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_institutions()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.institutions WHERE owner_user_id = auth.uid()
  UNION
  SELECT institution_id FROM public.institution_usuarios WHERE user_id = auth.uid();
$$;

-- has_loja_network_access: true if user can read a loja via institution membership
CREATE OR REPLACE FUNCTION public.has_loja_network_access(_loja_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lojas l
    WHERE l.id = _loja_id
      AND l.institution_id IS NOT NULL
      AND public.has_institution_access(l.institution_id)
  );
$$;

-- =========================================================
-- 5) Policies: institutions
-- =========================================================
CREATE POLICY "Members can view their institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.has_institution_access(id));

CREATE POLICY "Authenticated users can create institutions"
  ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owner or super_admin can update institutions"
  ON public.institutions FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Owner or super_admin can delete institutions"
  ON public.institutions FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin());

-- =========================================================
-- 6) Policies: institution_usuarios
-- =========================================================
CREATE POLICY "Members can view their institution members"
  ON public.institution_usuarios FOR SELECT TO authenticated
  USING (public.has_institution_access(institution_id));

CREATE POLICY "Owner manages institution members - insert"
  ON public.institution_usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_institution_owner(institution_id) OR public.is_super_admin());

CREATE POLICY "Owner manages institution members - update"
  ON public.institution_usuarios FOR UPDATE TO authenticated
  USING (public.is_institution_owner(institution_id) OR public.is_super_admin())
  WITH CHECK (public.is_institution_owner(institution_id) OR public.is_super_admin());

CREATE POLICY "Owner manages institution members - delete"
  ON public.institution_usuarios FOR DELETE TO authenticated
  USING (public.is_institution_owner(institution_id) OR public.is_super_admin());

-- Anti self-escalation trigger
CREATE OR REPLACE FUNCTION public.institution_usuarios_protect_self()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_super_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' AND NEW.user_id = uid THEN
    RAISE EXCEPTION 'Users cannot insert their own institution membership';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id = uid THEN
      RAISE EXCEPTION 'Users cannot modify their own institution membership';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot reassign user_id on institution_usuarios';
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.user_id = uid THEN
    RAISE EXCEPTION 'Users cannot delete their own institution membership';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_institution_usuarios_protect_self
  BEFORE INSERT OR UPDATE OR DELETE ON public.institution_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.institution_usuarios_protect_self();

-- =========================================================
-- 7) Network read policies on lojas + dependent tables
-- =========================================================
CREATE POLICY "Network members can view linked lojas"
  ON public.lojas FOR SELECT TO authenticated
  USING (institution_id IS NOT NULL AND public.has_institution_access(institution_id));

CREATE POLICY "Network members can view vendas"
  ON public.vendas FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view venda_itens"
  ON public.venda_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.id = venda_itens.venda_id
      AND public.has_loja_network_access(v.loja_id)
  ));

CREATE POLICY "Network members can view produtos"
  ON public.produtos FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view estoque"
  ON public.estoque FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view movimentacoes_estoque"
  ON public.movimentacoes_estoque FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view recibos"
  ON public.recibos FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view notas_fiscais"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view cupons"
  ON public.cupons FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

CREATE POLICY "Network members can view maquininhas"
  ON public.maquininhas FOR SELECT TO authenticated
  USING (public.has_loja_network_access(loja_id));

-- =========================================================
-- 8) RPC: network_dashboard
-- =========================================================
CREATE OR REPLACE FUNCTION public.network_dashboard(_inst uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _from_ts timestamptz := _from::timestamptz;
  _to_ts   timestamptz := (_to + 1)::timestamptz;
  por_loja jsonb;
  totais jsonb;
  serie jsonb;
  ranking jsonb;
BEGIN
  IF NOT public.has_institution_access(_inst) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT l.id AS loja_id, l.nome,
           v.id AS venda_id, v.total, v.created_at::date AS dia
    FROM public.lojas l
    LEFT JOIN public.vendas v
      ON v.loja_id = l.id
     AND v.status = 'concluida'
     AND v.created_at >= _from_ts
     AND v.created_at < _to_ts
    WHERE l.institution_id = _inst
  ),
  agg_loja AS (
    SELECT loja_id, nome,
           COUNT(venda_id) AS vendas_count,
           COALESCE(SUM(total),0) AS faturamento_total,
           CASE WHEN COUNT(venda_id) > 0
                THEN COALESCE(SUM(total),0) / COUNT(venda_id)
                ELSE 0 END AS ticket_medio
    FROM base
    GROUP BY loja_id, nome
  ),
  agg_dia AS (
    SELECT dia, COALESCE(SUM(total),0) AS faturamento
    FROM base WHERE dia IS NOT NULL
    GROUP BY dia ORDER BY dia
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.faturamento_total DESC), '[]'::jsonb),
    jsonb_build_object(
      'vendas', COALESCE(SUM(a.vendas_count),0),
      'faturamento', COALESCE(SUM(a.faturamento_total),0),
      'ticket_medio', CASE WHEN COALESCE(SUM(a.vendas_count),0) > 0
                           THEN COALESCE(SUM(a.faturamento_total),0)/SUM(a.vendas_count)
                           ELSE 0 END,
      'num_lojas', COUNT(*)
    )
  INTO por_loja, totais
  FROM agg_loja a;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('data', dia, 'faturamento', faturamento) ORDER BY dia), '[]'::jsonb)
  INTO serie FROM (
    SELECT dia, COALESCE(SUM(total),0) AS faturamento
    FROM public.vendas v
    JOIN public.lojas l ON l.id = v.loja_id
    WHERE l.institution_id = _inst
      AND v.status = 'concluida'
      AND v.created_at >= _from_ts AND v.created_at < _to_ts
    GROUP BY v.created_at::date
  ) s(dia, total);

  ranking := jsonb_build_object(
    'top', (SELECT COALESCE(jsonb_agg(j),'[]'::jsonb)
            FROM (SELECT to_jsonb(a) j FROM jsonb_array_elements(por_loja) a LIMIT 5) t),
    'bottom', (SELECT COALESCE(jsonb_agg(j),'[]'::jsonb)
               FROM (SELECT to_jsonb(a) j FROM jsonb_array_elements(por_loja) a
                     ORDER BY (a->>'faturamento_total')::numeric ASC LIMIT 5) t)
  );

  RETURN jsonb_build_object(
    'por_loja', por_loja,
    'totais', totais,
    'serie_diaria', serie,
    'ranking', ranking,
    'periodo', jsonb_build_object('from', _from, 'to', _to)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.network_dashboard(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_institution_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_institutions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_loja_network_access(uuid) TO authenticated;
