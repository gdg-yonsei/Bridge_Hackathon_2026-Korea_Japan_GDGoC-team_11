import { baseApi } from './baseApi';
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '@/types/user';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthTokens & { user: User }, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', data: body }),
    }),
    register: build.mutation<AuthTokens & { user: User }, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', data: body }),
    }),
    me: build.query<User, void>({
      query: () => ({ url: '/auth/me' }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useMeQuery } = authApi;
