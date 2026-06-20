"use client";

import { type ReactNode, useState } from "react";

export type TabsProps = {
  tabs: ReadonlyArray<{ id: string; label: string }>;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  children?: ReactNode;
};

export default function Tabs({
  tabs,
  value,
  defaultValue,
  onChange,
  children,
}: TabsProps): ReactNode {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id ?? "");
  const active = value ?? internal;

  function select(id: string) {
    if (value === undefined) {
      setInternal(id);
    }
    onChange?.(id);
  }

  return (
    <div className="not-prose">
      <div role="tablist" className="flex gap-4 border-b border-fd-border">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.id)}
              className={`pb-2 font-mono lowercase text-sm transition-colors ${
                selected
                  ? "text-fd-foreground"
                  : "text-fd-muted-foreground hover:text-fd-foreground"
              }`}
              // Inset shadow draws the 2px glow underline without layout shift.
              style={selected ? { boxShadow: "inset 0 -2px 0 var(--v-glow)" } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
