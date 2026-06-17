import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Search,
  MoreHorizontal,
  MessageCircle,
  Mail,
  Plus,
  TrendingUp,
  CalendarDays,
  DollarSign,
} from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { traduzErro } from "@/lib/errors";
import { MetricaCard } from "@/components/recibos/MetricaCard";
import { StatusBadge } from "@/components/recibos/StatusBadge";
import { FORMA_LABEL } from "@/components/recibos/types";
import { useRecibos, useReciboConfig, useCancelarRecibo, useMarcarEnviado } from "@/hooks/recibos/useRecibos";
import { openWhatsApp, openEmail, publicReciboUrl } from "@/components/recibos/whatsappMessage";

export default function RecibosLista() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "pago" | "pendente" | "cancelado">("todos");
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "todos">("mes");
  const { data: recibos = [], isLoading } = useRecibos({ busca, status, periodo });
  const { data: config } = useReciboConfig();
  const { data: todosMes = [] } = useRecibos({ periodo: "mes" });
  const cancelar = useCancelarRecibo();
  const marcar = useMarcarEnviado();

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const metricas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesPrev = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);

    const ativos = todosMes.filter((r) => r.status !== "cancelado");
    const hojeArr = ativos.filter((r) => new Date(r.created_at) >= hoje);
    const mesArr = ativos.filter((r) => new Date(r.created_at) >= inicioMes);
    const enviados = ativos.filter((r) => r.enviado_whatsapp_em).length;
    const ticket = mesArr.length ? mesArr.reduce((a, r) => a + Number(r.total), 0) / mesArr.length : 0;

    const totalHoje = hojeArr.reduce((a, r) => a + Number(r.total), 0);
    const totalMes = mesArr.reduce((a, r) => a + Number(r.total), 0);
    return {
      totalHoje,
      qtdHoje: hojeArr.length,
      totalMes,
      qtdMes: mesArr.length,
      enviados,
      pctEnviados: ativos.length ? Math.round((enviados / ativos.length) * 100) : 0,
      ticket,
      inicioMesPrev,
      fimMesPrev,
    };
  }, [todosMes]);

  function copiarLink(id: string) {
    const url = publicReciboUrl(id);
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  async function confirmarCancelar() {
    if (!cancelId || !motivo.trim()) {
      toast.error("Informe um motivo");
      return;
    }
    try {
      await cancelar.mutateAsync({ id: cancelId, motivo: motivo.trim() });
      toast.success("Recibo cancelado");
      setCancelId(null);
      setMotivo("");
    } catch (e) {
      toast.error(traduzErro(e));
    }
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold">Recibos</h1>
            <p className="text-sm text-muted-foreground">Acompanhe e gerencie todos os recibos da loja.</p>
          </div>
          <Link to="/dashboard/recibos/novo">
            <Button>
              <Plus className="h-4 w-4 mr-1.5" /> Emitir recibo
            </Button>
          </Link>
        </header>

        {/* Métricas */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricaCard label="Total hoje" value={brl(metricas.totalHoje)} hint={`${metricas.qtdHoje} recibo(s)`} icon={DollarSign} />
          <MetricaCard label="Total este mês" value={brl(metricas.totalMes)} hint={`${metricas.qtdMes} recibo(s)`} icon={CalendarDays} />
          <MetricaCard label="Enviados WhatsApp" value={String(metricas.enviados)} hint={`${metricas.pctEnviados}% do total`} icon={MessageCircle} tone="success" />
          <MetricaCard label="Ticket médio" value={brl(metricas.ticket)} hint="Mês atual" icon={TrendingUp} />
        </div>

        {/* Filtros */}
        <Card className="p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por número, cliente ou valor" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Tabela */}
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Recibo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && recibos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum recibo encontrado</p>
                  </TableCell>
                </TableRow>
              )}
              {recibos.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/recibos/${r.id}`)}>
                  <TableCell className="font-mono text-xs">{r.numero_formatado}</TableCell>
                  <TableCell>{r.cliente_nome}</TableCell>
                  <TableCell className="text-right font-mono">{brl(r.total)}</TableCell>
                  <TableCell className="text-sm">{FORMA_LABEL[r.forma_pagamento]}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {r.enviado_whatsapp_em && <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      {r.enviado_email_em && <Mail className="h-3.5 w-3.5 text-blue-500" />}
                      {!r.enviado_whatsapp_em && !r.enviado_email_em && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/recibos/${r.id}`)}>Ver recibo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/recibos/${r.id}?print=1`)}>Baixar PDF</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (config) {
                              openWhatsApp(r, config);
                              marcar.mutate({ id: r.id, canal: "whatsapp" });
                            }
                          }}
                        >
                          Reenviar WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (config) {
                              openEmail(r, config);
                              marcar.mutate({ id: r.id, canal: "email" });
                            }
                          }}
                        >
                          Reenviar e-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copiarLink(r.id)}>Copiar link</DropdownMenuItem>
                        {r.status !== "cancelado" && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setCancelId(r.id);
                              setMotivo("");
                            }}
                          >
                            Cancelar recibo
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recibo</AlertDialogTitle>
            <AlertDialogDescription>
              O recibo permanecerá no histórico marcado como cancelado. Informe o motivo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do cancelamento" rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCancelar} className="bg-destructive hover:bg-destructive/90">
              Cancelar recibo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}