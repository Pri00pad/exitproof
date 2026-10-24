// Product language that must stay exact (see docs/PLAN.md → Product rules).
export const COPY = {
  allResolved: "All tracked exit items resolved.",
  // The link proves possession, not HR identity — never claim more than this.
  validatedVia: "Validated via verification link",
  responseTarget: "ExitProof's default response target",
  disclaimer:
    "ExitProof tracks what you have submitted and what HR has validated. It does not provide legal advice and does not calculate F&F entitlement. Response targets are product defaults, not legal deadlines.",
  hrLinkWarning:
    "Anyone with this link can validate this item. Share it only with your HR contact.",
  verifyPageNotice: "Anyone with this private link can perform this verification.",
  uploadHint: "Upload only what HR needs to verify this item.",
} as const;
