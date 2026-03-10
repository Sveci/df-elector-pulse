import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, MapPin, Mail, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const contactSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  assunto: z.string().trim().min(3, "Assunto deve ter pelo menos 3 caracteres").max(200),
  mensagem: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
});

type ContactForm = z.infer<typeof contactSchema>;

const Contato = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<ContactForm>({
    nome: "",
    email: "",
    telefone: "",
    assunto: "",
    mensagem: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactForm, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof ContactForm;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("contact_submissions" as any).insert({
        nome: result.data.nome,
        email: result.data.email,
        telefone: result.data.telefone || null,
        assunto: result.data.assunto,
        mensagem: result.data.mensagem,
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Mensagem enviada com sucesso!");
    } catch {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(225,25%,6%)] text-gray-50 dark">
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(225,25%,6%)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-gray-300 hover:text-white hover:bg-white/10 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            Fale Conosco
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Tem alguma dúvida, sugestão ou quer saber mais sobre a plataforma?
            Entre em contato e responderemos o mais rápido possível.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Info Cards */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {[
              {
                icon: Mail,
                title: "Email",
                description: "contato@eleitor360.com.br",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
              },
              {
                icon: Phone,
                title: "Telefone",
                description: "(61) 9 9999-9999",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
              },
              {
                icon: MapPin,
                title: "Localização",
                description: "Brasília, DF — Brasil",
                color: "text-cyan-400",
                bg: "bg-cyan-500/10",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.03]"
              >
                <div className={`p-3 rounded-lg ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                </div>
              </div>
            ))}

            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.03]">
              <h3 className="font-semibold text-white text-sm mb-2">Horário de atendimento</h3>
              <p className="text-gray-400 text-sm">Segunda a Sexta: 9h às 18h</p>
              <p className="text-gray-400 text-sm">Sábado: 9h às 13h</p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-3"
          >
            {submitted ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
                <div className="p-4 rounded-full bg-green-500/10 mb-6">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Mensagem enviada!</h2>
                <p className="text-gray-400 mb-8">
                  Recebemos sua mensagem e entraremos em contato em breve.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                >
                  Voltar ao início
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm">Nome *</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => handleChange("nome", e.target.value)}
                      placeholder="Seu nome completo"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                    {errors.nome && <p className="text-xs text-red-400">{errors.nome}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm">Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="seu@email.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm">Telefone</Label>
                    <Input
                      value={form.telefone}
                      onChange={(e) => handleChange("telefone", e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                    {errors.telefone && <p className="text-xs text-red-400">{errors.telefone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm">Assunto *</Label>
                    <Input
                      value={form.assunto}
                      onChange={(e) => handleChange("assunto", e.target.value)}
                      placeholder="Assunto da mensagem"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                    {errors.assunto && <p className="text-xs text-red-400">{errors.assunto}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Mensagem *</Label>
                  <Textarea
                    value={form.mensagem}
                    onChange={(e) => handleChange("mensagem", e.target.value)}
                    placeholder="Escreva sua mensagem aqui..."
                    rows={5}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500 resize-none"
                  />
                  {errors.mensagem && <p className="text-xs text-red-400">{errors.mensagem}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white h-12 text-base gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar mensagem
                    </>
                  )}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contato;
