import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LojaProvider } from "@/contexts/LojaContext";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import Login from "./pages/Login.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Catalogo from "./pages/Catalogo.tsx";
import CatalogoNovo from "./pages/CatalogoNovo.tsx";
import Vendas from "./pages/Vendas.tsx";
import PDV from "./pages/PDV.tsx";
import Cupons from "./pages/Cupons.tsx";
import VendasHistorico from "./pages/VendasHistorico.tsx";
import Recibo from "./pages/Recibo.tsx";
import Estoque from "./pages/Estoque.tsx";
import Clientes from "./pages/Clientes.tsx";
import NotasFiscais from "./pages/NotasFiscais.tsx";
import NotaFiscalDetalhe from "./pages/NotaFiscalDetalhe.tsx";
import CatalogoPublico from "./pages/CatalogoPublico.tsx";
import Admin from "./pages/Admin.tsx";
import WebhookAuditoria from "./pages/WebhookAuditoria.tsx";
import TestePagamento from "./pages/TestePagamento.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import Perfil from "./pages/Perfil.tsx";
import NotFound from "./pages/NotFound.tsx";
import RecibosLista from "./pages/RecibosLista.tsx";
import RecibosNovo from "./pages/RecibosNovo.tsx";
import RecibosPreview from "./pages/RecibosPreview.tsx";
import RecibosTemplates from "./pages/RecibosTemplates.tsx";
import ReciboPublico from "./pages/ReciboPublico.tsx";
import RedeDashboard from "./pages/RedeDashboard.tsx";
import RedeConfiguracoes from "./pages/RedeConfiguracoes.tsx";
import VendaAvulsa from "./pages/VendaAvulsa.tsx";
import CatalogoConfig from "./pages/CatalogoConfig.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LojaProvider>
        <InstitutionProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/novo" element={<CatalogoNovo />} />
          <Route path="/catalogo/:id" element={<CatalogoNovo />} />
          <Route path="/dashboard/catalogo/:section" element={<CatalogoConfig />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/venda-avulsa" element={<VendaAvulsa />} />
          <Route path="/cupons" element={<Cupons />} />
          <Route path="/vendas/historico" element={<VendasHistorico />} />
          <Route path="/vendas/:id/recibo" element={<Recibo />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/notas-fiscais" element={<NotasFiscais />} />
          <Route path="/notas-fiscais/:id" element={<NotaFiscalDetalhe />} />
          <Route path="/c/:lojaId" element={<CatalogoPublico />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/webhooks" element={<WebhookAuditoria />} />
          <Route path="/admin/teste-pagamento" element={<TestePagamento />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/dashboard/recibos" element={<RecibosLista />} />
          <Route path="/dashboard/recibos/novo" element={<RecibosNovo />} />
          <Route path="/dashboard/recibos/templates" element={<RecibosTemplates />} />
          <Route path="/dashboard/recibos/:id" element={<RecibosPreview />} />
          <Route path="/recibo/:id" element={<ReciboPublico />} />
          <Route path="/rede" element={<RedeDashboard />} />
          <Route path="/rede/configuracoes" element={<RedeConfiguracoes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </InstitutionProvider>
        </LojaProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
