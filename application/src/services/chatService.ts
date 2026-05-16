import { api } from './api';

export type Conversation = {
  id: number;
  diary_entry_id: number | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ConversationDetail = Conversation & {
  messages: Message[];
};

export const chatService = {
  async list(diaryEntryId?: number): Promise<Conversation[]> {
    const query = diaryEntryId != null ? `?diary_id=${diaryEntryId}` : '';
    return api.get<Conversation[]>(`/conversations${query}`);
  },

  async create(diaryEntryId?: number): Promise<Conversation> {
    return api.post<Conversation>('/conversations', {
      diary_entry_id: diaryEntryId ?? null,
      title: 'New Chat',
    });
  },

  async getOrCreate(diaryEntryId: number): Promise<Conversation> {
    const list = await chatService.list(diaryEntryId);
    if (list.length > 0) return list[0];
    return chatService.create(diaryEntryId);
  },

  async getDetail(conversationId: number): Promise<ConversationDetail> {
    return api.get<ConversationDetail>(`/conversations/${conversationId}`);
  },

  async sendMessage(conversationId: number, message: string): Promise<{ user_message: Message; assistant_message: Message }> {
    return api.post(`/conversations/${conversationId}/messages`, { message });
  },
};
