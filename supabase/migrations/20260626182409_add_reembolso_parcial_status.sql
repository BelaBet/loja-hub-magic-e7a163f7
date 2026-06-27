-- Permite o status "reembolso_parcial" em vendas.pagamento_status.
-- Antes, o webhook tratava QUALQUER charge.refunded (parcial
-- ou total) como cancelamento da venda. Isso fazia vendas com reembolso
-- parcial aparecerem como "falhou" no painel, mesmo tendo sido pagas.
CREATE OR REPLACE FUNCTION public.validar_venda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if new.status not in ('rascunho','concluida','cancelada') then
    raise exception 'status inválido: %', new.status;
  end if;
  if new.forma_pagamento is not null
     and new.forma_pagamento not in ('dinheiro','pix','cartao_debito','cartao_credito','misto') then
    raise exception 'forma_pagamento inválida: %', new.forma_pagamento;
  end if;
  if new.pagamento_status not in ('pendente','pago','falhou','reembolso_parcial') then
    raise exception 'pagamento_status inválido: %', new.pagamento_status;
  end if;
  return new;
end;
$function$;
