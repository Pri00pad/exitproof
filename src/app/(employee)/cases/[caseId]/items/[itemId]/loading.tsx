import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-4 h-7 w-36 rounded-full" />
      <Card className="mt-6 space-y-4 p-5 sm:p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-11 w-44" />
      </Card>
    </main>
  );
}
