"use client";

import { useActionState, useState } from "react";
import { Alert, Card, Spinner, TextField, button } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { createAccount, logIn, type AuthFormState } from "./actions";

const initialState: AuthFormState = {};
type Mode = "login" | "signup";

export function LoginForms() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginAction, loginPending] = useActionState(logIn, initialState);
  const [signupState, signupAction, signupPending] = useActionState(createAccount, initialState);

  return (
    <Card className="p-6 sm:p-8">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <Tab id="login" label="Log In" mode={mode} onSelect={setMode} />
        <Tab id="signup" label="Create Account" mode={mode} onSelect={setMode} />
      </div>

      {/* Both forms stay in the DOM (hidden) so each keeps its own state. */}
      <form
        id="panel-login"
        role="tabpanel"
        aria-labelledby="tab-login"
        hidden={mode !== "login"}
        action={loginAction}
        className="mt-6 space-y-4"
      >
        {loginState.error && <Alert tone="error" role="alert">{loginState.error}</Alert>}
        <TextField label="Personal email" name="email" type="email" required autoComplete="email" defaultValue={loginState.email} />
        <TextField label="Password" name="password" type="password" required autoComplete="current-password" />
        <button type="submit" disabled={loginPending} className={`${button.primary} w-full`}>
          {loginPending && <Spinner />}
          {loginPending ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-600">
          New to ExitProof?{" "}
          <button type="button" onClick={() => setMode("signup")} className={button.link}>
            Create an account
          </button>
        </p>
      </form>

      <form
        id="panel-signup"
        role="tabpanel"
        aria-labelledby="tab-signup"
        hidden={mode !== "signup"}
        action={signupAction}
        className="mt-6 space-y-4"
      >
        {signupState.error && <Alert tone="error" role="alert">{signupState.error}</Alert>}
        <TextField
          label="Personal email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={signupState.email}
          hint="Use a personal address you'll still have after you leave."
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <TextField
          label="Confirm password"
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />
        <button type="submit" disabled={signupPending} className={`${button.primary} w-full`}>
          {signupPending && <Spinner />}
          {signupPending ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <button type="button" onClick={() => setMode("login")} className={button.link}>
            Log in
          </button>
        </p>
      </form>
    </Card>
  );
}

function Tab({ id, label, mode, onSelect }: { id: Mode; label: string; mode: Mode; onSelect: (m: Mode) => void }) {
  const selected = mode === id;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
      className={`min-h-10 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
        selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}
