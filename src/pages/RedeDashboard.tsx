import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Download, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useInstitutions } from "@/contexts/InstitutionContext";
import { downloadCsv } from "@/lib/exportCsv";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type LojaRow = {
  loja_id: string;
  nome: string;
  vendas_count: number;
  faturamento_total: number;
  ticket_medio: number;
};
type Dashboard = {
  por_loja: LojaRow[];
  totais: { vendas: number; faturamento: number; ticket_medio: number; num_lojas: number };
  serie_diaria: { data: string; faturamento: number }[];
  ranking: { top: LojaRow[]; bottom: LojaRow[] };
  periodo: { from: string; to: string };
};

const brl = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const RedeDashboard = () => {
  const { institutions, current, setCurrentId, loading: instLoading } = useInstitutions();
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(isoDateDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preset === "custom") return;
    setFrom(isoDateDaysAgo(parseInt(preset, 10)));
    setTo(todayIso());
  }, [preset]);

  const fetchData = async () => {
    if (!current) return;
    setLoading(true);
    const { data: res, error } = await (supabase as any).rpc("network_dashboard", {
      _inst: current.id,
      _from: from,
      _to: to,
    });
    if (error) {
      toast.error("Erro ao carregar dashboard da rede");
      setLoading(false);
      return;
    }
    setData(res as Dashboard);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, from, to]);

  const sortedLojas = useMemo(
    () => (data?.por_loja ?? []).slice().sort((a, b) => b.faturamento_total - a.faturamento_total),
    [data],
  );

  const exportCsv = () => {
    if (!data) return;
    const rows = sortedLojas.map((l) => ({
      loja: l.nome,
      vendas: l.vendas_count,
      faturamento: l.faturamento_total,
      ticket_medio: l.ticket_medio.toFixed(2),
    }));
    downloadCsv(`rede_${current?.nome ?? "rede"}_${from}_a_${to}.csv`, rows);
  };

  if (instLoading) {
    return (
      <AppLayout>
        <Skeleton className="h-32 w-full" />
      </AppLayout>
    );
  }

  if (!institutions.length) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mono text-[10px] uppercase tracking-widest">
              <Network className="h-3.5 w-3.5" /> Rede
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
              Dashboard consolidado
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {institutions.length > 1 && (
              <Select value={current?.id ?? ""} onValueChange={setCurrentId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Rede" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
              </>
            )}
            <Button onClick={exportCsv} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </header>

        {loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Faturamento" value={brl(data.totais.faturamento)} />
              <Kpi label="Vendas" value={String(data.totais.vendas)} />
              <Kpi label="Ticket médio" value={brl(data.totais.ticket_medio)} />
              <Kpi label="Lojas" value={String(data.totais.num_lojas)} />
            </section>

            <Card className="p-4">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Faturamento diário
              </div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={data.serie_diaria}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => brl(Number(v))} width={90} />
                    <Tooltip formatter={(v: number) => brl(Number(v))} />
                    <Line type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="font-semibold">Comparativo por loja</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-2">Loja</th>
                      <th className="px-4 py-2 text-right">Vendas</th>
                      <th className="px-4 py-2 text-right">Faturamento</th>
                      <th className="px-4 py-2 text-right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLojas.map((l) => (
                      <tr key={l.loja_id} className="border-t">
                        <td className="px-4 py-2">{l.nome}</td>
                        <td className="px-4 py-2 text-right">{l.vendas_count}</td>
                        <td className="px-4 py-2 text-right">{brl(l.faturamento_total)}</td>
                        <td className="px-4 py-2 text-right">{brl(l.ticket_medio)}</td>
                      </tr>
                    ))}
                    {sortedLojas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          Nenhuma loja vinculada à rede neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}

export default RedeDashboard;