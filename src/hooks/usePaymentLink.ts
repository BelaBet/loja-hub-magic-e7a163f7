import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PaymentLinkStep = "idle" | "generating" | "ready" | "failed";

export interface PaymentLinkResult {
  id: string;
  url: string;
}

export function usePaymentLink() {
  const [step, setStep] = useState<PaymentLinkStep>("idle");
  const [result, setResult] = useState<PaymentLinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateLink(params: {
    amount: number; // centavos
    description: string;
  }) {
    setStep("generating");
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-payment-link",
        { body: params }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(JSON.stringify(data.error));

      setResult(data);
      setStep("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar link.";
      setError(msg);
      setStep("failed");
    }
  }

  function reset() {
    setStep("idle");
    setResult(null);
    setError(null);
  }

  return { step, result, error, generateLink, reset };
}
