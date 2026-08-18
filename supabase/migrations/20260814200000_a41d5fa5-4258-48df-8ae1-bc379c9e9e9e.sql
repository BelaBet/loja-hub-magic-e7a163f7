-- Permite super admin ver alertas_operacionais de QUALQUER loja (não só a
-- ativa no momento) — necessário pra tela /admin/alertas-tecnicos, que
-- centraliza os alertas técnicos (webhook, recipient) de toda a plataforma
-- num lugar só. Políticas de RLS são combinadas com OR, então isso amplia
-- o acesso sem afetar a policy já existente (admin/gerente da própria loja).
CREATE POLICY "super_admin_pode_ver_todos_alertas"
  ON public.alertas_operacionais FOR SELECT TO authenticated
  USING (public.is_super_admin());
