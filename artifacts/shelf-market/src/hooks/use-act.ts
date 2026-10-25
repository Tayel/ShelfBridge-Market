import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Result } from "@/lib/types";

/** Runs a demo action, surfaces errors visibly (toast + returned message) and guards double clicks. */
export function useAct() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const act = useCallback((fn: () => Result, success?: string): Result => {
    if (lock.current) return { ok: false, error: "Already working on it." };
    lock.current = true; setPending(true);
    try {
      const r = fn();
      if (r.ok) { setError(null); if (success) toastRef.current({ title: success }); }
      else { setError(r.error); toastRef.current({ title: "Couldn't do that", description: r.error, variant: "destructive" }); }
      return r;
    } finally {
      setTimeout(() => { lock.current = false; setPending(false); }, 250);
    }
  }, []);

  return { act, error, pending, clearError: () => setError(null) };
}
