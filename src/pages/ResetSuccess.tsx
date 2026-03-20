import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import logo from "@/assets/logo-rafael-prudente.png";

const ResetSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate("/login");
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Rafael Prudente - Deputado Federal"
            className="h-20 w-auto mx-auto mb-4"
          />
        </div>

        {/* Success Card */}
        <Card className="card-default">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">
              Senha Redefinida!
            </CardTitle>
            <CardDescription className="text-center text-base">
              Sua senha foi alterada com sucesso.
              <br />
              Agora você pode fazer login com suas novas credenciais.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {/* Success Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Redefinição bem-sucedida</span>
              </div>
              <p className="text-sm text-green-700 mt-2">
                Por motivos de segurança, você será direcionado para a tela de login.
              </p>
            </div>

            {/* Security Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h4 className="font-medium text-blue-900 mb-2">💡 Dicas de Segurança:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Mantenha sua senha segura e confidencial</li>
                <li>• Não compartilhe suas credenciais</li>
                <li>• Faça logout ao usar computadores públicos</li>
                <li>• Altere sua senha periodicamente</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/login")}
                className="w-full bg-primary-500 hover:bg-primary-600 focus:ring-primary-500"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Ir para Login
              </Button>

              <p className="text-sm text-gray-500">
                Redirecionamento automático em 10 segundos...
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          © 2025 Rafael Prudente - Deputado Federal
        </p>
      </div>
    </div>
  );
};

export default ResetSuccess;
