-- Habilita Realtime em alertas_operacionais para o sino de notificações no
-- header (AlertsBell) atualizar sem precisar recarregar a página.
ALTER TABLE public.alertas_operacionais REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_operacionais;
