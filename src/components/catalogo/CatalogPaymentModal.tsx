import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskWhatsApp } from "@/components/recibos/masks";
import { Loader2, QrCode, Copy, Check, CreditCard, Landmark, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { calculateSplit, getInstallmentTable, INSTALLMENT_RATE, BASE_FEE_RATE } from "@/lib/pagarme-split";
import { tokenizePagarmeCard } from "@/lib/pagarme-token";
import type { CatalogCartItem } from "@/hooks/useCatalogCart";

type PaymentMethod = "pix" | "credit_card" | "debit_card";
type Step = "dados" | "pagamento" | "resultado";
type Address = { street: string; number: string; complement: string; zip_code: string; neighborhood: string; city: string; state: string };
const EMPTY_ADDRESS: Address = { street: "", number: "", complement: "", zip_code: "", neighborhood: "", city: "", state: "" };
function luhnValid(value: string) { let sum = 0, doubleDigit = false; for (let i = value.length - 1; i >= 0; i--) { let digit = Number(value[i]); if (!Number.isInteger(digit)) return false; if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; } sum += digit; doubleDigit = !doubleDigit; } return value.length >= 13 && value.length <= 19 && sum % 10 === 0; }
type Props = { open: boolean; onOpenChange: (o: boolean) => void; catalogId: string; lojaNome: string; items: CatalogCartItem[]; totalValue: number; onSuccess: () => void };

export function CatalogPaymentModal({ open, onOpenChange, catalogId, lojaNome, items, totalValue, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("dados");
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState(""); const [whatsapp, setWhatsapp] = useState(""); const [email, setEmail] = useState(""); const [cpf, setCpf] = useState(""); const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [cardNumber, setCardNumber] = useState(""); const [holder, setHolder] = useState(""); const [expMonth, setExpMonth] = useState(""); const [expYear, setExpYear] = useState(""); const [cvv, setCvv] = useState(""); const [installments, setInstallments] = useState(1); const [showTable, setShowTable] = useState(false);
  const [pix, setPix] = useState<{ venda_id: string; pix_qr_code: string | null; pix_qr_code_url: string | null } | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null); const [copied, setCopied] = useState(false); const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const amountCents = Math.round(totalValue * 100);
  const split = useMemo(() => calculateSplit(amountCents, method === "credit_card" ? installments : 1, true), [amountCents, method, installments]);
  const installmentTable = useMemo(() => getInstallmentTable(amountCents, 12), [amountCents]);

  useEffect(() => { if (!open) { setStep("dados"); setPix(null); setPixStatus(null); setCopied(false); setResultado(null); setCardNumber(""); setHolder(""); setExpMonth(""); setExpYear(""); setCvv(""); setInstallments(1); setShowTable(false); } }, [open]);
  useEffect(() => {
    if (step !== "pagamento" || method !== "pix" || !pix) return;
    let cancelled = false; let attempts = 0; const maxAttempts = 120;
    const check = async () => { attempts += 1; try { const { data } = await supabase.functions.invoke("catalogo-checkout-status", { body: { venda_id: pix.venda_id, catalog_id: catalogId } }); if (cancelled) return; const status = data?.pagamento_status; setPixStatus(status ?? null); if (status === "pago") { setResultado({ ok: true, mensagem: "Pagamento confirmado! Seu pedido foi enviado para a loja." }); setStep("resultado"); onSuccess(); return; } if (status === "falhou") { setResultado({ ok: false, mensagem: "O pagamento PIX não foi concluído (expirou ou foi cancelado)." }); setStep("resultado"); return; } } catch { /* rede instável */ } if (!cancelled && attempts < maxAttempts) window.setTimeout(check, 3000); };
    void check(); return () => { cancelled = true; };
  }, [step, method, pix, catalogId]);

  const validDados = nome.trim().length >= 2 && whatsapp.replace(/\D/g, "").length >= 10;
  const validEndereco = address.street.trim() && address.number.trim() && address.zip_code.replace(/\D/g, "").length === 8 && address.neighborhood.trim() && address.city.trim() && address.state.trim().length === 2;
  const buildCustomer = () => { const digits = whatsapp.replace(/\D/g, ""); const ddd = digits.length === 11 ? digits.slice(0, 2) : "11"; const numero = digits.length === 11 ? digits.slice(2) : digits; return { name: nome.trim(), email: email.trim() || undefined, document: cpf.replace(/\D/g, "") || undefined, area_code: ddd, phone: numero, address: { ...address, zip_code: address.zip_code.replace(/\D/g, ""), state: address.state.trim().toUpperCase() } }; };
  const chamarCheckout = async (extra: Record<string, unknown>) => supabase.functions.invoke("catalogo-checkout", { body: { catalog_id: catalogId, items: items.map((i) => ({ produto_id: i.id, quantidade: i.qty })), customer: buildCustomer(), ...extra } });
  const extrairErro = async (error: unknown, data: unknown): Promise<string> => { const fromData = (data as any)?.error; if (fromData) return fromData; const ctx = (error as any)?.context; if (ctx?.body) { try { const parsed = JSON.parse(await new Response(ctx.body).text()); if (parsed?.error) return parsed.error; } catch { /* fallback */ } } return "Não foi possível processar o pagamento. Tente novamente."; };

  const gerarPix = async () => { setLoading(true); try { const { data, error } = await chamarCheckout({ payment_method: "pix" }); if (error || data?.error) throw new Error(await extrairErro(error, data)); setPix({ venda_id: data.venda_id, pix_qr_code: data.pix_qr_code, pix_qr_code_url: data.pix_qr_code_url }); setPixStatus("pendente"); } catch (e: any) { toast.error(e.message); setStep("dados"); } finally { setLoading(false); } };

  const cobrarCartao = async () => {
    const num = cardNumber.replace(/\s/g, ""); const year = Number(expYear.length === 2 ? `20${expYear}` : expYear); const month = Number(expMonth); const now = new Date();
    if (!luhnValid(num)) return toast.error("Número do cartão inválido"); if (!holder.trim()) return toast.error("Informe o nome impresso no cartão"); if (!Number.isInteger(month) || month < 1 || month > 12) return toast.error("Mês de validade inválido"); if (!Number.isInteger(year) || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return toast.error("Cartão expirado"); if (!/^\d{3,4}$/.test(cvv)) return toast.error("CVV inválido");
    setLoading(true);
    try {
      // Tokeniza diretamente no navegador. O número/CVV nunca chegam à Edge Function.
      const card_token = await tokenizePagarmeCard({ number: num, holder_name: holder.trim(), exp_month: month, exp_year: year, cvv });
      const { data, error } = await chamarCheckout({ payment_method: method, card_token, installments: method === "credit_card" ? installments : 1 });
      if (error || data?.error) throw new Error(await extrairErro(error, data));
      setResultado({ ok: true, mensagem: "Pagamento aprovado! Seu pedido foi enviado para a loja." }); setStep("resultado"); onSuccess();
    } catch (e: any) { setResultado({ ok: false, mensagem: e.message }); setStep("resultado"); } finally { setLoading(false); }
  };

  const avancarParaPagamento = () => { setStep("pagamento"); if (method === "pix") void gerarPix(); };
  const copiarPix = async () => { if (!pix?.pix_qr_code) return; try { await navigator.clipboard.writeText(pix.pix_qr_code); setCopied(true); toast.success("Código PIX copiado"); window.setTimeout(() => setCopied(false), 2000); } catch { toast.error("Não foi possível copiar o código PIX."); } };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }} title={step === "resultado" ? (resultado?.ok ? "Pedido confirmado" : "Pagamento não concluído") : "Finalizar compra"} description={step === "dados" ? `Pedido em ${lojaNome} · ${brl(totalValue)}` : undefined} contentClassName="max-w-md">
      <div className="space-y-4 pb-2">
        {step === "dados" && <>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Seu nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="h-11 text-base" /></div>
            <div className="space-y-1.5"><Label>WhatsApp *</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))} placeholder="(11) 99999-9999" className="h-11 text-base" inputMode="numeric" /></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" type="email" /></div><div className="space-y-1.5"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="opcional" inputMode="numeric" className="mono" /></div></div>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3"><p className="text-sm font-semibold">Endereço de cobrança *</p><div className="grid grid-cols-[1fr_100px] gap-2"><div><Label>Rua</Label><Input value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} placeholder="Avenida / Rua" /></div><div><Label>Número</Label><Input value={address.number} onChange={(e) => setAddress((a) => ({ ...a, number: e.target.value }))} placeholder="123" inputMode="numeric" /></div></div><div className="grid grid-cols-2 gap-2"><div><Label>Complemento</Label><Input value={address.complement} onChange={(e) => setAddress((a) => ({ ...a, complement: e.target.value }))} placeholder="Apto, sala..." /></div><div><Label>CEP</Label><Input value={address.zip_code} onChange={(e) => setAddress((a) => ({ ...a, zip_code: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="00000-000" inputMode="numeric" maxLength={8} className="mono" /></div></div><div className="grid grid-cols-2 gap-2"><div><Label>Bairro</Label><Input value={address.neighborhood} onChange={(e) => setAddress((a) => ({ ...a, neighborhood: e.target.value }))} placeholder="Bairro" /></div><div><Label>Cidade</Label><Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} placeholder="Cidade" /></div></div><div className="w-24"><Label>UF</Label><Input value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2) }))} placeholder="SP" maxLength={2} /></div></div>
          <div className="space-y-2"><Label>Forma de pagamento</Label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setMethod("pix")} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${method === "pix" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}><QrCode className="h-4 w-4" /> PIX</button><button type="button" onClick={() => setMethod("credit_card")} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${method === "credit_card" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}><CreditCard className="h-4 w-4" /> Crédito</button><button type="button" onClick={() => setMethod("debit_card")} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${method === "debit_card" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}><Landmark className="h-4 w-4" /> Débito</button></div></div>
          <Button type="button" onClick={avancarParaPagamento} disabled={!validDados || !validEndereco} className="w-full h-11">Continuar</Button>
        </>}

        {step === "pagamento" && <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("dados")} className="-ml-2"><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar</Button>
          {method === "pix" && <div className="space-y-4">{loading && !pix && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Gerando QR Code…</div>}{pix && <><div className="flex justify-center bg-white p-4 rounded-lg border">{pix.pix_qr_code_url ? <img src={pix.pix_qr_code_url} alt="QR Code PIX" className="h-56 w-56" /> : <QrCode className="h-56 w-56 p-10" />}</div><div><Label className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Copia e cola</Label><div className="flex gap-2 mt-1.5"><Input value={pix.pix_qr_code ?? ""} readOnly className="mono text-xs" /><Button type="button" variant="outline" size="icon" onClick={copiarPix}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button></div></div><div className="rounded-md bg-muted/40 p-3 text-sm text-center"><div className="font-semibold">{pixStatus === "pago" ? "Pagamento confirmado" : "Aguardando pagamento…"}</div><div className="text-xs text-muted-foreground mt-1">Assim que você pagar, a confirmação aparece aqui automaticamente.</div></div></>}</div>}

          {(method === "credit_card" || method === "debit_card") && <div className="space-y-3">
            <div><Label>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9 ]/g, ""))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} className="mono" autoComplete="cc-number" /></div>
            <div><Label>Nome impresso</Label><Input value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" autoComplete="cc-name" /></div>
            <div className="grid grid-cols-3 gap-2"><div><Label>Mês</Label><Input value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="MM" maxLength={2} inputMode="numeric" className="mono" autoComplete="cc-exp-month" /></div><div><Label>Ano</Label><Input value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="AA" maxLength={4} inputMode="numeric" className="mono" autoComplete="cc-exp-year" /></div><div><Label>CVV</Label><Input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" maxLength={4} inputMode="numeric" className="mono" autoComplete="cc-csc" /></div></div>
            {method === "credit_card" && <div><div className="flex items-center justify-between"><Label>Parcelas</Label><button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-primary hover:underline">{showTable ? "Ocultar tabela" : "Ver tabela completa"}</button></div><Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}><SelectTrigger className="mono mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{installmentTable.map((row) => <SelectItem key={row.installments} value={String(row.installments)}>{row.label}</SelectItem>)}</SelectContent></Select>{showTable && <div className="mt-3 max-h-56 overflow-y-auto rounded-md border"><table className="w-full text-xs"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">Parc.</th><th className="px-2 py-1.5 text-right">Por parcela</th><th className="px-2 py-1.5 text-right">Total</th></tr></thead><tbody className="num">{installmentTable.map((row) => <tr key={row.installments} onClick={() => { setInstallments(row.installments); setShowTable(false); }} className={`cursor-pointer border-t hover:bg-muted/40 ${row.installments === installments ? "bg-primary/10" : ""}`}><td className="px-2 py-1.5">{row.installments}×</td><td className="px-2 py-1.5 text-right">{brl(row.perInstallment / 100)}</td><td className="px-2 py-1.5 text-right">{brl(row.totalAmount / 100)}</td></tr>)}</tbody></table></div>}</div>}
            <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{brl(amountCents / 100)}</span></div>{split.baseFeeAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxas ({(BASE_FEE_RATE * 100).toFixed(2)}%)</span><span className="num">+ {brl(split.baseFeeAmount / 100)}</span></div>}{method === "credit_card" && split.installmentSurcharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Parcelamento ({(INSTALLMENT_RATE * (installments - 1) * 100).toFixed(2)}%)</span><span className="num">+ {brl(split.installmentSurcharge / 100)}</span></div>}<div className="flex justify-between font-semibold border-t pt-1.5"><span>Total cobrado</span><span className="num">{brl(split.totalAmount / 100)}</span></div></div>
            <Button type="button" onClick={cobrarCartao} disabled={loading} className="w-full h-11">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando…</> : `Pagar ${brl(split.totalAmount / 100)}`}</Button>
          </div>}
        </>}
        {step === "resultado" && resultado && <div className="flex flex-col items-center text-center gap-3 py-4">{resultado.ok ? <CheckCircle2 className="h-12 w-12 text-primary" /> : <XCircle className="h-12 w-12 text-destructive" />}<p className="text-sm">{resultado.mensagem}</p><Button type="button" onClick={() => onOpenChange(false)} className="w-full h-11 mt-2">{resultado.ok ? "Fechar" : "Tentar novamente"}</Button></div>}
      </div>
    </ResponsiveModal>
  );
}
