import { Store } from "lucide-react";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FORMA_LABEL, type Recibo, type ReciboConfig, type TemplateRecibo } from "./types";
import { maskCpfDisplay } from "./masks";
import { publicReciboUrl } from "./whatsappMessage";

interface Props {
  recibo: Recibo;
  config: ReciboConfig;
  template?: TemplateRecibo;
  className?: string;
}

export function ReciboPaper({ recibo, config, template, className }: Props) {
  const t = template ?? config.template_ativo;
  const isDark = t === "dark";
  const isMin = t === "minimalista";
  const showStoreInfo = !isMin;
  const showClient = !isMin;
  const showLogo = showStoreInfo && config.mostrar_logo;
  const showEndereco = showStoreInfo && config.mostrar_endereco && config.loja_endereco;
  const showCnpj = showStoreInfo && config.mostrar_cnpj && config.loja_cnpj;
  const showTel = showStoreInfo && config.loja_telefone;
  const dt = new Date(recibo.created_at);
  const link = publicReciboUrl(recibo.id);

  const initials = (config.loja_nome_exibicao ?? "L")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const trocoVisivel =
    config.mostrar_troco &&
    recibo.forma_pagamento === "dinheiro" &&
    recibo.troco != null &&
    Number(recibo.troco) > 0;

  return (
    <div
      className={cn(
        "recibo-paper mx-auto rounded-xl shadow-soft-md print:shadow-none",
        "w-[320px] px-6 py-7 print:px-3 print:py-3",
        isDark
          ? "bg-zinc-900 text-zinc-100 border border-zinc-800"
          : "bg-white text-zinc-900 border border-border",
        className,
      )}
    >
      {/* Header */}
      {showStoreInfo && (
        <header className="text-center pb-3 border-b border-dashed border-current/30">
          {showLogo ? (
            config.loja_logo_url ? (
              <img
                src={config.loja_logo_url}
                alt={config.loja_nome_exibicao ?? ""}
                className="h-14 w-14 object-contain mx-auto mb-2 rounded-full"
              />
            ) : (
              <div
                className={cn(
                  "h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-sm",
                  isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-500/10 text-emerald-700",
                )}
              >
                {initials || <Store className="h-5 w-5" />}
              </div>
            )
          ) : null}
          <h1 className="font-display text-base font-bold tracking-tight">
            {config.loja_nome_exibicao || "Minha Loja"}
          </h1>
          {showCnpj && <p className="mono text-[10px] opacity-70 mt-0.5">CNPJ {config.loja_cnpj}</p>}
          {showEndereco && <p className="mono text-[10px] opacity-70">{config.loja_endereco}</p>}
          {showTel && <p className="mono text-[10px] opacity-70">{config.loja_telefone}</p>}
        </header>
      )}

      {/* Badge */}
      <div className={cn("text-center pt-3", isMin && "pt-0")}>
        <span
          className={cn(
            "inline-block mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
            isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-500/10 text-emerald-700",
          )}
        >
          Recibo Digital
        </span>
      </div>

      {/* Numero + data */}
      <section className="py-3 space-y-0.5 text-[11px] mono border-b border-dashed border-current/30">
        <div className="flex justify-between">
          <span className="opacity-60">Nº</span>
          <span className="font-bold">{recibo.numero_formatado}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Emitido</span>
          <span>{dt.toLocaleString("pt-BR")}</span>
        </div>
      </section>

      {/* Cliente */}
      {showClient && (
        <section className="pt-3 pb-3 text-[11px] mono space-y-0.5 border-b border-dashed border-current/30">
          <div className="font-bold uppercase tracking-widest text-[10px] opacity-60 mb-1">Cliente</div>
          <div className="font-medium">{recibo.cliente_nome}</div>
          {recibo.cliente_whatsapp && <div className="opacity-70">{recibo.cliente_whatsapp}</div>}
          {config.mostrar_cpf_cliente && recibo.cliente_cpf && (
            <div className="opacity-70">CPF: {maskCpfDisplay(recibo.cliente_cpf)}</div>
          )}
        </section>
      )}

      {/* Itens */}
      <section className="pt-3">
        <div className="font-bold uppercase tracking-widest text-[10px] opacity-60 mono mb-2">
          Itens ({recibo.itens.length})
        </div>
        <table className="w-full text-[11px] mono">
          <tbody>
            {recibo.itens.map((it, i) => (
              <tr key={i} className="align-top">
                <td className="py-1.5 pr-2">
                  <div className="font-medium leading-tight">{it.produto}</div>
                  <div className="text-[10px] opacity-60">
                    {it.qtd} × {brl(it.preco_unit)}
                  </div>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap font-medium">
                  {brl(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totais */}
      <section className="border-t border-dashed border-current/30 pt-3 mono text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span className="opacity-70">Subtotal</span>
          <span>{brl(recibo.subtotal)}</span>
        </div>
        {Number(recibo.desconto) > 0 && (
          <div className="flex justify-between">
            <span className="opacity-70">Desconto</span>
            <span>− {brl(recibo.desconto)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-current/40">
          <span className="font-bold uppercase tracking-widest text-[10px]">Total</span>
          <span className="font-display text-xl font-bold">{brl(recibo.total)}</span>
        </div>
      </section>

      {/* Pagamento */}
      <section
        className={cn(
          "mt-3 rounded-lg px-3 py-2.5 mono text-[11px] space-y-0.5",
          isDark ? "bg-zinc-800/60" : "bg-muted/60",
        )}
      >
        <div className="flex justify-between">
          <span className="opacity-70">Pagamento</span>
          <span className="font-medium">{FORMA_LABEL[recibo.forma_pagamento]}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Status</span>
          <span
            className={cn(
              "font-bold uppercase",
              recibo.status === "pago" && "text-emerald-500",
              recibo.status === "pendente" && "text-amber-500",
              recibo.status === "cancelado" && "text-red-500",
            )}
          >
            {recibo.status === "pago" ? "Pago ✓" : recibo.status === "pendente" ? "Pendente" : "Cancelado"}
          </span>
        </div>
        {recibo.valor_recebido != null && Number(recibo.valor_recebido) > 0 && (
          <div className="flex justify-between">
            <span className="opacity-70">Recebido</span>
            <span>{brl(recibo.valor_recebido)}</span>
          </div>
        )}
        {trocoVisivel && (
          <div className="flex justify-between">
            <span className="opacity-70">Troco</span>
            <span className="font-bold">{brl(recibo.troco ?? 0)}</span>
          </div>
        )}
      </section>

      {recibo.observacao && (
        <section className="border-t border-dashed border-current/30 pt-3 mt-3 mono text-[10px] opacity-70">
          <div className="font-bold uppercase tracking-widest opacity-60 mb-0.5">Obs</div>
          {recibo.observacao}
        </section>
      )}

      {/* Rodapé */}
      <footer className="border-t border-dashed border-current/30 pt-3 mt-3 text-center mono text-[10px] opacity-60 space-y-1 break-words">
        <p>{config.mensagem_rodape}</p>
        <p className="opacity-70 break-all">{link}</p>
      </footer>
    </div>
  );
}