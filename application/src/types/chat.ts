export interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  diary_entry_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface CreateConversationRequest {
  diary_entry_id: number;
  title: string;
}

export interface PostMessageRequest {
  message: string;
}

export interface PostMessageResponse {
  user_message: Message;
  assistant_message: Message;
}
