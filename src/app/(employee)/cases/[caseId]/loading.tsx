import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Card className="space-y-4 p-5 sm:p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-2.5 w-full" />
      </Card>
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </Card>
        ))}
      </div>
    </main>
  );
}
