import { useState, useRef, useEffect } from "react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { useTenantContext } from "@/contexts/TenantContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Bot, 
  Send, 
  User, 
  Plus, 
  Trash2, 
  MessageSquare, 
  MoreVertical,
  Loader2,
  Sparkles,
  ChevronLeft,
  Menu,
  X,
  Paperclip,
  Copy,
  ImageIcon,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAIConversations, AIMessage } from "@/hooks/useAIConversations";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const aiAgentTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="ai-header"]',
    title: "Assistente de IA",
    content: "Converse com o assistente virtual para obter análises, insights e informações sobre a campanha.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="ai-conversations"]',
    title: "Histórico de Conversas",
    content: "Veja suas conversas anteriores. Clique para retomar ou crie uma nova conversa.",
    placement: "right",
  },
  {
    target: '[data-tutorial="ai-input"]',
    title: "Enviar Mensagem",
    content: "Digite sua pergunta e pressione Enter ou clique no botão para enviar. Você também pode anexar arquivos.",
    placement: "top",
  },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: AttachedFile[];
  conversationGroup?: string;
}

interface AttachedFile {
  name: string;
  type: "document" | "image";
  url?: string;
}

const AIAgent = () => {
  const { user } = useAuth();
  const { isDemoMode } = useDemoMask();
  const isMobile = useIsMobile();
  const { restartTutorial } = useTutorial("ai-agent", aiAgentTutorialSteps);
  const { activeTenant } = useTenantContext();
  
  const {
    conversations,
    currentConversationId,
    messages: dbMessages,
    loading,
    listConversations,
    createConversation,
    loadMessages,
    saveMessage,
    updateTitle,
    deleteConversation,
    loadOrCreateInitialConversation
  } = useAIConversations();

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Converter mensagens do banco para o formato local
  const convertDbMessages = (dbMsgs: AIMessage[]): Message[] => {
    return dbMsgs.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      files: msg.files?.map(f => ({ name: f.name, type: f.type as "document" | "image" }))
    }));
  };

  // Inicializar conversa
  useEffect(() => {
    if (user && !initialized) {
      loadOrCreateInitialConversation().then(() => {
        setInitialized(true);
      });
    }
  }, [user, initialized, loadOrCreateInitialConversation]);

  // Sincronizar mensagens do banco com estado local
  useEffect(() => {
    if (dbMessages.length > 0) {
      setLocalMessages(convertDbMessages(dbMessages));
    } else if (initialized && currentConversationId) {
      // Nova conversa - mostrar mensagem de boas-vindas
      setLocalMessages([{
        id: "welcome",
        role: "assistant",
        content: isDemoMode
          ? "Olá! 👋 Sou o assistente virtual da plataforma.\n\nEstou aqui para ajudá-lo com informações e análise de dados.\n\n**Como posso ajudar você hoje?** 🤝\n\n📊 Posso consultar:\n• Rankings de cadastros por região\n• Performance de coordenadores\n• Temas mais populares\n• Perfil demográfico"
          : "Olá! 👋 Sou o assistente virtual do Deputado Rafael Prudente.\n\nEstou aqui para ajudá-lo com informações sobre nossa campanha e análise de dados políticos.\n\n**Como posso ajudar você hoje?** 🤝\n\n📊 Posso consultar:\n• Rankings de cadastros por região\n• Performance de coordenadores\n• Temas mais populares\n• Perfil demográfico dos eleitores",
        timestamp: new Date(),
      }]);
    }
  }, [dbMessages, initialized, currentConversationId]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [localMessages, isTyping]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const fileType = file.type.startsWith("image/") ? "image" : "document";
      const newFile: AttachedFile = {
        name: file.name,
        type: fileType,
      };
      setAttachedFiles((prev) => [...prev, newFile]);
    });

    toast.success(`${files.length} arquivo(s) anexado(s) com sucesso.`);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!currentConversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    const currentInput = input;
    setLocalMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedFiles([]);
    setIsTyping(true);

    // Salvar mensagem do usuário no banco
    await saveMessage(
      currentConversationId,
      'user',
      currentInput,
      attachedFiles.length > 0 ? attachedFiles.map(f => ({ name: f.name, type: f.type })) : undefined
    );

    // Atualizar título da conversa se for a primeira mensagem do usuário
    const userMessagesCount = localMessages.filter(m => m.role === 'user').length;
    if (userMessagesCount === 0) {
      const shortTitle = currentInput.substring(0, 50) + (currentInput.length > 50 ? '...' : '');
      await updateTitle(currentConversationId, shortTitle);
      await listConversations();
    }

    try {
      const apiMessages = localMessages
        .filter(msg => msg.id !== 'welcome')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      apiMessages.push({
        role: "user",
        content: currentInput
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: apiMessages,
            conversationId: currentConversationId,
            userName: user?.name || ''
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";

      if (reader) {
        let done = false;
        
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    aiContent += content;
                  }
                } catch (e) {
                  // Ignorar erros de parse
                }
              }
            }
          }
        }

        // Adicionar resposta da IA
        const aiMessage: Message = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: aiContent,
          timestamp: new Date(),
        };
        
        setLocalMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);

        // Salvar resposta da IA no banco
        await saveMessage(currentConversationId, 'assistant', aiContent);
      }

    } catch (error) {
      console.error('Error calling AI:', error);
      setIsTyping(false);
      
      const errorContent = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.";
      
      setLocalMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      }]);

      await saveMessage(currentConversationId, 'assistant', errorContent);

      toast.error("Erro ao conectar com IA. Tente novamente.");
    }
  };

  const handleNewConversation = async () => {
    await createConversation();
    setLocalMessages([{
      id: "welcome",
      role: "assistant",
      content: isDemoMode
        ? "Olá! 👋 Sou o assistente virtual da plataforma.\n\nEstou aqui para ajudá-lo com informações e análise de dados.\n\n**Como posso ajudar você hoje?** 🤝"
        : "Olá! 👋 Sou o assistente virtual do Deputado Rafael Prudente.\n\nEstou aqui para ajudá-lo com informações sobre nossa campanha e análise de dados políticos.\n\n**Como posso ajudar você hoje?** 🤝",
      timestamp: new Date(),
    }]);
    setShowSidebar(false);
  };

  const handleSelectConversation = async (conversationId: string) => {
    await loadMessages(conversationId);
    setShowSidebar(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    const success = await deleteConversation(conversationId);
    if (success) {
      toast.success("Conversa excluída");
      // Se excluiu a conversa atual, criar uma nova
      if (conversationId === currentConversationId) {
        await handleNewConversation();
      }
    }
  };

  // Funções para renomear conversa
  const handleStartEditing = (e: React.MouseEvent, conv: { id: string; title: string }) => {
    e.stopPropagation();
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveTitle = async (conversationId: string) => {
    const originalTitle = conversations.find(c => c.id === conversationId)?.title;
    if (editingTitle.trim() && editingTitle.trim() !== originalTitle) {
      const success = await updateTitle(conversationId, editingTitle.trim());
      if (success) {
        toast.success("Conversa renomeada");
      }
    }
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent, conversationId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle(conversationId);
    } else if (e.key === 'Escape') {
      setEditingConversationId(null);
      setEditingTitle('');
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Mensagem copiada para a área de transferência.");
  };

  if (loading && !initialized) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] sm:h-[calc(100vh-4rem)] bg-background">
      <TutorialOverlay page="ai-agent" />
      {/* Sidebar de Conversas - Desktop */}
      {!isMobile && (
        <div className="w-64 border-r bg-card flex flex-col overflow-hidden flex-shrink-0" data-tutorial="ai-conversations">
          <div className="p-3 border-b flex-shrink-0">
            <Button onClick={handleNewConversation} className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova conversa
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors overflow-hidden ${
                    conv.id === currentConversationId 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 overflow-hidden w-0">
                    {editingConversationId === conv.id ? (
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveTitle(conv.id)}
                        onKeyDown={(e) => handleTitleKeyDown(e, conv.id)}
                        className="h-6 text-sm px-1"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p 
                        className="text-sm font-medium truncate max-w-full cursor-text"
                        onDoubleClick={(e) => handleStartEditing(e, conv)}
                        title="Duplo-clique para renomear"
                      >
                        {conv.title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Sidebar Mobile */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Conversas</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-3 flex-shrink-0">
              <Button onClick={handleNewConversation} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova conversa
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer overflow-hidden ${
                      conv.id === currentConversationId 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden w-0">
                      {editingConversationId === conv.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveTitle(conv.id)}
                          onKeyDown={(e) => handleTitleKeyDown(e, conv.id)}
                          className="h-6 text-sm px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p 
                          className="text-sm font-medium truncate max-w-full cursor-text"
                          onDoubleClick={(e) => handleStartEditing(e, conv)}
                          title="Duplo-clique para renomear"
                        >
                          {conv.title}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b p-2 sm:p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {isMobile ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowSidebar(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-sm font-semibold flex-1 text-center truncate px-2">
                  Assistente IA
                </h1>
                <Button variant="ghost" size="icon" onClick={handleNewConversation}>
                  <Plus className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold">{isDemoMode ? "Assistente IA da Plataforma" : "Assistente do Deputado Rafael Prudente"}</h1>
                    <p className="text-sm text-muted-foreground">Análise de dados políticos em tempo real</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-3">
              {localMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`flex flex-col gap-1 max-w-xl ${message.role === "user" ? "items-end" : "items-start"}`}>
                    <Card className={`p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      {message.role === "assistant" ? (
                        <div className="space-y-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    className="text-sm my-3 rounded"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                                    {children}
                                  </code>
                                );
                              },
                              p: ({ children }: any) => (
                                <p className="text-sm leading-relaxed mb-3 last:mb-0">
                                  {children}
                                </p>
                              ),
                              ul: ({ children }: any) => (
                                <ul className="my-2 ml-4 list-disc space-y-1 text-sm">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }: any) => (
                                <ol className="my-2 ml-4 list-decimal space-y-1 text-sm">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }: any) => (
                                <li className="text-sm leading-relaxed">
                                  {children}
                                </li>
                              ),
                              strong: ({ children }: any) => (
                                <strong className="font-semibold">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }: any) => (
                                <em className="italic text-muted-foreground">
                                  {children}
                                </em>
                              ),
                              h1: ({ children }: any) => (
                                <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }: any) => (
                                <h2 className="text-sm font-semibold mt-3 mb-2 first:mt-0">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }: any) => (
                                <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">
                                  {children}
                                </h3>
                              ),
                              blockquote: ({ children }: any) => (
                                <blockquote className="border-l-3 border-primary pl-3 italic my-2 text-sm text-muted-foreground">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      )}
                      
                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.files.map((file, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className={message.role === "user" ? "bg-primary-foreground/20 text-primary-foreground" : ""}
                            >
                              {file.type === "image" ? (
                                <ImageIcon className="h-3 w-3 mr-1" />
                              ) : (
                                <FileText className="h-3 w-3 mr-1" />
                              )}
                              {file.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.role === "assistant" && message.id !== 'welcome' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                      <AvatarImage src={user?.avatar} alt={user?.name || 'Usuário'} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {user?.name ? (
                          <span className="text-xs font-medium">
                            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="p-3 bg-card">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="bg-card border-t p-3 sm:p-4 flex-shrink-0" data-tutorial="ai-input">
          <div className="max-w-4xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((file, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {file.type === "image" ? (
                      <ImageIcon className="h-3 w-3 mr-1" />
                    ) : (
                      <FileText className="h-3 w-3 mr-1" />
                    )}
                    {file.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isTyping} className="flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgent;
