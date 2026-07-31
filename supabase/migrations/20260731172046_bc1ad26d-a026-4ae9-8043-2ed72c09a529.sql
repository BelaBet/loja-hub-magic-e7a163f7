REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM anon, authenticated;
REVOKE SELECT ON public.webhook_logs FROM anon;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

DROP POLICY IF EXISTS webhook_logs_no_insert ON public.webhook_logs;
CREATE POLICY webhook_logs_no_insert ON public.webhook_logs
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS webhook_logs_no_update ON public.webhook_logs;
CREATE POLICY webhook_logs_no_update ON public.webhook_logs
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS webhook_logs_no_delete ON public.webhook_logs;
CREATE POLICY webhook_logs_no_delete ON public.webhook_logs
  FOR DELETE TO anon, authenticated USING (false);