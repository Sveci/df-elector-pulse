import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: { name: string; type: string }[];
  created_at: string;
}

export const useAIConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Listar todas as conversas do usuário
  const listConversations = useCallback(async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error listing conversations:', error);
      return [];
    }

    setConversations(data || []);
    return data || [];
  }, [user]);

  // Criar nova conversa
  const createConversation = useCallback(async (title?: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: user.id,
        title: title || 'Nova conversa'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    setConversations(prev => [data, ...prev]);
    setCurrentConversationId(data.id);
    setMessages([]);
    return data;
  }, [user]);

  // Carregar mensagens de uma conversa
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setLoading(false);

    if (error) {
      console.error('Error loading messages:', error);
      return [];
    }

    // Type assertion para garantir o tipo correto
    const typedMessages: AIMessage[] = (data || []).map(msg => ({
      ...msg,
      role: msg.role as 'user' | 'assistant',
      files: msg.files as { name: string; type: string }[] | undefined
    }));

    setMessages(typedMessages);
    setCurrentConversationId(conversationId);
    return typedMessages;
  }, []);

  // Salvar mensagem
  const saveMessage = useCallback(async (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    files?: { name: string; type: string }[]
  ) => {
    const { data, error } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        files: files || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
      return null;
    }

    // Atualizar updated_at da conversa
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  }, []);

  // Atualizar título da conversa
  const updateTitle = useCallback(async (conversationId: string, title: string) => {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating title:', error);
      return false;
    }

    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, title } : c)
    );
    return true;
  }, []);

  // Excluir conversa
  const deleteConversation = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }

    setConversations(prev => prev.filter(c => c.id !== conversationId));

    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      setMessages([]);
    }

    return true;
  }, [currentConversationId]);

  // Carregar ou criar conversa inicial
  const loadOrCreateInitialConversation = useCallback(async () => {
    if (!user) return null;

    setLoading(true);
    const convs = await listConversations();

    if (convs.length > 0) {
      // Carregar última conversa
      await loadMessages(convs[0].id);
      setLoading(false);
      return convs[0];
    } else {
      // Criar nova conversa
      const newConv = await createConversation();
      setLoading(false);
      return newConv;
    }
  }, [user, listConversations, loadMessages, createConversation]);

  return {
    conversations,
    currentConversationId,
    messages,
    loading,
    setMessages,
    listConversations,
    createConversation,
    loadMessages,
    saveMessage,
    updateTitle,
    deleteConversation,
    loadOrCreateInitialConversation,
    setCurrentConversationId
  };
};
