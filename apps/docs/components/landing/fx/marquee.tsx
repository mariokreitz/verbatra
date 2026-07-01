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
  repeat = 1,
}: {
  items: ReadonlyArray<MarqueeItem>;
  direction: "left" | "right";
  duration: number;
  label: string;
  // Caps the band width so one (doubled) track stays at least as wide as the band, keeping short tracks seamless.
  maxWidth?: string;
  // Repeats the item list within each half of the doubled track, so a short list (few logos)
  // still fills the band and the loop stays seamless.
  repeat?: number;
}): ReactNode {
  const animation = `vk-marquee-${direction} ${duration}s linear infinite`;
  // One half of the doubled track: the items, repeated `repeat` times, each copy given a
  // unique key prefix so React does not collide on the duplicated nodes.
  const half = Array.from({ length: repeat }, (_, r) =>
    items.map((item) => ({ item, dupKey: `${r}-${item.key}` })),
  ).flat();
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
        {half.map(({ item, dupKey }) => (
          <Fragment key={`a-${dupKey}`}>{item.node}</Fragment>
        ))}
        {half.map(({ item, dupKey }) => (
          <Fragment key={`b-${dupKey}`}>{item.node}</Fragment>
        ))}
      </div>
    </div>
  );
}
