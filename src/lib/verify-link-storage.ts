// The raw HR link is never stored server-side. After submitting, the browser
// keeps it in sessionStorage (this tab only) so it survives a page refresh.

const key = (submissionId: string) => `exitproof:verify-link:${submissionId}`;

export function saveVerifyLink(submissionId: string, url: string) {
  try {
    sessionStorage.setItem(key(submissionId), url);
  } catch {
    // Storage unavailable (private mode etc.) — the link is still shown once.
  }
}

export function readVerifyLink(submissionId: string): string | null {
  try {
    return sessionStorage.getItem(key(submissionId));
  } catch {
    return null;
  }
}
