"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import { button } from "./ui";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without async clipboard permission.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={onClick} className={className ?? button.secondary}>
      {copied ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** Read-only field showing a value (e.g. a link) with a copy button. */
export function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="block w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      />
      <CopyButton text={value} className={`${button.primary} shrink-0`} />
    </div>
  );
}
