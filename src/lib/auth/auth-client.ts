"use client";

import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, rolesAuth } from "@/lib/auth/access";

/** Cliente de auth para componentes cliente (login, logout). */
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles: rolesAuth })],
});

export const { signIn, signOut, useSession } = authClient;
