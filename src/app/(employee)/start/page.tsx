import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { StartForm } from "./StartForm";

// Screen 1 — Start My Exit.
export default async function StartPage() {
  await requireUser();

  return (
    <PageShell
      eyebrow="Start my exit"
      title="Set up your exit tracker"
      subtitle="A few details so HR knows who you are and what needs validating. It takes about a minute."
    >
      <StartForm />
    </PageShell>
  );
}
