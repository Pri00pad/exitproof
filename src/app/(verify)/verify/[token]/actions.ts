"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashVerifyToken } from "@/lib/tokens";
import { isWellFormedToken } from "@/lib/verification";

export type Decision = "approved" | "info_requested" | "rejected";
export type ClosedState = "invalid" | "expired" | "reviewed" | "not_current";
export type DecisionResult =
  | { ok: true; decision: Decision }
  | { ok: false; error: string; closed?: ClosedState };

const DECISIONS: readonly Decision[] = ["approved", "info_requested", "rejected"];
const MAX_COMMENT = 2000;

// hr_decide errors (see migration) → verifier-safe outcomes.
const CLOSED: Record<string, ClosedState> = {
  invalid_token: "invalid",
  token_expired: "expired",
  already_decided: "reviewed",
  submission_not_current: "not_current",
};

// The only caller of hr_decide. The browser sends the token from the URL; the
// server hashes it and calls the service-role-only function.
export async function recordDecision(input: { token: string; decision: Decision; comment: string }): Promise<DecisionResult> {
  const decision = input.decision;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";

  if (!DECISIONS.includes(decision)) return { ok: false, error: "Choose Approve, Request More Information or Reject." };
  if (typeof input.token !== "string" || !isWellFormedToken(input.token)) {
    return { ok: false, error: "This verification link is not valid.", closed: "invalid" };
  }
  if (decision !== "approved" && !comment) {
    return {
      ok: false,
      error: decision === "rejected" ? "Add a reason so the employee knows why." : "Tell the employee what information you need.",
    };
  }
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Comments must be ${MAX_COMMENT} characters or fewer.` };

  const admin = createAdminClient();
  const { error } = await admin.rpc("hr_decide", {
    p_token_hash: hashVerifyToken(input.token),
    p_decision: decision,
    p_comment: comment || null,
  });

  if (error) {
    const code = Object.keys(CLOSED).find((k) => error.message.includes(k));
    if (code) return { ok: false, error: "This request can no longer be reviewed.", closed: CLOSED[code] };
    if (error.message.includes("comment_required")) return { ok: false, error: "A comment is required for this decision." };
    return { ok: false, error: "We couldn't record your decision. Please try again." };
  }

  return { ok: true, decision };
}
