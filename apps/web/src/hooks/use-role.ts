"use client";

import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  return {
    role: role ?? null,
    isAdmin: role === "ADMIN",
    isEditor: role === "EDITOR",
    isViewer: role === "VIEWER",
    canMutate: role === "ADMIN" || role === "EDITOR",
    isLoading: status === "loading",
  };
}
