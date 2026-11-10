import { onIdTokenChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import type { Role } from "../lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("requester");
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          const token = await u.getIdTokenResult();
          setRole((token.claims.role as Role) ?? "requester");
        }
        setLoading(false);
      }),
    [],
  );

  return { user, role, loading, isStaff: role === "agent" || role === "lead" };
}
