import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Result } from "@/lib/types";

/**
 * Runs an action, surfaces errors visibly (toast + returned message) and guards double clicks.
 * In live mode an action that needs an account sends the person to sign in and back.
 */
export function useAct() {
  const { toast } = useToast();
  const [, go] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const act = useCallback(async (fn: () => Result | Promise<Result>, success?: string): Promise<Result> => {
    if (lock.current) return { ok: false, error: "Already working on it." };
    lock.current = true; setPending(true);
    try {
      const r = (await fn()) as Result & { code?: string };
      if (r.ok) { setError(null); if (success) toastRef.current({ title: success }); }
      else if (r.code === "auth") {
        toastRef.current({ title: "Sign in to continue", description: "We'll bring you back here." });
        go(`/signin?next=${encodeURIComponent(window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "") + window.location.search)}`);
      } else { setError(r.error); toastRef.current({ title: "Couldn't do that", description: r.error, variant: "destructive" }); }
      return r;
    } finally {
      setTimeout(() => { lock.current = false; setPending(false); }, 250);
    }
  }, [go]);

  return { act, error, pending, clearError: () => setError(null) };
}
