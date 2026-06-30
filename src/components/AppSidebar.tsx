import { LayoutDashboard, Package, LogOut, ShoppingCart, History, Boxes, FileText, Users, Shield, Settings, Scan, Ticket, User, Receipt, Network, Zap, Palette } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "PDV", url: "/vendas", icon: ShoppingCart },
  { title: "PDV Scanner", url: "/pdv", icon: Scan },
  { title: "Venda avulsa", url: "/venda-avulsa", icon: Zap },
  { title: "Histórico", url: "/vendas/historico", icon: History },
  { title: "Catálogo", url: "/catalogo", icon: Package },
  { title: "Personalizar catálogo", url: "/dashboard/catalogo/exibicao", icon: Palette },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Cupons", url: "/cupons", icon: Ticket },
  { title: "Recibos", url: "/dashboard/recibos", icon: Receipt },
  { title: "Notas Fiscais", url: "/notas-fiscais", icon: FileText },
  { title: "Meu perfil", url: "/perfil", icon: User },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasNetwork, setHasNetwork] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_super_admin");
      if (data === true) setIsSuperAdmin(true);
      const { data: insts } = await (supabase as any)
        .from("institutions")
        .select("id")
        .limit(1);
      if (insts && insts.length > 0) setHasNetwork(true);
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center px-2 py-3">
          <BrandLogo width={80} height={56} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {collapsed ? (
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === "/dashboard" || item.url === "/vendas"}
                            className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                            activeClassName="bg-sidebar-accent text-primary font-semibold"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard" || item.url === "/vendas"}
                        className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="bg-sidebar-accent text-primary font-semibold"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  {collapsed ? (
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/admin"
                            className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                            activeClassName="bg-sidebar-accent text-primary font-semibold"
                          >
                            <Shield className="h-4 w-4 shrink-0" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">Super Admin</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="bg-sidebar-accent text-primary font-semibold"
                      >
                        <Shield className="h-4 w-4 shrink-0" />
                        <span>Super Admin</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              )}
              {hasNetwork && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/rede"
                        className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="bg-sidebar-accent text-primary font-semibold"
                      >
                        <Network className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Rede</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/rede/configuracoes"
                        className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="bg-sidebar-accent text-primary font-semibold"
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Config. da rede</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="rounded-lg text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}