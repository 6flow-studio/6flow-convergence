"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return null;
  }

  async function submit(flow: "signIn" | "signUp") {
    if (submitting) return;
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn("password", {
        flow,
        email: normalizedEmail,
        password,
      });
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Authentication failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-surface-1 border border-edge-dim rounded-xl shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo/6flow_white.png" alt="6FLOW" width={40} height={40} />
            <span className="text-xl font-bold text-zinc-100 tracking-tight">
              6FLOW Studio
            </span>
          </div>

          <p className="text-sm text-zinc-400 text-center">
            Visual workflow builder for Chainlink CRE
          </p>

          <div className="w-full space-y-3">
            <Button
              variant="outline"
              className="w-full h-10 text-sm font-medium"
              onClick={() => void signIn("github")}
              disabled={submitting}
            >
              Sign in with GitHub
            </Button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-edge-dim" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-1 px-2 text-zinc-500">or</span>
              </div>
            </div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-10 text-sm font-medium"
                onClick={() => void submit("signIn")}
                disabled={submitting}
              >
                {submitting ? "Please wait..." : "Sign in"}
              </Button>
              <Button
                variant="outline"
                className="h-10 text-sm font-medium"
                onClick={() => void submit("signUp")}
                disabled={submitting}
              >
                {submitting ? "Please wait..." : "Create account"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
