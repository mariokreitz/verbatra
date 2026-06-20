// Renders a JSON-LD structured-data block. The data is built from compile-time constants
// and our own content (never user input); we still escape "<" so a value can never close
// the <script> element early.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be emitted as raw script text.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
