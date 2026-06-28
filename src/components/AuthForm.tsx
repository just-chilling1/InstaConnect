"use client";

import { useState, FormEvent } from "react";
import { IconBrandGoogleFilled } from "@tabler/icons-react";
import db from "@/lib/db";
import BrandMark from "@/components/BrandMark";
import SprocketDivider from "@/components/SprocketDivider";

type AuthFormProps = {
  heading: string;
  subheading: string;
};

const GOOGLE_CLIENT_NAME = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_NAME;

export default function AuthForm({ heading, subheading }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    setErrorMsg(null);
    try {
      await db.auth.sendMagicCode({ email: email.trim() });
      setSentTo(email.trim());
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } })?.body?.message ??
        "Couldn't send that code. Check the address and try again.";
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (!sentTo || !code.trim()) return;
    setPending(true);
    setErrorMsg(null);
    try {
      await db.auth.signInWithMagicCode({ email: sentTo, code: code.trim() });
      // Redirect happens via the auth-aware layout/page watching db.useAuth()
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } })?.body?.message ??
        "That code didn't match. Try again.";
      setErrorMsg(message);
      setCode("");
    } finally {
      setPending(false);
    }
  }

  function handleGoogleSignIn() {
    if (!GOOGLE_CLIENT_NAME) return;
    const url = db.auth.createAuthorizationURL({
      clientName: GOOGLE_CLIENT_NAME,
      redirectURL: window.location.origin,
    });
    window.location.href = url;
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-3 mb-8">
        <BrandMark className="w-10 h-10 text-accent" />
        <h1 className="font-display text-2xl font-semibold text-text">{heading}</h1>
        <p className="text-text-muted text-sm text-center">{subheading}</p>
      </div>

      {!sentTo ? (
        <form onSubmit={handleSendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
              Email address
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
            />
          </label>
          {errorMsg && <p className="text-sm text-negative">{errorMsg}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 bg-accent hover:bg-accent-strong disabled:opacity-50 text-accent-text font-medium rounded-lg py-2.5 transition-colors"
          >
            {pending ? "Sending code..." : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            We sent a 6-digit code to <span className="text-text">{sentTo}</span>.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
              Code
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors font-mono tracking-widest"
            />
          </label>
          {errorMsg && <p className="text-sm text-negative">{errorMsg}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 bg-accent hover:bg-accent-strong disabled:opacity-50 text-accent-text font-medium rounded-lg py-2.5 transition-colors"
          >
            {pending ? "Verifying..." : "Verify and continue"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setCode("");
              setErrorMsg(null);
            }}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            Use a different email
          </button>
        </form>
      )}

      {GOOGLE_CLIENT_NAME && !sentTo && (
        <>
          <div className="flex items-center gap-3 my-5">
            <SprocketDivider className="flex-1" />
            <span className="text-xs font-mono text-text-faint">or</span>
            <SprocketDivider className="flex-1" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <IconBrandGoogleFilled size={16} />
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
