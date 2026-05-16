"use client";

import { createContext, useContext } from "react";

type AuthState = {
  userId: string | null;
};

const AuthContext = createContext<AuthState>({ userId: null });

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };
