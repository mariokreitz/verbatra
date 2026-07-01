import { Fragment, type ReactNode } from "react";

// Infinite horizontal marquee band. Pure CSS animation (the vk-band / vk-track classes in
// global.css, including the hover pause and the reduced-motion stop), so it has no client
// JS and stays a server component. The visible track is duplicated and hidden from
// assistive tech; one readable list carries the accessible names.
export type MarqueeItem = { key: string; label: string; node: ReactNode };

export function Marquee({
  items,
  direction,
  duration,
  label,
  maxWidth,
}: {
  items: ReadonlyArray<MarqueeItem>;
  direction: "left" | "right";
  duration: number;
  label: string;
  // Caps the band width so one (doubled) track stays at least as wide as the band, keeping short tracks seamless.
  maxWidth?: string;
}): ReactNode {
  const animation = `vk-marquee-${direction} ${duration}s linear infinite`;
  return (
    <div className="vk-band py-2" style={maxWidth ? { maxWidth } : undefined}>
      {/* One readable list for assistive tech; the visual track below is duplicated and hidden. */}
      <ul className="sr-only">
        <li>{label}:</li>
        {items.map((item) => (
          <li key={item.key}>{item.label}</li>
        ))}
      </ul>
      <div className="vk-track" style={{ animation }} aria-hidden="true">
        {items.map((item) => (
          <Fragment key={`a-${item.key}`}>{item.node}</Fragment>
        ))}
        {items.map((item) => (
          <Fragment key={`b-${item.key}`}>{item.node}</Fragment>
        ))}
      </div>
    </div>
  );
}
