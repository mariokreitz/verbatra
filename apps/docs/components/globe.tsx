// Marketing-hero globe: a line-art sphere with orbit rings, used only on the marketing home.
export function Globe({ className }: { className?: string }) {
  return (
    <svg
      width="380"
      height="380"
      viewBox="0 0 400 400"
      fill="none"
      role="img"
      aria-label="A globe of orbiting locales"
      className={className}
    >
      <defs>
        <radialGradient id="verbatra-globe-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#B39DDB" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#7C4DFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#7C4DFF" stopOpacity="0" />
        </radialGradient>
        <filter id="verbatra-node-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <circle cx="200" cy="190" r="180" fill="url(#verbatra-globe-glow)" />
      <g stroke="#B39DDB" strokeWidth="1" fill="none" opacity="0.3">
        <circle cx="200" cy="190" r="120" />
        <ellipse cx="200" cy="190" rx="120" ry="40" />
        <ellipse cx="200" cy="190" rx="120" ry="82" />
        <ellipse cx="200" cy="190" rx="46" ry="120" />
        <ellipse cx="200" cy="190" rx="90" ry="120" />
        <line x1="200" y1="70" x2="200" y2="310" />
        <line x1="80" y1="190" x2="320" y2="190" />
      </g>
      <g stroke="#B39DDB" strokeWidth="1" fill="none" opacity="0.45">
        <ellipse cx="200" cy="190" rx="168" ry="64" transform="rotate(24 200 190)" />
        <ellipse cx="200" cy="190" rx="164" ry="58" transform="rotate(-28 200 190)" />
      </g>
      <g fill="#D8C8F5">
        <circle cx="262" cy="120" r="3.2" filter="url(#verbatra-node-glow)" />
        <circle cx="262" cy="120" r="2.2" />
        <circle cx="120" cy="236" r="3" filter="url(#verbatra-node-glow)" />
        <circle cx="120" cy="236" r="2" />
        <circle cx="300" cy="232" r="2.6" filter="url(#verbatra-node-glow)" />
        <circle cx="300" cy="232" r="1.8" />
        <circle cx="168" cy="96" r="2.4" filter="url(#verbatra-node-glow)" />
        <circle cx="168" cy="96" r="1.6" />
      </g>
    </svg>
  );
}
