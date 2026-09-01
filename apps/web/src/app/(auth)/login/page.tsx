import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";
import { AuthForm } from "../form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="login" action={loginAction} />;
}
