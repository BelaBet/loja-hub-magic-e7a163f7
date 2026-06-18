import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import type {
  Recibo,
  ReciboConfig,
  ReciboItem,
  FormaPagamento,
} from "@/components/recibos/types";

const DEFAULT_CONFIG = (lojaId: string): ReciboConfig => ({
  loja_id: lojaId,
  template_ativo: "padrao",
  loja_nome_exibicao: null,
  loja_cnpj: null,
  loja_endereco: null,
  loja_telefone: null,
  loja_logo_url: null,
  mensagem_rodape: "Obrigado pela preferência!",
  template_whatsapp:
    "Olá {nome}! Segue seu recibo {numero} no valor de {total} ({forma}). Acesse: {link}",
  mostrar_logo: true,
  mostrar_endereco: true,
  mostrar_cnpj: true,
  mostrar_cpf_cliente: true,
  mostrar_troco: true,
  envio_automatico_whatsapp: false,
});

function mapRecibo(row: Record<string, unknown>): Recibo {
  return {
    ...(row as unknown as Recibo),
    itens: Array.isArray(row.itens) ? (row.itens as ReciboItem[]) : [],
    subtotal: Number(row.subtotal ?? 0),
    desconto: Number(row.desconto ?? 0),
    total: Number(row.total ?? 0),
    valor_recebido: row.valor_recebido != null ? Number(row.valor_recebido) : null,
    troco: row.troco != null ? Number(row.troco) : null,
  };
}

export interface RecibosFiltros {
  busca?: string;
  status?: "todos" | "pago" | "pendente" | "cancelado";
  periodo?: "hoje" | "semana" | "mes" | "todos";
}

export function useRecibos(filtros: RecibosFiltros = {}) {
  const { lojaAtivaId } = useLoja();
  return useQuery({
    queryKey: ["recibos", lojaAtivaId, filtros],
    enabled: !!lojaAtivaId,
    queryFn: async () => {
      let q = supabase.from("recibos").select("*").order("created_at", { ascending: false });
      if (filtros.status && filtros.status !== "todos") q = q.eq("status", filtros.status);
      const now = new Date();
      if (filtros.periodo === "hoje") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        q = q.gte("created_at", start.toISOString());
      } else if (filtros.periodo === "semana") {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        q = q.gte("created_at", start.toISOString());
      } else if (filtros.periodo === "mes") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        q = q.gte("created_at", start.toISOString());
      }
      if (filtros.busca && filtros.busca.trim()) {
        const t = filtros.busca.trim();
        const orParts: string[] = [`numero_formatado.ilike.%${t}%`, `cliente_nome.ilike.%${t}%`];
        const asNumber = Number(t.replace(",", "."));
        if (!Number.isNaN(asNumber)) orParts.push(`total.eq.${asNumber}`);
        q = q.or(orParts.join(","));
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => mapRecibo(r as Record<string, unknown>));
    },
  });
}

export function useRecibo(id: string | undefined) {
  return useQuery({
    queryKey: ["recibo", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("recibos").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? mapRecibo(data as Record<string, unknown>) : null;
    },
  });
}

export function useReciboConfig() {
  const { lojaAtivaId } = useLoja();
  return useQuery({
    queryKey: ["recibo-config", lojaAtivaId],
    enabled: !!lojaAtivaId,
    queryFn: async (): Promise<ReciboConfig> => {
      const { data, error } = await supabase
        .from("recibos_config")
        .select("*")
        .eq("loja_id", lojaAtivaId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: loja } = await supabase
          .from("lojas")
          .select("nome,cnpj,endereco,telefone,logo_url")
          .eq("id", lojaAtivaId!)
          .maybeSingle();
        const def = DEFAULT_CONFIG(lojaAtivaId!);
        if (loja) {
          def.loja_nome_exibicao = loja.nome ?? null;
          def.loja_cnpj = loja.cnpj ?? null;
          def.loja_endereco = loja.endereco ?? null;
          def.loja_telefone = loja.telefone ?? null;
          def.loja_logo_url = loja.logo_url ?? null;
        }
        return def;
      }
      return data as unknown as ReciboConfig;
    },
  });
}

export function useUpdateReciboConfig() {
  const { lojaAtivaId } = useLoja();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: Partial<ReciboConfig>) => {
      if (!lojaAtivaId) throw new Error("loja não selecionada");
      const { data, error } = await supabase
        .from("recibos_config")
        .upsert(
          { ...DEFAULT_CONFIG(lojaAtivaId), ...cfg, loja_id: lojaAtivaId },
          { onConflict: "loja_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as ReciboConfig;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recibo-config", lojaAtivaId] }),
  });
}

export interface CreateReciboInput {
  cliente_nome: string;
  cliente_whatsapp?: string | null;
  cliente_email?: string | null;
  cliente_cpf?: string | null;
  itens: ReciboItem[];
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento;
  valor_recebido?: number | null;
  troco?: number | null;
  observacao?: string | null;
}

export function useCreateRecibo() {
  const { lojaAtivaId } = useLoja();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReciboInput) => {
      if (!lojaAtivaId) throw new Error("loja não selecionada");
      const { data, error } = await supabase
        .from("recibos")
        .insert({
          loja_id: lojaAtivaId,
          ano: 0,
          numero_seq: 0,
          numero_formatado: "",
          cliente_nome: input.cliente_nome,
          cliente_whatsapp: input.cliente_whatsapp ?? null,
          cliente_email: input.cliente_email ?? null,
          cliente_cpf: input.cliente_cpf ?? null,
          itens: input.itens as unknown as never,
          subtotal: input.subtotal,
          desconto: input.desconto,
          total: input.total,
          forma_pagamento: input.forma_pagamento,
          valor_recebido: input.valor_recebido ?? null,
          troco: input.troco ?? null,
          observacao: input.observacao ?? null,
          status: "pago",
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapRecibo(data as Record<string, unknown>);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recibos", lojaAtivaId] }),
  });
}

export function useCancelarRecibo() {
  const { lojaAtivaId } = useLoja();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("recibos")
        .update({
          status: "cancelado",
          motivo_cancelamento: motivo,
          cancelado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["recibos", lojaAtivaId] });
      qc.invalidateQueries({ queryKey: ["recibo", vars.id] });
    },
  });
}

export function useMarcarEnviado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, canal }: { id: string; canal: "whatsapp" | "email" }) => {
      const now = new Date().toISOString();
      const patch =
        canal === "whatsapp" ? { enviado_whatsapp_em: now } : { enviado_email_em: now };
      const { error } = await supabase.from("recibos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["recibo", vars.id] });
      qc.invalidateQueries({ queryKey: ["recibos"] });
    },
  });
}

export function useReciboPublico(id: string | undefined) {
  return useQuery({
    queryKey: ["recibo-publico", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recibo_publico", { p_id: id! });
      if (error) throw error;
      if (!data) return null;
      const payload = data as { recibo: Record<string, unknown> | null; config: ReciboConfig | null };
      if (!payload.recibo) return null;
      const recibo = mapRecibo(payload.recibo);
      const config: ReciboConfig = payload.config ?? DEFAULT_CONFIG(recibo.loja_id);
      void supabase.rpc("incrementar_visualizacao_recibo", { p_id: id! });
      return { recibo, config };
    },
  });
}