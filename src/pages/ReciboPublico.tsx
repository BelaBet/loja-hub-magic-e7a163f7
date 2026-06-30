import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Download, Share2 } from "lucide-react";
import { ReciboPaper } from "@/components/recibos/ReciboPaper";
import { useReciboPublico } from "@/hooks/recibos/useRecibos";
import { publicReciboUrl } from "@/components/recibos/whatsappMessage";
import { toast } from "sonner";

export default function ReciboPublico() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useReciboPublico(id);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando recibo…</div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <h1 className="font-display text-xl font-bold">Recibo não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-1">Verifique o link ou contate a loja.</p>
        </div>
      </div>
    );
  }
  const { recibo, config } = data;
  const cancelado = recibo.status === "cancelado";

  async function compartilhar() {
    const url = publicReciboUrl(recibo.id);
    const text = `Recibo ${recibo.numero_formatado}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {/* ignored */}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível compartilhar");
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-1.5" /> Baixar PDF
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={compartilhar}>
            <Share2 className="h-4 w-4 mr-1.5" /> Compartilhar
          </Button>
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

        <div className="recibo-print-wrapper flex justify-center">
          <ReciboPaper recibo={recibo} config={config} />
        </div>
      </div>

    </div>
  );
}