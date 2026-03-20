import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  name: string;
  /** Role atribuído na tabela user_roles. Pode ser null se o usuário ainda não tiver role associado. */
  role: string | null;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Gerar um ID único para esta sessão do navegador
const getOrCreateSessionId = (): string => {
  const storageKey = 'active_session_id';
  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
};

// Detectar informações do dispositivo/navegador
const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;

  let browser = 'Desconhecido';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Opera')) browser = 'Opera';

  let os = 'Desconhecido';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  let deviceType = 'Desktop';
  if (/Mobi|Android/i.test(userAgent)) deviceType = 'Mobile';
  else if (/Tablet|iPad/i.test(userAgent)) deviceType = 'Tablet';

  return { browser, os, deviceInfo: `${deviceType} - ${browser} no ${os}` };
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAuthenticated = !!user && !!session;

  // Registrar sessão no banco de dados
  const registerSession = useCallback(async (userId: string) => {
    const sessionId = getOrCreateSessionId();
    const { browser, os, deviceInfo } = getDeviceInfo();

    try {
      // Verificar se sessão já existe
      const { data: existingSession } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingSession) {
        // Atualizar última atividade
        await supabase
          .from('active_sessions')
          .update({
            last_activity: new Date().toISOString(),
            is_current: true
          })
          .eq('session_id', sessionId);
        return;
      }

      // Buscar sessões existentes do usuário
      const { data: existingSessions } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      // Se há outras sessões, marcar a mais antiga para logout em 5 minutos
      if (existingSessions && existingSessions.length > 0) {
        const oldestSession = existingSessions[0];
        const forceLogoutTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await supabase
          .from('active_sessions')
          .update({
            force_logout_at: forceLogoutTime,
            force_logout_reason: 'Nova sessão iniciada em outro dispositivo'
          })
          .eq('id', oldestSession.id);
      }

      // Criar nova sessão
      await supabase
        .from('active_sessions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          browser,
          os,
          device_info: deviceInfo,
          is_current: true
        });
    } catch (error) {
      console.error('Erro ao registrar sessão:', error);
    }
  }, []);

  // Encerrar sessão atual
  const terminateSession = useCallback(async () => {
    const sessionId = getOrCreateSessionId();
    try {
      await supabase
        .from('active_sessions')
        .delete()
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
    }
  }, []);

  // Fetch user profile from profiles table and role from user_roles table
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      // Buscar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      if (!profileData) {
        console.log('No profile found for user:', userId);
        return null;
      }

      // Buscar role da tabela user_roles (fonte correta)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      // Role vem de user_roles, com fallback para profiles.role
      // SECURITY: não assumir 'admin' como padrão — usar null quando role não encontrado
      const userRole = roleData?.role || profileData.role || null;

      if (!userRole) {
        console.warn('No role found for user:', userId, '— access will be restricted');
      }

      return {
        id: userId,
        email: profileData.email || '',
        name: profileData.name || 'User',
        role: userRole,
        avatar: profileData.avatar_url || undefined
      };
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);

        if (session?.user) {
          // Defer profile fetch to avoid blocking
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user.id);
            if (profile) {
              setUser(profile);
            }
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
          }
          setIsLoading(false);
        }, 0);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Credenciais inválidas",
          description: error.message || "E-mail ou senha incorretos.",
          variant: "destructive"
        });
        return false;
      }

      if (data.user) {
        // Registrar sessão após login bem-sucedido
        await registerSession(data.user.id);

        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo de volta!`
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Erro de autenticação",
        description: "Ocorreu um erro durante o login. Tente novamente.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            role: 'admin'
          }
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }

      if (data.user) {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Você já pode fazer login."
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro durante o cadastro. Tente novamente.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Encerrar sessão no banco antes do logout
      await terminateSession();

      await supabase.auth.signOut();

      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso."
      });

      navigate("/login");
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao desconectar.",
        variant: "destructive"
      });
    }
  };

  const resetPasswordForEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message || 'Erro ao enviar email de recuperação' };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update password error:', error);
      return { success: false, error: error.message || 'Erro ao atualizar senha' };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    signup,
    logout,
    resetPasswordForEmail,
    updatePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
