import { baseApi } from './baseApi';
import type {
  Conversation,
  CreateConversationRequest,
  PostMessageRequest,
  PostMessageResponse,
} from '@/types/chat';

export const chatApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConversations: build.query<Conversation[], { diary_id?: number }>({
      query: (params) => ({ url: '/conversations', params }),
      providesTags: ['Conversation'],
    }),
    createConversation: build.mutation<Conversation, CreateConversationRequest>({
      query: (body) => ({ url: '/conversations', method: 'POST', data: body }),
      invalidatesTags: ['Conversation'],
    }),
    getConversation: build.query<Conversation, number>({
      query: (id) => ({ url: `/conversations/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Conversation', id }],
    }),
    deleteConversation: build.mutation<void, number>({
      query: (id) => ({ url: `/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Conversation'],
    }),
    postMessage: build.mutation<PostMessageResponse, { conversationId: number; body: PostMessageRequest }>({
      query: ({ conversationId, body }) => ({
        url: `/conversations/${conversationId}/messages`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [{ type: 'Conversation', id: conversationId }],
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useCreateConversationMutation,
  useGetConversationQuery,
  useDeleteConversationMutation,
  usePostMessageMutation,
} = chatApi;
