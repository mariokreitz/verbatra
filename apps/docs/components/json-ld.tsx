/** Renders a JSON-LD script block, escaping "<" so a value can never close the script element early. */
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
