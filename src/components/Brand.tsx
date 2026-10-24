import { ShieldCheckIcon } from "./icons";

export function BrandMark() {
  return (
    <span className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">
      <span className="flex size-7 items-center justify-center rounded-lg bg-blue-700 text-white">
        <ShieldCheckIcon className="size-4" />
      </span>
      ExitProof
    </span>
  );
}
