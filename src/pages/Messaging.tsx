import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Send, Phone, Mail, Calendar, IdCard, Plus, MoreVertical, Paperclip, Smile, Mic, Filter, User, Tag, Target, Zap } from "lucide-react";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const messagingTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="messaging-sidebar"]',
    title: "Lista de Conversas",
    content: "Veja todas as suas conversas. Busque contatos, filtre por status e veja mensagens não lidas.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="messaging-chat"]',
    title: "Área de Chat",
    content: "Visualize e responda mensagens. Veja o histórico completo da conversa com cada contato.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="messaging-input"]',
    title: "Enviar Mensagem",
    content: "Digite sua mensagem, anexe arquivos ou use emojis. Pressione Enter ou clique no botão para enviar.",
    placement: "top",
  },
  {
    target: '[data-tutorial="messaging-contact-info"]',
    title: "Informações do Contato",
    content: "Veja detalhes do contato selecionado: telefone, email, etiquetas e campanha associada.",
    placement: "left",
  },
];

// Mock data
const mockContacts = [{
  id: "1",
  name: "Laersia Sanson",
  phone: "+5527996320904",
  lastMessage: "Olá! Tudo bem? Posso te ajudar?",
  timestamp: "21:37",
  unread: 2,
  avatar: "",
  status: "online",
  campaign: "Campanha Saúde 2024",
  tags: ["Apoiador", "Saúde"],
  email: "laersia@email.com",
  inscriptionDate: "26.09.2025 21:37",
  cpf: "123.456.789-00"
}, {
  id: "2",
  name: "Kah",
  phone: "+5511987654321",
  lastMessage: "Obrigada pelas informações!",
  timestamp: "12:38",
  unread: 0,
  avatar: "",
  status: "away",
  campaign: "Orçamento Participativo",
  tags: ["Interessado"],
  email: "kah@email.com",
  inscriptionDate: "25.09.2025 12:30",
  cpf: "987.654.321-00"
}, {
  id: "3",
  name: "Julia Vestphal",
  phone: "+5521999888777",
  lastMessage: "Quando será o próximo evento?",
  timestamp: "ontem",
  unread: 1,
  avatar: "",
  status: "offline",
  campaign: "Eventos Comunitários",
  tags: ["Participativo", "Eventos"],
  email: "julia.vestphal@email.com",
  inscriptionDate: "24.09.2025 15:20",
  cpf: "456.789.123-00"
}, {
  id: "4",
  name: "COBRANÇA PRETTI - ISA",
  phone: "+5511888777666",
  lastMessage: "Preciso de informações sobre o projeto",
  timestamp: "ontem",
  unread: 0,
  avatar: "",
  status: "offline",
  campaign: "Projetos Sociais",
  tags: ["Projeto", "ISA"],
  email: "cobranca.pretti@email.com",
  inscriptionDate: "23.09.2025 09:15",
  cpf: "321.654.987-00"
}];
const mockMessages = [{
  id: "1",
  contactId: "1",
  sender: "contact",
  content: "Oi! boa noite",
  timestamp: "Sex, 25 Set 2025, 21:37",
  type: "text"
}, {
  id: "2",
  contactId: "1",
  sender: "contact",
  content: "Você vende gás?",
  timestamp: "Sex, 25 Set 2025, 21:37",
  type: "text"
}, {
  id: "3",
  contactId: "1",
  sender: "agent",
  content: "Oi, boa noite! Sou a Dani, posso te ajudar agora. O que você precisa?",
  timestamp: "Sex, 25 Set 2025, 21:37",
  type: "text"
}, {
  id: "4",
  contactId: "1",
  sender: "agent",
  content: "No momento, não vendemos gás (GLP ou GNV). Nosso foco é combustíveis líquidos, lubrificantes e serviços automotivos. Se quiser saber mais sobre esses serviços, só avisar!",
  timestamp: "Sex, 25 Set 2025, 21:38",
  type: "text"
}];
const Messaging = () => {
  const [selectedContact, setSelectedContact] = useState(mockContacts[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { restartTutorial } = useTutorial("messaging", messagingTutorialSteps);

  const filteredContacts = mockContacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone.includes(searchTerm);
    const matchesFilter = filterStatus === "all" || filterStatus === "unread" && contact.unread > 0 || filterStatus === "online" && contact.status === "online";
    return matchesSearch && matchesFilter;
  });
  const contactMessages = mockMessages.filter(msg => msg.contactId === selectedContact.id);
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    // Aqui seria a implementação real do envio
    console.log("Sending message:", newMessage);
    setNewMessage("");
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };
  return <div className="h-screen flex bg-gray-50 overflow-hidden">
      <TutorialOverlay page="messaging" />
      {/* Left Sidebar - Contacts List */}
      <div data-tutorial="messaging-sidebar" className="w-full sm:w-96 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 sm:p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Conversas</h2>
            <div className="flex gap-2">
              <TutorialButton onClick={restartTutorial} />
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar conversas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>

          {/* Filters */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as conversas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contacts List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredContacts.map(contact => <div key={contact.id} onClick={() => setSelectedContact(contact)} className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedContact.id === contact.id ? "bg-primary-50 border border-primary-200" : "hover:bg-gray-50"}`}>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback className="bg-primary-100 text-primary-700">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(contact.status)}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {contact.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{contact.timestamp}</span>
                        {contact.unread > 0 && <Badge className="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {contact.unread}
                          </Badge>}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {contact.lastMessage}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {contact.tags.slice(0, 2).map(tag => <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>)}
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </ScrollArea>
      </div>

      {/* Center - Chat Area */}
      <div data-tutorial="messaging-chat" className="flex-1 flex flex-col bg-gray-50 max-h-screen">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback className="bg-primary-100 text-primary-700">
                    {getInitials(selectedContact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(selectedContact.status)}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{selectedContact.name}</h3>
                <p className="text-sm text-gray-500">{selectedContact.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select defaultValue="aberto">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      Aberto
                    </span>
                  </SelectItem>
                  <SelectItem value="pendente">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      Pendente
                    </span>
                  </SelectItem>
                  <SelectItem value="fechado">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                      Fechado
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                Marcar como Concluído
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 min-h-full">
              {contactMessages.map(message => <div key={message.id} className={`flex ${message.sender === "agent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === "agent" ? "bg-primary-500 text-white" : "bg-white text-gray-900 border border-gray-200"}`}>
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.sender === "agent" ? "text-primary-100" : "text-gray-500"}`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>)}
            </div>
          </ScrollArea>
        </div>

        {/* Message Input - Fixed at bottom */}
        <div data-tutorial="messaging-input" className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Input placeholder="Digite uma mensagem..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()} className="pr-20" />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button onClick={handleSendMessage} size="sm">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Contact Info */}
      <div data-tutorial="messaging-contact-info" className="w-80 bg-white border-l border-gray-200 flex flex-col max-h-screen">
        {/* Contact Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={selectedContact.avatar} />
              <AvatarFallback className="bg-primary-100 text-primary-700 text-lg">
                {getInitials(selectedContact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{selectedContact.name}</h3>
              <p className="text-sm text-gray-500">{selectedContact.phone}</p>
            </div>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contact Details */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Telefone</p>
                    <p className="text-sm text-gray-600">{selectedContact.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">E-mail</p>
                    <p className="text-sm text-gray-600">{selectedContact.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Data de inscrição</p>
                    <p className="text-sm text-gray-600">{selectedContact.inscriptionDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <IdCard className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">CPF</p>
                    <p className="text-sm text-gray-600">{selectedContact.cpf}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Etiquetas
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.tags.map(tag => <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>)}
                </div>
              </CardContent>
            </Card>

            {/* Campaign */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Campanha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-primary-100 text-primary-700 hover:bg-primary-200">
                  {selectedContact.campaign}
                </Badge>
              </CardContent>
            </Card>

            {/* Automation */}


            {/* Sequences */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Sequências</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Nenhuma sequência ativa</p>
              </CardContent>
            </Card>

            {/* Custom Fields */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Campos Personalizados</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Nenhum campo personalizado</p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>;
};
export default Messaging;