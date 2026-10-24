import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { getUser } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { logOut } from "./login/actions";

// Employee-facing chrome: signed-in identity and Log out.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-lg">
            <BrandMark />
          </Link>
          {user && (
            <form action={logOut} className="flex min-w-0 items-center gap-3 text-sm">
              <span className="hidden truncate text-slate-500 sm:inline">{user.email}</span>
              <button
                type="submit"
                className="shrink-0 rounded-lg px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Log out
              </button>
            </form>
          )}
        </div>
      </header>
      {children}
      <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-xs leading-relaxed text-slate-500 sm:px-6">
        {COPY.disclaimer}
      </footer>
    </>
  );
}
