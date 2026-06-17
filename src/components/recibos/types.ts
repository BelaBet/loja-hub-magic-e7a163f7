export type FormaPagamento = "dinheiro" | "pix" | "credito" | "debito" | "boleto";
export type StatusRecibo = "pago" | "pendente" | "cancelado";
export type TemplateRecibo = "padrao" | "minimalista" | "dark";

export interface ReciboItem {
  produto: string;
  qtd: number;
  preco_unit: number;
  total: number;
}

export interface Recibo {
  id: string;
  loja_id: string;
  ano: number;
  numero_seq: number;
  numero_formatado: string;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  cliente_email: string | null;
  cliente_cpf: string | null;
  itens: ReciboItem[];
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento;
  valor_recebido: number | null;
  troco: number | null;
  observacao: string | null;
  status: StatusRecibo;
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
  enviado_whatsapp_em: string | null;
  enviado_email_em: string | null;
  visualizado_em: string | null;
  visualizacoes: number;
  created_at: string;
  updated_at: string;
}

export interface ReciboConfig {
  loja_id: string;
  template_ativo: TemplateRecibo;
  loja_nome_exibicao: string | null;
  loja_cnpj: string | null;
  loja_endereco: string | null;
  loja_telefone: string | null;
  loja_logo_url: string | null;
  mensagem_rodape: string;
  template_whatsapp: string;
  mostrar_logo: boolean;
  mostrar_endereco: boolean;
  mostrar_cnpj: boolean;
  mostrar_cpf_cliente: boolean;
  mostrar_troco: boolean;
  envio_automatico_whatsapp: boolean;
}

export const FORMA_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  boleto: "Boleto",
};