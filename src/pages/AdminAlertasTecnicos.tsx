import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Shield, Wrench, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TECHNICAL_ALERT_TYPES } from "@/lib/alertTypes";

type AlertaTecnico = {
  id: string;
  loja_id: string;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  referencia_id: string | null;
  lido: boolean;
  created_at: string;
  loja?: { nome: string } | null;
};

const CRITICOS = new Set([
  "webhook_captura_falhou",
  "webhook_update_venda_falhou",
  "webhook_erro_inesperado",
]);

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Central de alertas técnicos (webhook, recipient de pagamento) de TODAS as
 * lojas da plataforma — separado do sino de notificações do lojista
 * (AlertsBell), que mostra só o que é relevante pro dia a dia dela
 * (estoque, cupom). Ver src/lib/alertTypes.ts pra classificação.
 */
export default function AdminAlertasTecnicos() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<AlertaTecnico[]>([]);

  useEffect(() => {
    (async () => {
      const { data: roleData } = await supabase.rpc("is_super_admin");
      const ok = roleData === true;
      setIsSuper(ok);
      setAuthChecked(true);
      if (!ok) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("alertas_operacionais" as any)
        .select("*, loja:lojas(nome)")
        .in("tipo", Array.from(TECHNICAL_ALERT_TYPES))
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) setAlertas((data as unknown as AlertaTecnico[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (!authChecked || loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuper) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/admin">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Instituições
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground mono text-[10px] uppercase tracking-widest">
            <Shield className="h-3.5 w-3.5" /> Super Admin
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Alertas técnicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Falhas de webhook, recipient de pagamento e outros eventos de infraestrutura, de todas as lojas.
            Isso não aparece no sino de notificações do lojista — só aqui.
          </p>
        </div>

        {alertas.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto opacity-30 mb-2" />
            Nenhum alerta técnico registrado ainda.
          </Card>
        ) : (
          <div className="space-y-2">
            {alertas.map((a) => {
              const critico = CRITICOS.has(a.tipo);
              return (
                <Card key={a.id} className={cn("p-4", !a.lido && "border-primary/30 bg-primary/[0.02]")}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={cn("h-4 w-4 shrink-0 mt-0.5", critico ? "text-destructive" : "text-amber-500")}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{a.titulo}</p>
                        <Badge variant="outline" className="text-[10px] mono">{a.tipo}</Badge>
                        {a.loja?.nome && (
                          <Badge variant="secondary" className="text-[10px]">{a.loja.nome}</Badge>
                        )}
                      </div>
                      {a.detalhe && <p className="text-xs text-muted-foreground mt-1">{a.detalhe}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">{fmtData(a.created_at)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
