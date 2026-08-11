GRANT SELECT ON public.vendas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.estoque TO service_role;