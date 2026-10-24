"use client";

import { Card, button } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We couldn&apos;t load this page. Your data is safe. Please try again.
        </p>
        <button type="button" onClick={reset} className={`${button.primary} mt-6`}>
          Try again
        </button>
      </Card>
    </main>
  );
}
