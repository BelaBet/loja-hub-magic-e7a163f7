# Payment API contract

## `create-order`

**Métodos:** `pix`, `credit_card`, `debit_card`

### Entrada principal

- `payment_method`: método de pagamento.
- `amount`: valor em centavos.
- `customer`: dados do pagador, incluindo endereço.
- `venda_id`: identificador opcional da venda.
- `items`: itens opcionais.
- `card`: obrigatório para crédito/débito.
- `pass_surcharge_to_customer`: controla o repasse de taxas/sobretaxa.

### Saída principal

- `order_id`
- `status`
- `charge_status`
- `amount`
- `base_amount`
- `platform_amount`
- `seller_amount`
- `split_applied`
- dados PIX quando aplicável
- dados da transação de cartão quando aplicável

## `check-order-status`

Consulta o estado da venda/pedido no backend e é usado pelo modal de PIX para confirmar o pagamento antes de concluir a venda.

## `create-pos-order`

Fluxo de pagamento para terminal/maquininha.

## `check-pos-order-status`

Consulta o resultado de uma transação POS.

## `create-payment-link`

Cria um link de pagamento para cobrança fora do fluxo principal do checkout.

## Regras importantes

1. O valor monetário deve ser enviado em centavos.
2. Parcelamento é limitado a 12 parcelas no fluxo de crédito atual.
3. PIX não deve marcar uma venda como paga apenas porque o QR Code foi criado.
4. A confirmação deve vir do status real do gateway/backend.
5. O split usa recipient da plataforma e recipient da loja quando configurados.
6. Credenciais privadas nunca são retornadas ao cliente.
7. O backend valida o usuário autenticado antes de criar o pedido.