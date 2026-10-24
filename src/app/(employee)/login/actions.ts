"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH, formText, isEmail } from "@/lib/validation";

export type AuthFormState = { error?: string; email?: string };

export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = formText(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isEmail(email) || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Please wait a minute and try again.", email };
    return { error: "Email or password is incorrect.", email };
  }

  redirect("/");
}

export async function createAccount(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = formText(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!isEmail(email)) return { error: "Enter a valid personal email address.", email };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  }
  if (password !== confirm) return { error: "Passwords do not match.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "An account with this email already exists. Log in instead.", email };
    }
    if (error.code === "weak_password") return { error: error.message, email };
    if (error.status === 429) return { error: "Too many attempts. Please wait a minute and try again.", email };
    return { error: "Could not create your account. Please try again.", email };
  }
  // With "Confirm email" off, Supabase returns a session immediately.
  if (!data.session) {
    return { error: "Account created, but email confirmation is switched on for this project, so you can't log in yet.", email };
  }

  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
