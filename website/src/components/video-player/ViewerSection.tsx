"use client";

import { useId, useState, type ReactNode } from "react";

export function ViewerSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className="min-h-0">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-textBright hover:bg-cardHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      <span>{title}</span><span aria-hidden="true">{open ? "▾" : "▸"}</span>
    </button>
    <div id={id} hidden={!open}>{children}</div>
  </section>;
}
