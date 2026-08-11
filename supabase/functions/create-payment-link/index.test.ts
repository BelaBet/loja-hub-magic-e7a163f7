import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/create-payment-link`;

const body = JSON.stringify({ amount: 1000, description: "teste automatizado" });

Deno.test("rejeita chamada sem nenhum header de autenticacao", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `esperado 401/403, recebido ${res.status}`);
});

Deno.test("rejeita chamada com apikey mas sem token de usuario", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body,
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `esperado 401/403, recebido ${res.status}`);
});

Deno.test("rejeita token JWT invalido", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer token-invalido-abc123",
    },
    body,
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `esperado 401/403, recebido ${res.status}`);
});

Deno.test("rejeita header Authorization mal formatado", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "token-sem-bearer",
    },
    body,
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `esperado 401/403, recebido ${res.status}`);
});

Deno.test("preflight CORS continua respondendo sem autenticacao", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
});