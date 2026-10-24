"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileIcon, UploadIcon, XIcon } from "@/components/icons";
import { button } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { ACCEPTED_FILE_TYPES, ACCEPT_ATTRIBUTE, MAX_FILES, MAX_FILE_BYTES } from "@/lib/files";

// Drag-and-drop / choose-files picker with the shared type, size and count
// rules. Used by employee evidence uploads and HR document uploads.
export function FilePicker({
  label,
  hint,
  inputLabel,
  files,
  onChange,
  onProblem,
  disabled,
}: {
  label: string;
  hint: string;
  inputLabel: string;
  files: File[];
  onChange: (files: File[]) => void;
  onProblem: (message: string | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED_FILE_TYPES[file.type]) {
        problems.push(`${file.name} isn't a PDF, PNG, JPG or WEBP file.`);
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name} is larger than 10 MB.`);
      } else if (file.size === 0) {
        problems.push(`${file.name} is empty.`);
      } else if (next.length >= MAX_FILES) {
        problems.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      } else if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    onChange(next);
    onProblem(problems.length ? problems.join(" ") : null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) addFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50/70"
        }`}
      >
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
          <UploadIcon className="size-5" />
        </span>
        <p className="mt-3 text-sm text-slate-700">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || files.length >= MAX_FILES}
            className={button.link}
          >
            Choose files
          </button>{" "}
          <span className="hidden sm:inline">or drag and drop them here</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG or WEBP · up to 10 MB each · max {MAX_FILES} files</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          tabIndex={-1}
          aria-label={inputLabel}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 px-3 py-2.5">
              <FileIcon className="size-4 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{file.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
