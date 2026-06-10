export interface PDVProduct {
  id: string;
  ean: string | null;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  unidade_medida: string | null;
  fotos: string[] | null;
  estoque_qtd: number;
}

export interface PDVCartItem {
  product: PDVProduct;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface ScanEvent {
  code: string;
  timestamp: Date;
  found: boolean;
  product_name?: string;
}

export type PDVPayment = "dinheiro" | "pix" | "cartao_debito" | "cartao_credito";