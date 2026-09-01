import Link from "next/link";
import { LayoutDashboard, Code2, MessageSquare, TrendingUp, Inbox, Settings, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../(auth)/actions";
import { isSelfHost } from "@/lib/enums";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/widgets", label: "Widgets", Icon: Code2 },
  { href: "/growth", label: "Growth", Icon: TrendingUp },
  { href: "/leads", label: "Leads", Icon: Inbox },
  { href: "/reviews", label: "Reviews", Icon: MessageSquare },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-800 pb-4">
        <Link href="/dashboard">
          <Logo />
        </Link>

        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-surface-850 hover:text-zinc-100"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="order-2 flex items-center gap-3 sm:order-3">
          <span className="hidden text-xs text-zinc-500 sm:block">
            {user.email}
            {!isSelfHost() && (
              <span className="ml-2 chip !py-0.5 !text-[10px]">{user.plan}</span>
            )}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-surface-850 hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-8">{children}</main>

      <footer className="border-t border-surface-800 pt-5 text-xs text-zinc-600">
        Nodpeak · {isSelfHost() ? "self-hosted" : "managed cloud"} ·{" "}
        <a
          href="https://github.com/nodpeakapp/nodpeak"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400"
        >
          source
        </a>
      </footer>
    </div>
  );
}
