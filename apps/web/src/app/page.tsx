import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// The marketing site lives at nodpeak.com now — this app is the product
// itself, so its root just routes straight into the real thing.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
