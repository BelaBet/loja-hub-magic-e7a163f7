# Payment Kit

Módulo reutilizável de pagamentos extraído do Loja Hub.

## API disponível

A camada de backend existente usa Supabase Edge Functions e Pagar.me:

- `create-order` — cria cobrança PIX, crédito ou débito.
- `check-order-status` — consulta o status real da cobrança.
- `create-pos-order` — fluxo de cobrança para POS/maquininha.
- `check-pos-order-status` — consulta o status de cobranças POS.
- `create-payment-link` — cria links de pagamento.

## Modais reutilizáveis

- `PagarmeCheckoutModal.tsx` — PIX, crédito e débito.
- `PDVMaquininhaModal.tsx` — fluxo de maquininha/POS.
- `PaymentLinkModal.tsx` — criação/uso de link de pagamento.

## Integração

O sistema consumidor deve chamar as Edge Functions pelo cliente Supabase autenticado. As credenciais secretas do Pagar.me permanecem somente no backend.

## Segurança

Nunca coloque `PAGARME_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend. O arquivo `.env` não deve ser versionado; use `.env.example` como referência.

## Status

Esta primeira etapa documenta e isola o contrato de pagamentos sem apagar o sistema original. A próxima etapa é transformar os componentes em um pacote de integração independente, removendo dependências específicas do PDV quando elas não forem necessárias.