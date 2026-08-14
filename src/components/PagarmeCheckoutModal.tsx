import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, QrCode, Copy, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { calculateSplit, getInstallmentTable, INSTALLMENT_RATE, BASE_FEE_RATE } from "@/lib/pagarme-split";

export type PagarmeMethod = "pix" | "credit_card";

export type PagarmeAddress = {
  street: string;
  number: string;
  complement?: string;
  zip_code: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

export type PagarmeCustomer = {
  name?: string;
  email?: string;
  document?: string;
  area_code?: string;
  phone?: string;
  address?: Partial<PagarmeAddress>;
};

type Props = {
  open: boolean;
  method: PagarmeMethod;
  amount: number;
  customer?: PagarmeCustomer;
  sellerRecipientId?: string | null;
  /** Venda criada antes do checkout. Necessária para confirmação segura do PIX. */
  vendaId?: string | null;
  onClose: () => void;
  onConfirmed: (result: {
    order_id: string;
    status: string;
    amount_charged?: number;
    installments?: number;
    base_amount?: number;
    platform_amount?: number;
    seller_amount?: number;
    total_amount?: number;
  }) => void;
};

type PixResult = {
  order_id: string;
  status: string;
  pix_qr_code: string | null;
  pix_qr_code_url: string | null;
  pix_expires_at: string | null;
  base_amount?: number;
  platform_amount?: number;
  seller_amount?: number;
  amount?: number;
};

function luhnValid(value: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = Number(value[i]);
    if (!Number.isInteger(digit)) return false;
    if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return value.length >= 13 && value.length <= 19 && sum % 10 === 0;
}

export function PagarmeCheckoutModal({
  open, method, amount, customer, sellerRecipientId, vendaId, onClose, onConfirmed,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [showTable, setShowTable] = useState(false);

  // Endereço do pagador — obrigatório em todos os meios de pagamento
  const [address, setAddress] = useState<PagarmeAddress>({
    street: customer?.address?.street ?? "",
    number: customer?.address?.number ?? "",
    complement: customer?.address?.complement ?? "",
    zip_code: customer?.address?.zip_code ?? "",
    neighborhood: customer?.address?.neighborhood ?? "",
    city: customer?.address?.city ?? "",
    state: customer?.address?.state ?? "",
    country: customer?.address?.country ?? "BR",
  });

  const amountCents = Math.round(amount * 100);

  const updateAddress = (field: keyof PagarmeAddress, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }));
  };

  const normalizedAddress: PagarmeAddress = {
    ...address,
    zip_code: address.zip_code.replace(/\D/g, ""),
    state: address.state.trim().toUpperCase(),
    country: address.country.trim().toUpperCase(),
  };

  const payerCustomer = {
    ...(customer ?? {}),
    address: normalizedAddress,
  };

  const validatePayerAddress = () => {
    const required: Array<[keyof PagarmeAddress, string]> = [
      ["street", "Rua"],
      ["number", "Número"],
      ["zip_code", "CEP"],
      ["neighborhood", "Bairro"],
      ["city", "Cidade"],
      ["state", "UF"],
      ["country", "País"],
    ];
    const missing = required.find(([field]) => !String(normalizedAddress[field] ?? "").trim());
    if (missing) {
      toast.error(`Preencha o campo obrigatório: ${missing[1]}`);
      return false;
    }
    if (normalizedAddress.zip_code.length !== 8) {
      toast.error("Informe um CEP válido com 8 dígitos");
      return false;
    }
    if (normalizedAddress.state.length !== 2) {
      toast.error("Informe a UF com 2 letras");
      return false;
    }
    return true;
  };
  const split = useMemo(() => calculateSplit(amountCents, method === "credit_card" ? installments : 1, true), [amountCents, method, installments]);
  const installmentTable = useMemo(() => getInstallmentTable(amountCents, 12), [amountCents]);

  useEffect(() => {
    if (!open) {
      setPix(null); setPixStatus(null); setCopied(false); setCardNumber(""); setHolder("");
      setExpMonth(""); setExpYear(""); setCvv(""); setInstallments(1); setShowTable(false);
      return;
    }
    if (method === "pix") void gerarPix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method]);

  // PIX só confirma a venda depois de o backend consultar o status real no Pagar.me.
  useEffect(() => {
    if (!open || method !== "pix" || !pix || !vendaId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120; // 6 minutos a cada 3s
    const check = async () => {
      attempts += 1;
      try {
        const { data, error } = await supabase.functions.invoke("check-order-status", { body: { venda_id: vendaId } });
        if (cancelled) return;
        if (error) throw error;
        const status = data?.pagamento_status ?? data?.charge_status ?? data?.order_status;
        setPixStatus(status ?? null);
        if (status === "pago" || data?.charge_status === "paid" || data?.order_status === "paid") {
          onConfirmed({
            order_id: pix.order_id,
            status: "paid",
            amount_charged: (data?.amount ?? pix.amount ?? amountCents) / 100,
            base_amount: pix.base_amount,
            platform_amount: pix.platform_amount,
            seller_amount: pix.seller_amount,
            total_amount: pix.amount,
          });
          return;
        }
        if (status === "falhou" || data?.charge_status === "failed" || data?.order_status === "failed" || data?.order_status === "canceled") {
          toast.error("PIX recusado ou cancelado.");
          return;
        }
      } catch (error) {
        if (!cancelled) console.warn("Falha ao consultar status do PIX:", error);
      }
      if (!cancelled && attempts < maxAttempts) window.setTimeout(check, 3000);
      if (!cancelled && attempts >= maxAttempts) {
        setPixStatus("timeout");
        toast.error("Tempo de espera do PIX esgotado. Consulte o histórico antes de repetir a cobrança.");
      }
    };
    void check();
    return () => { cancelled = true; };
  }, [open, method, pix, vendaId, onConfirmed, amountCents]);

  const gerarPix = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          payment_method: "pix", amount: amountCents, customer,
          venda_id: vendaId ?? undefined,
          seller_recipient_id: sellerRecipientId ?? undefined,
          pass_surcharge_to_customer: false,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPix(data as PixResult);
      setPixStatus(data?.charge_status ?? data?.status ?? "pending");
    } catch (e: any) {
      toast.error(`Erro ao gerar PIX: ${e.message ?? e}`);
      onClose();
    } finally { setLoading(false); }
  };

  const cobrarCartao = async () => {
    const num = cardNumber.replace(/\s/g, "");
    const year = Number(expYear.length === 2 ? `20${expYear}` : expYear);
    const month = Number(expMonth);
    const now = new Date();
    if (!luhnValid(num)) return toast.error("Número do cartão inválido");
    if (!holder.trim()) return toast.error("Informe o nome impresso no cartão");
    if (!Number.isInteger(month) || month < 1 || month > 12) return toast.error("Mês de validade inválido");
    if (!Number.isInteger(year) || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return toast.error("Cartão expirado");
    if (!/^\d{3,4}$/.test(cvv)) return toast.error("CVV inválido");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          payment_method: "credit_card", amount: amountCents, customer,
          venda_id: vendaId ?? undefined,
          seller_recipient_id: sellerRecipientId ?? undefined,
          pass_surcharge_to_customer: true,
          card: { number: num, holder_name: holder.trim(), exp_month: month, exp_year: year, cvv, installments },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const status = data?.charge_status ?? data?.status;
      if (status === "paid" || data?.status === "paid") {
        toast.success("Pagamento aprovado");
        onConfirmed({ order_id: data.order_id, status: "paid", amount_charged: (data?.amount ?? amountCents) / 100, installments, base_amount: data?.base_amount, platform_amount: data?.platform_amount, seller_amount: data?.seller_amount, total_amount: data?.amount });
      } else if (status === "authorized") {
        toast.info("Pagamento autorizado. Aguardando captura/confirmacão do gateway.");
      } else {
        toast.error(`Pagamento não aprovado (${status ?? "desconhecido"})`);
      }
    } catch (e: any) { toast.error(`Erro no cartão: ${e.message ?? e}`); }
    finally { setLoading(false); }
  };

  const copiarPix = async () => {
    if (!pix?.pix_qr_code) return;
    await navigator.clipboard.writeText(pix.pix_qr_code);
    setCopied(true); toast.success("Código PIX copiado");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {method === "pix" ? <QrCode className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            {method === "pix" ? "Pagamento via PIX" : "Pagamento no cartão"}
          </DialogTitle>
          <DialogDescription>Total: <span className="num font-bold text-foreground">{brl(split.totalAmount / 100)}</span>{method === "credit_card" && installments > 1 && <span className="ml-2 text-xs text-muted-foreground">({installments}× de {brl(split.totalAmount / 100 / installments)})</span>}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-semibold">Endereço do pagador</p>
            <p className="text-xs text-muted-foreground">Obrigatório para todos os meios de pagamento.</p>
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <div>
              <Label>Rua *</Label>
              <Input value={address.street} onChange={(e) => updateAddress("street", e.target.value)} placeholder="Avenida / Rua" />
            </div>
            <div>
              <Label>Número *</Label>
              <Input value={address.number} onChange={(e) => updateAddress("number", e.target.value)} placeholder="123" inputMode="numeric" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Complemento</Label>
              <Input value={address.complement} onChange={(e) => updateAddress("complement", e.target.value)} placeholder="Apto, sala..." />
            </div>
            <div>
              <Label>CEP *</Label>
              <Input value={address.zip_code} onChange={(e) => updateAddress("zip_code", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000-000" inputMode="numeric" maxLength={8} className="mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Bairro *</Label>
              <Input value={address.neighborhood} onChange={(e) => updateAddress("neighborhood", e.target.value)} placeholder="Bairro" />
            </div>
            <div>
              <Label>Cidade *</Label>
              <Input value={address.city} onChange={(e) => updateAddress("city", e.target.value)} placeholder="Cidade" />
            </div>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <div>
              <Label>UF *</Label>
              <Input value={address.state} onChange={(e) => updateAddress("state", e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
            </div>
            <div>
              <Label>País *</Label>
              <Input value={address.country} onChange={(e) => updateAddress("country", e.target.value.toUpperCase())} placeholder="BR" maxLength={2} />
            </div>
          </div>
        </div>

        {method === "pix" && (
          <div className="space-y-4">
            {loading && !pix && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Gerando QR Code…</div>}
            {pix && <>
              {pix.pix_qr_code_url && <div className="flex justify-center bg-white p-4 rounded-lg border"><img src={pix.pix_qr_code_url} alt="QR Code PIX" className="h-56 w-56" /></div>}
              <div><Label className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Copia e cola</Label><div className="flex gap-2 mt-1.5"><Input value={pix.pix_qr_code ?? ""} readOnly className="mono text-xs" /><Button type="button" variant="outline" size="icon" onClick={copiarPix}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button></div></div>
              <div className="rounded-md bg-muted/40 p-3 text-sm text-center">
                {!vendaId ? <><div className="font-semibold text-destructive">Venda não vinculada</div><div className="text-xs text-muted-foreground mt-1">O checkout precisa receber o ID da venda para confirmar o PIX automaticamente.</div></> : <><div className="font-semibold">{pixStatus === "pago" || pixStatus === "paid" ? "Pagamento confirmado" : "Aguardando pagamento…"}</div><div className="text-xs text-muted-foreground mt-1">O sistema consulta o gateway e só finaliza a venda quando o PIX estiver pago.</div></>}
              </div>
              <Button type="button" variant="ghost" onClick={onClose} className="w-full">Cancelar</Button>
            </>}
          </div>
        )}

        {method === "credit_card" && (
          <div className="space-y-3">
            <div><Label>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9 ]/g, ""))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} className="mono" /></div>
            <div><Label>Nome impresso</Label><Input value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Mês</Label><Input value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="MM" maxLength={2} inputMode="numeric" className="mono" /></div>
              <div><Label>Ano</Label><Input value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="AA" maxLength={4} inputMode="numeric" className="mono" /></div>
              <div><Label>CVV</Label><Input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" maxLength={4} inputMode="numeric" className="mono" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between"><Label>Parcelas</Label><button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-primary hover:underline">{showTable ? "Ocultar tabela" : "Ver tabela completa"}</button></div>
              <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}><SelectTrigger className="mono mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{installmentTable.map((row) => <SelectItem key={row.installments} value={String(row.installments)}>{row.label}</SelectItem>)}</SelectContent></Select>
              <div className="mt-3 rounded-md bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{brl(amountCents / 100)}</span></div>
                {split.baseFeeAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxas ({(BASE_FEE_RATE * 100).toFixed(2)}%)</span><span className="num">+ {brl(split.baseFeeAmount / 100)}</span></div>}
                {split.installmentSurcharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Parcelamento ({(INSTALLMENT_RATE * (installments - 1) * 100).toFixed(2)}%)</span><span className="num">+ {brl(split.installmentSurcharge / 100)}</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1.5"><span>Total cobrado</span><span className="num">{brl(split.totalAmount / 100)}</span></div>
              </div>
              {showTable && <div className="mt-3 max-h-56 overflow-y-auto rounded-md border"><table className="w-full text-xs"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">Parc.</th><th className="px-2 py-1.5 text-right">Por parcela</th><th className="px-2 py-1.5 text-right">Total</th></tr></thead><tbody className="num">{installmentTable.map((row) => <tr key={row.installments} onClick={() => { setInstallments(row.installments); setShowTable(false); }} className={`cursor-pointer border-t hover:bg-muted/40 ${row.installments === installments ? "bg-primary/10" : ""}`}><td className="px-2 py-1.5">{row.installments}×</td><td className="px-2 py-1.5 text-right">{brl(row.perInstallment / 100)}</td><td className="px-2 py-1.5 text-right">{brl(row.totalAmount / 100)}</td></tr>)}</tbody></table></div>}
            </div>
            <Button type="button" onClick={cobrarCartao} disabled={loading} className="w-full h-11">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando…</> : "Pagar com cartão"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
