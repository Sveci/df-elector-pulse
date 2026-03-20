import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ShortUrlRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectToOriginalUrl = async () => {
      if (!code) {
        setError("Código inválido");
        return;
      }

      try {
        // Fetch the original URL
        const { data, error: fetchError } = await supabase
          .from("short_urls")
          .select("original_url, clicks")
          .eq("code", code)
          .single();

        if (fetchError || !data) {
          console.error("ShortUrlRedirect: URL not found:", fetchError);
          setError("Link não encontrado ou expirado");
          return;
        }

        // Increment click count (fire and forget)
        supabase
          .from("short_urls")
          .update({ clicks: (data.clicks || 0) + 1 })
          .eq("code", code)
          .then(() => console.log("Click tracked"));

        // Redirect to the original URL
        window.location.href = data.original_url;

      } catch (err: any) {
        console.error("ShortUrlRedirect: Error:", err);
        setError("Erro ao processar o redirecionamento");
      }
    };

    redirectToOriginalUrl();
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-2 text-foreground">Link não encontrado</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <a
            href="/"
            className="text-primary hover:underline"
          >
            Voltar à página inicial
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

export default ShortUrlRedirect;
