
-- 1) Prevent admins from modifying their own loja_usuarios row (self role escalation)
CREATE OR REPLACE FUNCTION public.loja_usuarios_protect_self()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- service_role / system context bypasses
  IF uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- super_admin can do anything
  IF public.is_super_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Block users from editing their own membership row
    IF OLD.user_id = uid THEN
      RAISE EXCEPTION 'Users cannot modify their own membership row';
    END IF;
    -- Block changing user_id (would re-target the row to someone else)
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot reassign user_id on loja_usuarios';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Prevent self-insertion (e.g., second row for self with elevated role)
    IF NEW.user_id = uid THEN
      RAISE EXCEPTION 'Users cannot insert their own membership row';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.user_id = uid THEN
      RAISE EXCEPTION 'Users cannot delete their own membership row';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS loja_usuarios_protect_self_trg ON public.loja_usuarios;
CREATE TRIGGER loja_usuarios_protect_self_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.loja_usuarios
FOR EACH ROW EXECUTE FUNCTION public.loja_usuarios_protect_self();

-- 2) Prevent non-super-admin from changing lojas.pagarme_recipient_id
CREATE OR REPLACE FUNCTION public.lojas_protect_pagarme_recipient()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- service_role / system context bypasses
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.pagarme_recipient_id IS DISTINCT FROM OLD.pagarme_recipient_id
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super_admin can change pagarme_recipient_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lojas_protect_pagarme_recipient_trg ON public.lojas;
CREATE TRIGGER lojas_protect_pagarme_recipient_trg
BEFORE UPDATE ON public.lojas
FOR EACH ROW EXECUTE FUNCTION public.lojas_protect_pagarme_recipient();
