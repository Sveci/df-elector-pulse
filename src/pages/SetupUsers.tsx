import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// SECURITY: Hardcoded credentials have been removed.
// Use the form below to manually enter each user's e-mail, name and a
// temporary password that should be changed on first login.

interface UserForm {
  email: string;
  password: string;
  name: string;
}

const EMPTY_USER: UserForm = { email: "", password: "", name: "" };

const SetupUsers = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [user, setUser] = useState<UserForm>({ ...EMPTY_USER });

  const handleChange = (field: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setUser(prev => ({ ...prev, [field]: e.target.value }));
  };

  const createUser = async () => {
    if (!user.email || !user.password || !user.name) {
      toast.error("Preencha todos os campos antes de criar o usuário.");
      return;
    }

    setLoading(true);
    const newResults: string[] = [...results];

    try {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: {
          email: user.email,
          password: user.password,
          name: user.name,
          role: "admin",
        },
      });

      if (error) {
        newResults.push(`❌ ${user.email}: ${error.message}`);
        console.error(`Error creating ${user.email}:`, error);
      } else if (data?.error) {
        newResults.push(`❌ ${user.email}: ${data.error}`);
      } else {
        newResults.push(`✅ ${user.email}: Criado com sucesso!`);
        setUser({ ...EMPTY_USER });
      }
    } catch (err) {
      newResults.push(
        `❌ ${user.email}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
      console.error(`Exception creating ${user.email}:`, err);
    }

    setResults(newResults);
    setLoading(false);
    toast.success("Operação concluída!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Criar Usuário Administrativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preencha os dados do novo usuário. A senha deve ser trocada no primeiro acesso.
          </p>

          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={user.name}
              onChange={handleChange("name")}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@dominio.com"
              value={user.email}
              onChange={handleChange("email")}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha temporária</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={user.password}
              onChange={handleChange("password")}
              disabled={loading}
            />
          </div>

          <Button onClick={createUser} disabled={loading} className="w-full">
            {loading ? "Criando usuário..." : "Criar Usuário"}
          </Button>

          {results.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <h3 className="font-semibold mb-2">Resultados:</h3>
              <ul className="space-y-1 text-sm font-mono">
                {results.map((result, index) => (
                  <li key={index}>{result}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupUsers;
