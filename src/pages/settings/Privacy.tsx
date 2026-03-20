import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Lock,
  Shield,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ActiveSessionsCard } from "@/components/settings/ActiveSessionsCard";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const privacyTutorialSteps: Step[] = [
  { target: '[data-tutorial="priv-header"]', title: 'Privacidade e Segurança', content: 'Gerencie a segurança da sua conta.' },
  { target: '[data-tutorial="priv-password"]', title: 'Alterar Senha', content: 'Atualize sua senha regularmente para maior segurança.' },
  { target: '[data-tutorial="priv-sessions"]', title: 'Sessões Ativas', content: 'Veja todos os dispositivos conectados e encerre sessões.' },
  { target: '[data-tutorial="priv-lgpd"]', title: 'Direitos LGPD', content: 'Exporte seus dados ou solicite exclusão da conta.' },
  { target: '[data-tutorial="priv-danger"]', title: 'Zona de Perigo', content: 'Ações irreversíveis como exclusão de conta.' },
];

const Privacy = () => {
  const navigate = useNavigate();
  const { restartTutorial } = useTutorial("privacy", privacyTutorialSteps);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion state
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmEmail, setDeletionConfirmEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Data export state
  const [exportingData, setExportingData] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      toast.error((error as Error).message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  /**
   * LGPD Art. 18, V – Portabilidade
   * Downloads the user's personal data as a JSON file.
   */
  const handleExportMyData = async () => {
    setExportingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Collect all user-related data
      const [profileResult, sessionsResult] = await Promise.allSettled([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("active_sessions").select("*").eq("user_id", user.id),
      ]);

      const exportData = {
        export_info: {
          generated_at: new Date().toISOString(),
          legal_basis: "LGPD Art. 18, V – Portabilidade dos dados",
          platform: "Eleitor 360.ai",
          requester_id: user.id,
        },
        account: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        },
        profile: profileResult.status === "fulfilled" ? profileResult.value?.data : null,
        active_sessions:
          sessionsResult.status === "fulfilled" ? sessionsResult.value?.data : [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-eleitor360-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Seus dados foram exportados com sucesso!");
    } catch (error: unknown) {
      toast.error((error as Error).message || "Erro ao exportar dados");
    } finally {
      setExportingData(false);
    }
  };

  /**
   * LGPD Art. 18, VI – Eliminação dos dados
   * Calls the edge function to self-delete the account.
   */
  const handleDeleteAccount = async () => {
    if (!deletionConfirmEmail) {
      toast.error("Confirme seu e-mail para prosseguir");
      return;
    }

    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await supabase.functions.invoke("request-account-deletion", {
        body: {
          confirmEmail: deletionConfirmEmail,
          reason: deletionReason || "Solicitação via painel de privacidade",
        },
      });

      if (res.error) throw new Error(res.error.message);

      const result = res.data as { success: boolean; immediate: boolean; message: string };

      if (result.immediate) {
        // Immediate deletion: sign out and redirect
        toast.success("Conta excluída com sucesso.");
        await supabase.auth.signOut();
        navigate("/");
      } else {
        // Admin account: pending review
        toast.success(result.message, { duration: 8000 });
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || "Erro ao solicitar exclusão");
    } finally {
      setDeletingAccount(false);
    }
  };

  const passwordStrength = (password: string) => {
    if (!password) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: "Fraca", color: "bg-red-500" };
    if (strength <= 3) return { strength, label: "Média", color: "bg-yellow-500" };
    return { strength, label: "Forte", color: "bg-green-500" };
  };

  const { strength, label, color } = passwordStrength(newPassword);

  return (
    <DashboardLayout>
      <TutorialOverlay page="privacy" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4" data-tutorial="priv-header">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader icon={Shield} title="Privacidade e Segurança" subtitle="Gerencie sua segurança e exercite seus direitos sob a LGPD" className="flex-1" />
          <TutorialButton onClick={restartTutorial} />
        </div>

        <div className="grid gap-6">
          {/* ── Alterar Senha ───────────────────────────────── */}
          <Card data-tutorial="priv-password">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>
                Mantenha sua conta segura atualizando sua senha regularmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {newPassword && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded ${
                              i <= strength ? color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Força da senha: {label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {confirmPassword && newPassword && (
                    <div className="flex items-center gap-1 text-xs">
                      {confirmPassword === newPassword ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-green-600">Senhas coincidem</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span className="text-red-600">Senhas não coincidem</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
                >
                  {changingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Alterar Senha
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Sessões Ativas ──────────────────────────────── */}
          <div data-tutorial="priv-sessions">
            <ActiveSessionsCard />
          </div>

          {/* ── Segurança da Conta ─────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança da Conta
              </CardTitle>
              <CardDescription>
                Informações e opções de segurança adicionais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Autenticação de Dois Fatores</p>
                    <p className="text-sm text-muted-foreground">
                      Em breve você poderá adicionar uma camada extra de segurança à sua conta.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Direitos LGPD ───────────────────────────────── */}
          <Card data-tutorial="priv-lgpd">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Seus Direitos (LGPD – Lei 13.709/2018)
              </CardTitle>
              <CardDescription>
                Exerça seus direitos como titular de dados pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Portability */}
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Exportar Meus Dados</p>
                    <p className="text-sm text-muted-foreground">
                      Baixe uma cópia de todos os seus dados pessoais armazenados na plataforma.{" "}
                      <span className="text-xs text-muted-foreground/70">(Art. 18, V – Portabilidade)</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportMyData}
                    disabled={exportingData}
                    className="flex-shrink-0"
                  >
                    {exportingData ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exportar
                  </Button>
                </div>
              </div>

              {/* Other rights */}
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <p className="text-sm font-medium">Outros direitos disponíveis:</p>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                  <li>Confirmar a existência de tratamento dos seus dados <span className="text-xs">(Art. 18, I)</span></li>
                  <li>Acessar e corrigir seus dados <span className="text-xs">(Art. 18, II e III)</span></li>
                  <li>Anonimização ou bloqueio de dados desnecessários <span className="text-xs">(Art. 18, IV)</span></li>
                  <li>Revogar o consentimento a qualquer momento <span className="text-xs">(Art. 18, IX)</span></li>
                  <li>Informações sobre o compartilhamento de dados <span className="text-xs">(Art. 18, VII)</span></li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Para exercer qualquer um desses direitos, acesse nosso{" "}
                  <Link
                    to="/lgpd-direitos"
                    className="text-primary underline hover:text-primary/80"
                  >
                    formulário de solicitação de direitos LGPD
                  </Link>{" "}
                  ou entre em contato com nosso DPO:{" "}
                  <a href="mailto:dpo@eleitor360.ai" className="text-primary underline">
                    dpo@eleitor360.ai
                  </a>
                </p>
              </div>

              {/* Policy links */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  to="/politica-de-privacidade"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Política de Privacidade
                </Link>
                <Link
                  to="/lgpd-cookies"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Política de Cookies
                </Link>
                <Link
                  to="/lgpd-direitos"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Formulário LGPD
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* ── Zona de Perigo ──────────────────────────────── */}
          <Card className="border-destructive/50" data-tutorial="priv-danger">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription>
                Ações irreversíveis relacionadas à sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-destructive/30 p-4 bg-destructive/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Excluir Minha Conta</p>
                    <p className="text-sm text-muted-foreground">
                      Solicita a eliminação permanente da sua conta e dados.{" "}
                      <span className="text-xs">(LGPD Art. 18, VI)</span>
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="flex-shrink-0">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Conta
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          Excluir minha conta permanentemente
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>
                              Esta ação é <strong>irreversível</strong>. Todos os seus dados pessoais
                              serão permanentemente removidos conforme a{" "}
                              <strong>LGPD Art. 18, VI</strong>.
                            </p>
                            <div className="space-y-2">
                              <Label htmlFor="deletionReason">Motivo (opcional)</Label>
                              <Textarea
                                id="deletionReason"
                                placeholder="Ex: Não quero mais usar a plataforma"
                                value={deletionReason}
                                onChange={(e) => setDeletionReason(e.target.value)}
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="deletionConfirmEmail">
                                Digite seu e-mail para confirmar <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="deletionConfirmEmail"
                                type="email"
                                placeholder="seu@email.com"
                                value={deletionConfirmEmail}
                                onChange={(e) => setDeletionConfirmEmail(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                          setDeletionReason("");
                          setDeletionConfirmEmail("");
                        }}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={deletingAccount || !deletionConfirmEmail}
                          onClick={handleDeleteAccount}
                        >
                          {deletingAccount ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Confirmar exclusão
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Privacy;
