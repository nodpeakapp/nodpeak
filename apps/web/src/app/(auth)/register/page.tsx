import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "../actions";
import { AuthForm } from "../form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const open = (process.env.ALLOW_REGISTRATION ?? "true").toLowerCase() !== "false";
  return <AuthForm mode="register" action={registerAction} registrationOpen={open} />;
}
