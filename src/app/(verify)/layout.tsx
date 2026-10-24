import type { Metadata } from "next";

// Dedicated verifier layout: no employee navigation, identity or Log out,
// even if the person opening the link happens to be signed in. The header is
// rendered by the page (VerifierHeader) because its label depends on the workflow.
export const metadata: Metadata = {
  title: "Verification Request · ExitProof",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="mx-auto w-full max-w-2xl px-4 py-8 text-xs leading-relaxed text-slate-500 sm:px-6">
        ExitProof records the action taken through this link. It does not provide legal advice and does not
        calculate F&amp;F entitlement.
      </footer>
    </>
  );
}
