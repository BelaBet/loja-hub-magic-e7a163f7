// Notificações locais (não persistidas no banco) exibidas no sino do topo.
// Usadas para eventos do próprio app, como mudança de papel do usuário.

export interface LocalNotification {
  id: string;
  titulo: string;
  detalhe?: string | null;
  created_at: string;
  lido: boolean;
}

const STORAGE_KEY = "app.local-notifications";
const LIMITE = 20;

type Listener = (items: LocalNotification[]) => void;
const listeners = new Set<Listener>();

function read(): LocalNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalNotification[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: LocalNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, LIMITE)));
  } catch {
    // ignora falhas de storage (modo privado, quota)
  }
  listeners.forEach((l) => l(items.slice(0, LIMITE)));
}

export function getLocalNotifications(): LocalNotification[] {
  return read();
}

export function subscribeLocalNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addLocalNotification(titulo: string, detalhe?: string, id?: string) {
  const items = read();
  const notifId = id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (items.some((i) => i.id === notifId)) return;
  write([
    { id: notifId, titulo, detalhe: detalhe ?? null, created_at: new Date().toISOString(), lido: false },
    ...items,
  ]);
}

export function markLocalNotificationRead(id: string) {
  write(read().map((i) => (i.id === id ? { ...i, lido: true } : i)));
}

export function markAllLocalNotificationsRead() {
  write(read().map((i) => ({ ...i, lido: true })));
}
