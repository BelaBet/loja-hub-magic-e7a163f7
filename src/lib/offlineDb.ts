import Dexie, { type Table } from "dexie";

export interface OfflineProduct {
  id: string;
  loja_id: string;
  ean: string | null;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  unidade_medida: string | null;
  fotos: string[] | null;
  estoque_qtd: number;
  synced_at: number;
}

export interface PendingSaleItem {
  produto_id: string;
  quantidade: number;
  preco_unit: number;
  desconto: number;
}

export interface PendingSale {
  id?: number;
  local_uuid: string;
  loja_id: string;
  total: number;
  forma_pagamento: string;
  coupon_code: string | null;
  coupon_discount: number;
  items: PendingSaleItem[];
  created_at: number;
  status: "pending_sync" | "syncing" | "synced" | "error" | "failed";
  last_error?: string;
  attempts?: number;
}

class OfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  pendingSales!: Table<PendingSale, number>;

  constructor() {
    super("pdv_offline");
    this.version(1).stores({
      products: "id, ean, loja_id",
      pendingSales: "++id, local_uuid, loja_id, status, created_at",
    });
  }
}

export const offlineDb = new OfflineDB();

export async function cacheProducts(lojaId: string, products: OfflineProduct[]) {
  await offlineDb.transaction("rw", offlineDb.products, async () => {
    await offlineDb.products.where("loja_id").equals(lojaId).delete();
    if (products.length) await offlineDb.products.bulkPut(products);
  });
}

export async function findProductByEan(lojaId: string, ean: string) {
  return offlineDb.products
    .where("ean")
    .equals(ean)
    .filter((p) => p.loja_id === lojaId)
    .first();
}

export async function queuePendingSale(sale: Omit<PendingSale, "id" | "status" | "created_at">) {
  return offlineDb.pendingSales.add({
    ...sale,
    status: "pending_sync",
    created_at: Date.now(),
  });
}

// Descarta permanentemente uma venda offline (ex.: caixa decidiu registrar
// manualmente após revisar o estoque, em vez de deixar tentando sincronizar).
export async function discardPendingSale(id: number) {
  await offlineDb.pendingSales.delete(id);
}

// Coloca a venda de volta na fila para uma nova tentativa manual de sync,
// zerando o contador de tentativas (usado quando o caixa já resolveu o
// problema, ex.: repôs o estoque).
export async function retryPendingSale(id: number) {
  await offlineDb.pendingSales.update(id, { status: "pending_sync", attempts: 0, last_error: undefined });
}