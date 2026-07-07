import { traduzErro } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import loginBg from "@/assets/login-bg.jpg";

/* ─── Google SVG inline ─── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

type AuthView = "login" | "signup" | "forgot";

const Login = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [nome, setNome] = useState("");
  const [nomeLoja, setNomeLoja] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate("/dashboard", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ── Google OAuth ── */
  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) { toast.error(traduzErro(error)); setGoogleLoading(false); }
  };

  /* ── Login e-mail ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(traduzErro(error));
  };

  /* ── Cadastro ── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) { toast.error("As senhas não coincidem."); return; }
    if (!nomeLoja.trim()) { toast.error("Informe o nome da sua loja."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: nome.trim() || undefined },
        },
      });
      if (error) { toast.error(traduzErro(error)); return; }
      const userId = data.user?.id;
      if (userId) {
        if (nome.trim()) {
          await supabase.from("profiles").upsert({ id: userId, nome: nome.trim(), updated_at: new Date().toISOString() });
        }
        const { data: lojaData, error: lojaError } = await supabase
          .from("lojas").insert({ nome: nomeLoja.trim() }).select("id").single();
        if (!lojaError && lojaData) {
          await supabase.from("loja_usuarios").insert({ user_id: userId, loja_id: lojaData.id, role: "owner" });
        }
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Recuperar senha ── */
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error("Informe seu e-mail"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(traduzErro(error)); return; }
    toast.success("E-mail enviado! Verifique sua caixa de entrada.");
    setView("login");
  };

  /* ── Componentes auxiliares ── */
  const Divider = () => (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-border" />
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">ou</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  const GoogleButton = ({ label }: { label: string }) => (
    <Button
      type="button" variant="outline"
      className="w-full h-11 gap-2.5 text-sm font-medium"
      onClick={handleGoogle} disabled={googleLoading || loading}
    >
      <GoogleIcon />
      {googleLoading ? "Redirecionando…" : label}
    </Button>
  );

  const PwToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button" onClick={onToggle} tabIndex={-1}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">

      {/* ── Painel da marca ── */}
      <aside translate="no" className="lg:w-1/2 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[280px] lg:min-h-screen">
        <img src={loginBg} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 flex justify-center lg:justify-start">
          <BrandLogo
            width={140} height={100}
            imgClassName="w-36 h-auto sm:w-40 lg:w-48 xl:w-56"
          />
        </div>

        <div className="relative z-10 max-w-md hidden lg:block">
          <h1 className="font-display text-3xl lg:text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-md">
            THAI encontra o lucro escondido na sua operação.
          </h1>
          <p className="mt-5 text-white/80 text-sm leading-relaxed drop-shadow">
            Gerencie suas vendas, estoque e equipe com inteligência — tudo em um só lugar.
          </p>
          <div className="mt-10 flex gap-8">
            <div>
              <div className="num text-xl font-bold drop-shadow">IA Inclusa</div>
              <div className="mono text-[10px] uppercase tracking-widest text-white/60 mt-1">Sem custo extra</div>
            </div>
            <div>
              <div className="num text-xl font-bold drop-shadow">Loja Online</div>
              <div className="mono text-[10px] uppercase tracking-widest text-white/60 mt-1">Inclusa no plano</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 mono text-xs text-white/40 hidden lg:block">
          © {new Date().getFullYear()} Ankor Tech
        </div>
      </aside>

      {/* ── Formulário ── */}
      <main className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-surface min-h-[60vh] lg:min-h-screen">
        <Card className="w-full max-w-md p-8 shadow-soft-md border-border">

          {/* VIEW: LOGIN */}
          {view === "login" && (
            <>
              <div className="mb-6">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Acesso</span>
                <h2 className="font-display text-2xl mt-1 tracking-tight">Bem-vindo de volta</h2>
              </div>
              <GoogleButton label="Entrar com Google" />
              <Divider />
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@loja.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"}
                      required minLength={6} autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" className="pr-10" />
                    <PwToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
                <div className="flex items-center justify-between text-sm pt-1">
                  <button type="button"
                    onClick={() => { setForgotEmail(email); setView("forgot"); }}
                    className="text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">
                    Esqueci minha senha
                  </button>
                  <button type="button" onClick={() => setView("signup")}
                    className="text-primary font-medium hover:underline underline-offset-4">
                    Criar conta
                  </button>
                </div>
              </form>
            </>
          )}

          {/* VIEW: CADASTRO */}
          {view === "signup" && (
            <>
              <div className="mb-6">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Cadastro</span>
                <h2 className="font-display text-2xl mt-1 tracking-tight">Criar sua conta</h2>
              </div>
              <GoogleButton label="Cadastrar com Google" />
              <Divider />
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Seu nome</Label>
                    <Input id="nome" type="text" autoComplete="name"
                      value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome-loja">Nome da loja <span className="text-destructive">*</span></Label>
                    <Input id="nome-loja" type="text" required
                      value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} placeholder="Minha Loja" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-s">E-mail</Label>
                  <Input id="email-s" type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@loja.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-s">Senha</Label>
                  <div className="relative">
                    <Input id="password-s" type={showPassword ? "text" : "password"}
                      required minLength={6} autoComplete="new-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres" className="pr-10" />
                    <PwToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-c">Confirmar senha</Label>
                  <div className="relative">
                    <Input id="password-c" type={showPasswordConfirm ? "text" : "password"}
                      required minLength={6} autoComplete="new-password"
                      value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="repita a senha" className="pr-10" />
                    <PwToggle show={showPasswordConfirm} onToggle={() => setShowPasswordConfirm(v => !v)} />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                  {loading ? "Criando conta…" : "Criar conta grátis"}
                </Button>
                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Já tem conta? </span>
                  <button type="button" onClick={() => setView("login")}
                    className="text-primary font-medium hover:underline underline-offset-4">Entrar</button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Ao criar conta você concorda com nossos{" "}
                  <a href="#" className="underline underline-offset-2 hover:text-primary">Termos de Uso</a> e{" "}
                  <a href="#" className="underline underline-offset-2 hover:text-primary">Política de Privacidade</a>.
                </p>
              </form>
            </>
          )}

          {/* VIEW: RECUPERAR SENHA */}
          {view === "forgot" && (
            <>
              <button type="button" onClick={() => setView("login")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <div className="mb-6">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Segurança</span>
                <h2 className="font-display text-2xl mt-1 tracking-tight">Recuperar senha</h2>
                <p className="text-muted-foreground text-sm mt-1">Enviaremos um link para redefinir sua senha.</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <Input id="forgot-email" type="email" required autoComplete="email"
                    value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="voce@loja.com" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? "Enviando…" : "Enviar link de recuperação"}
                </Button>
              </form>
            </>
          )}

        </Card>
      </main>
    </div>
  );
};

export default Login;
