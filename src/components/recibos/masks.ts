export function maskWhatsApp(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCpf(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Always masks all but the last 2 digits: ***.***.***-XX */
export function maskCpfDisplay(v: string | null | undefined) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length < 2) return "***.***.***-**";
  return `***.***.***-${d.slice(-2)}`;
}

/** Normalize Brazilian phone to international wa.me format (digits only with 55). */
export function whatsappDigits(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return `55${d}`;
}