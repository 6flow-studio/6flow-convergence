"use client";

import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type LinkState = "loading" | "authenticating" | "sending" | "success" | "error";

function isLocalCallback(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  );
}

export default function TuiLinkPage() {
  const params = useSearchParams();
  const callback = params.get("callback");
  const nonce = params.get("nonce");

  const { isLoading, isAuthenticated } = useConvexAuth();
  const token = useAuthToken();
  const { signIn } = useAuthActions();

  const [state, setState] = useState<LinkState>("loading");
  const [message, setMessage] = useState("Preparing TUI authentication...");
  const startedSignIn = useRef(false);
  const sentCallback = useRef(false);

  const callbackUrl = useMemo(() => {
    if (!callback) return null;
    try {
      const url = new URL(callback);
      return isLocalCallback(url) ? url : null;
    } catch {
      return null;
    }
  }, [callback]);

  useEffect(() => {
    if (!callbackUrl || !nonce) {
      setState("error");
      setMessage("Missing or invalid callback parameters.");
      return;
    }

    if (isLoading) {
      setState("loading");
      setMessage("Checking authentication...");
      return;
    }

    if (!isAuthenticated) {
      setState("authenticating");
      setMessage("Redirecting to GitHub sign-in...");
      if (!startedSignIn.current) {
        startedSignIn.current = true;
        void signIn("github", { redirectTo: window.location.href }).catch((error) => {
          setState("error");
          setMessage(
            error instanceof Error ? error.message : "Failed to start sign-in"
          );
        });
      }
      return;
    }

    if (!token) {
      setState("loading");
      setMessage("Finalizing authenticated session...");
      return;
    }

    if (sentCallback.current) {
      return;
    }

    sentCallback.current = true;
    setState("sending");
    setMessage("Sending token back to TUI...");

    void fetch(callbackUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, nonce }),
    })
      .then(async (response) => {
        if (!response.ok) {
          let errorMessage = `Callback failed (${response.status})`;
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) errorMessage = payload.error;
          } catch {
            // Ignore parse errors.
          }
          throw new Error(errorMessage);
        }
        setState("success");
        setMessage("TUI linked successfully. You can return to the terminal.");
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Failed to link TUI");
      });
  }, [callbackUrl, isAuthenticated, isLoading, nonce, signIn, token]);

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-edge-dim bg-surface-1 p-6 space-y-4">
        <h1 className="text-zinc-100 text-lg font-semibold tracking-tight">TUI Link</h1>
        <p className="text-zinc-400 text-sm">{message}</p>
        <div className="text-xs text-zinc-500">
          State: <span className="text-zinc-300">{state}</span>
        </div>
      </div>
    </div>
  );
}
