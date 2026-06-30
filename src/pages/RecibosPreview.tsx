import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Printer,
  FileText,
  MessageCircle,
  Mail,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { TemplateSeletor } from "@/components/recibos/TemplateSeletor";
import { ReciboPaper } from "@/components/recibos/ReciboPaper";
import { useRecibo, useReciboConfig, useMarcarEnviado } from "@/hooks/recibos/useRecibos";
import { openWhatsApp, openEmail, publicReciboUrl } from "@/components/recibos/whatsappMessage";
import type { TemplateRecibo } from "@/components/recibos/types";

export default function RecibosPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recibo, isLoading } = useRecibo(id);
  const { data: config } = useReciboConfig();
  const marcar = useMarcarEnviado();
  const [template, setTemplate] = useState<TemplateRecibo>("padrao");
  const autoPrint =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("print") === "1";

  useEffect(() => {
    if (config?.template_ativo) setTemplate(config.template_ativo);
  }, [config?.template_ativo]);

  useEffect(() => {
    if (!autoPrint || isLoading || !recibo || !config) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [autoPrint, isLoading, recibo, config]);

  function copiar() {
    if (!recibo) return;
    const url = publicReciboUrl(recibo.id);
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  if (isLoading || !recibo || !config) {
    return (
      <AppLayout>
        <div className="text-sm text-muted-foreground">Carregando recibo…</div>
      </AppLayout>
    );
  }

  const cancelado = recibo.status === "cancelado";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/recibos")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        {cancelado && (
          <Alert variant="destructive" className="print:hidden">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>RECIBO CANCELADO</AlertTitle>
            {recibo.motivo_cancelamento && (
              <AlertDescription>Motivo: {recibo.motivo_cancelamento}</AlertDescription>
            )}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
          {/* Sidebar */}
          <div className="space-y-4 print:hidden">
            <Card className="p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Template</div>
              <TemplateSeletor value={template} onChange={setTemplate} compact />
            </Card>
            <Card className="p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Enviar por</div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start"
                onClick={() => {
                  openWhatsApp(recibo, config);
                  marcar.mutate({ id: recibo.id, canal: "whatsapp" });
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  openEmail(recibo, config);
                  marcar.mutate({ id: recibo.id, canal: "email" });
                }}
              >
                <Mail className="h-4 w-4 mr-2" /> E-mail
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={copiar}>
                <LinkIcon className="h-4 w-4 mr-2" /> Copiar link
              </Button>
            </Card>
          </div>

          {/* Preview */}
          <div className="flex justify-center print:p-0">
            <div className="recibo-print-wrapper">
              <ReciboPaper recibo={recibo} config={config} template={template} />
            </div>
          </div>
        </div>
      </div>

    </AppLayout>
  );
}