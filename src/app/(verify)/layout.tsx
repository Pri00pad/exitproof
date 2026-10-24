import type { Metadata } from "next";
import { BrandMark } from "@/components/Brand";

// Dedicated verifier layout: no employee navigation, identity or Log out,
// even if the person opening the link happens to be signed in.
export const metadata: Metadata = {
  title: "Verification Request · ExitProof",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandMark />
          <span className="text-sm font-medium text-slate-500">Verification Request</span>
        </div>
      </header>
      {children}
      <footer className="mx-auto w-full max-w-2xl px-4 py-8 text-xs leading-relaxed text-slate-500 sm:px-6">
        ExitProof records the decision made through this link. It does not provide legal advice and does not
        calculate F&amp;F entitlement.
      </footer>
    </>
  );
}
