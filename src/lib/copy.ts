// Product language that must stay exact (see docs/PLAN.md → Product rules).
export const COPY = {
  allResolved: "All tracked exit items resolved.",
  // The link proves possession, not HR identity — never claim more than this.
  validatedVia: "Validated via verification link",
  providedVia: "Provided via verification link",
  responseTarget: "ExitProof's default response target",
  disclaimer:
    "ExitProof tracks what you have submitted, what HR has validated and the documents HR has provided. It does not provide legal advice and does not calculate F&F entitlement. Response targets are product defaults, not legal deadlines.",
  hrLinkWarning:
    "Anyone with this link can validate this item. Share it only with your HR contact.",
  requestLinkWarning:
    "Anyone with this private link can respond to this request and upload a document for you. Share it only with your HR contact.",
  verifyPageNotice: "Anyone with this private link can perform this verification.",
  requestPageNotice: "Anyone with this private link can respond to this request.",
  uploadHint: "Upload only what HR needs to verify this item.",
  hrUploadHint: "Upload only the document the employee requested.",
  requestTag: "Request from HR",
} as const;
