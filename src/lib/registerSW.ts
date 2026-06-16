// Guarded service worker registration. Refuses to register in dev, Lovable
// preview hosts, iframes, or when ?sw=off is present, and unregisters any
// stale /sw.js it finds in those contexts.

function isLovablePreviewHost(hostname: string) {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterAppSWs() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith("/sw.js");
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const inIframe = window.top !== window.self;
  const hostname = window.location.hostname;
  const refuse =
    !import.meta.env.PROD ||
    inIframe ||
    isLovablePreviewHost(hostname) ||
    url.searchParams.get("sw") === "off";

  if (refuse) {
    await unregisterAppSWs();
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[sw] register failed", err);
  }
}