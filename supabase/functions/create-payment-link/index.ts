import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PAGARME_SECRET_KEY = Deno.env.get("PAGARME_SECRET_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, description, customer } = await req.json();

    const payload = {
      name: description,
      items: [
        {
          amount,
          description,
          quantity: 1,
        },
      ],
      payment_settings: {
        accepted_payment_methods: ["credit_card", "boleto", "pix"],
        credit_card_settings: {
          installments: [{ number: 1, total: amount }],
        },
      },
      customer_settings: {
        customer_required: true,
      },
    };

    const response = await fetch("https://api.pagar.me/core/v5/paymentlinks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(PAGARME_SECRET_KEY + ":")}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Pagar.me error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        url: data.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
