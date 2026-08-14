import type { ReactNode } from "react";
import { useState } from "react";
import { deriveGlossaryWriteOutcome, glossaryReadOnlyReason } from "../client/glossary-editing.js";
import {
  type GlossaryGetResult,
  type GlossaryIndicator,
  type GlossaryWriteResult,
  MAX_GLOSSARY_TRANSLATION_LENGTH,
} from "../shared/rpc/glossary.js";
import { rpcClient } from "./api.js";
import { Badge } from "./Badge.js";
import { Button } from "./Button.js";
import { TextField } from "./Input.js";
import { EmptyState, SectionCard } from "./ui.js";

interface GlossaryWriter {
  readonly pending: string | undefined;
  readonly error: string | undefined;
  readonly write: (term: string, translation: string | null) => Promise<boolean>;
}

function useGlossaryWriter(onChange: (next: GlossaryWriteResult) => void): GlossaryWriter {
  const [pending, setPending] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function write(term: string, translation: string | null): Promise<boolean> {
    setPending(term);
    setError(undefined);
    const outcome = deriveGlossaryWriteOutcome(
      await rpcClient.call("glossary.write", { term, translation }),
    );
    setPending(undefined);
    if (outcome.kind === "error") {
      setError(outcome.message);
      return false;
    }
    onChange(outcome.glossary);
    return true;
  }

  return { pending, error, write };
}

export function glossaryIndicatorLabel(indicator: GlossaryIndicator): string {
  if (indicator.source === "file") {
    return `file (${indicator.path})`;
  }
  return indicator.source;
}

function TermValue({
  term,
  translation,
  redacted,
}: {
  readonly term: string;
  readonly translation: string;
  readonly redacted: boolean;
}): ReactNode {
  return (
    <>
      <p className="m-0 mt-0.5 text-sm text-foreground" dir="auto">
        {translation}
      </p>
      {redacted ? (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          The stored value for {term} looks like a secret, so it is hidden here and cannot be
          edited. Change it in the glossary file itself.
        </p>
      ) : null}
    </>
  );
}

function TermEditor({
  term,
  draft,
  busy,
  onDraft,
  onCancel,
  onSave,
}: {
  readonly term: string;
  readonly draft: string;
  readonly busy: boolean;
  readonly onDraft: (next: string) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}): ReactNode {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <TextField
        aria-label={`Translation for ${term}`}
        dir="auto"
        value={draft}
        disabled={busy}
        onChange={(event) => onDraft(event.target.value)}
      />
      <Button
        variant="primary"
        onClick={onSave}
        disabled={
          busy || draft.trim().length === 0 || draft.length > MAX_GLOSSARY_TRANSLATION_LENGTH
        }
      >
        Save
      </Button>
      <Button onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}

function GlossaryTermRow({
  term,
  translation,
  redacted,
  editable,
  writer,
}: {
  readonly term: string;
  readonly translation: string;
  readonly redacted: boolean;
  readonly editable: boolean;
  readonly writer: GlossaryWriter;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const busy = writer.pending === term;

  async function save(): Promise<void> {
    if (draft !== undefined && (await writer.write(term, draft))) {
      setDraft(undefined);
    }
  }

  return (
    <li className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-accent-foreground">{term}</span>
        {editable ? (
          <span className="flex items-center gap-1.5">
            {redacted || draft !== undefined ? null : (
              <Button
                onClick={() => setDraft(translation)}
                disabled={busy}
                aria-label={`Edit ${term}`}
              >
                Edit
              </Button>
            )}
            <Button
              onClick={() => void writer.write(term, null)}
              disabled={busy}
              aria-label={`Remove ${term}`}
            >
              Remove
            </Button>
          </span>
        ) : null}
      </div>
      {draft === undefined ? (
        <TermValue term={term} translation={translation} redacted={redacted} />
      ) : (
        <TermEditor
          term={term}
          draft={draft}
          busy={busy}
          onDraft={setDraft}
          onCancel={() => setDraft(undefined)}
          onSave={() => void save()}
        />
      )}
    </li>
  );
}

function GlossaryAddForm({ writer }: { readonly writer: GlossaryWriter }): ReactNode {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const busy = writer.pending !== undefined;
  const ready = term.trim().length > 0 && translation.trim().length > 0;

  async function add(): Promise<void> {
    if (await writer.write(term.trim(), translation)) {
      setTerm("");
      setTranslation("");
    }
  }

  return (
    <div className="mt-4 border-border border-t pt-4">
      <p className="m-0 mb-2 font-medium text-sm text-foreground">Add a term</p>
      <div className="flex flex-wrap items-center gap-2">
        <TextField
          aria-label="New glossary term"
          placeholder="Source term"
          value={term}
          disabled={busy}
          onChange={(event) => setTerm(event.target.value)}
        />
        <TextField
          aria-label="New glossary translation"
          placeholder="Translation to keep"
          dir="auto"
          value={translation}
          disabled={busy}
          onChange={(event) => setTranslation(event.target.value)}
        />
        <Button variant="primary" onClick={() => void add()} disabled={busy || !ready}>
          Add term
        </Button>
      </div>
    </div>
  );
}

export function GlossarySection({
  glossary,
  onChange,
}: {
  readonly glossary: GlossaryGetResult;
  readonly onChange: (next: GlossaryWriteResult) => void;
}): ReactNode {
  const writer = useGlossaryWriter(onChange);
  const readOnlyReason = glossaryReadOnlyReason(glossary.indicator);
  const terms = Object.entries(glossary.entries);

  return (
    <SectionCard
      title="Glossary"
      intro={`Source: ${glossaryIndicatorLabel(glossary.indicator)}`}
      className="mb-0"
      meta={
        terms.length > 0 ? (
          <Badge tone="neutral">
            {terms.length} {terms.length === 1 ? "term" : "terms"}
          </Badge>
        ) : undefined
      }
    >
      {readOnlyReason !== undefined ? (
        <p className="m-0 mb-3 text-sm text-muted-foreground">{readOnlyReason}</p>
      ) : null}
      {terms.length === 0 ? (
        <EmptyState title="No glossary configured">
          Add a glossary to keep brand terms and fixed vocabulary consistent across locales.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {terms.map(([term, translation]) => (
            <GlossaryTermRow
              key={term}
              term={term}
              translation={translation}
              redacted={glossary.redactedTerms.includes(term)}
              editable={readOnlyReason === undefined}
              writer={writer}
            />
          ))}
        </ul>
      )}
      {readOnlyReason === undefined ? <GlossaryAddForm writer={writer} /> : null}
      {writer.error !== undefined ? (
        <p className="m-0 mt-3 text-danger text-sm" role="alert">
          {writer.error}
        </p>
      ) : null}
    </SectionCard>
  );
}
