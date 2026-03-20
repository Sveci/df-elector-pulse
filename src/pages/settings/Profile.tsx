import { PageHeader } from "@/components/PageHeader";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateProfile, uploadAvatar } from "@/hooks/useUpdateProfile";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  Calendar,
  Shield,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const profileTutorialSteps: Step[] = [
  { target: '[data-tutorial="profile-header"]', title: 'Meu Perfil', content: 'Gerencie suas informações pessoais e preferências de conta.' },
  { target: '[data-tutorial="profile-avatar"]', title: 'Foto de Perfil', content: 'Clique na imagem para alterar sua foto. Aceita JPG, PNG ou GIF até 2MB.' },
  { target: '[data-tutorial="profile-info"]', title: 'Informações Pessoais', content: 'Atualize seu nome, telefone e biografia.' },
  { target: '[data-tutorial="profile-account"]', title: 'Informações da Conta', content: 'Veja sua função no sistema, data de criação e última atualização.' },
  { target: '[data-tutorial="profile-save"]', title: 'Salvar Alterações', content: 'Clique para salvar todas as modificações feitas no seu perfil.' },
];

const Profile = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateProfile = useUpdateProfile();
  const { restartTutorial } = useTutorial("profile", profileTutorialSteps);

  const [name, setName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setTelefone(profile.telefone || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const initials = name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!user?.id) return;

    updateProfile.mutate({
      id: user.id,
      data: {
        name,
        telefone,
        bio,
        avatar_url: avatarUrl,
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TutorialOverlay page="profile" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between" data-tutorial="profile-header">
          <PageHeader icon={User} title="Meu Perfil" subtitle="Gerencie suas informações pessoais e preferências" />
          <TutorialButton onClick={restartTutorial} />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card do Avatar */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Foto de Perfil</CardTitle>
              <CardDescription>
                Clique na imagem para alterar
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={avatarUrl || undefined} alt={name} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {initials || <User className="h-12 w-12" />}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                JPG, PNG ou GIF. Máximo 2MB.
              </p>
            </CardContent>
          </Card>

          {/* Card de Informações */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize suas informações de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Sobre Mim</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Uma breve descrição sobre você..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card de Conta */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Informações da Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Função no Sistema</p>
                  <Badge variant="secondary" className="text-sm">
                    {user?.role || "Usuário"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Conta Criada em</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {profile?.created_at
                      ? format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "—"
                    }
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Última Atualização</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {profile?.updated_at
                      ? format(new Date(profile.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "—"
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="min-w-32"
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
