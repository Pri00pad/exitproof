import Link from "next/link";
import { Card, button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold text-blue-700">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The link may be wrong, or this page belongs to a different account.
        </p>
        <Link href="/" className={`${button.primary} mt-6`}>
          Go to my exit tracker
        </Link>
      </Card>
    </main>
  );
}
