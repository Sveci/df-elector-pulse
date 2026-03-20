import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.warn("[404]", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Visual */}
        <div className="space-y-2">
          <p className="text-8xl font-extrabold text-primary/30 tracking-tight leading-none">
            404
          </p>
          <div className="mx-auto w-16 h-px bg-border" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Página não encontrada
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A página{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {location.pathname}
            </code>{" "}
            não existe ou foi movida. Verifique o endereço ou volte ao início.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="gap-2">
            <Home className="h-4 w-4" />
            Ir ao Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
