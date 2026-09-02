/** Sad client sitting — inline SVG icon, no external images */
export function SketchClient() {
  return (
    <svg
      width="160"
      height="180"
      viewBox="0 0 160 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cliente triste"
    >
      {/* Hair — messy spiky */}
      <path
        d="M62 38c-2-8 4-18 16-22 12-4 24-2 28 6 2 4 4 2 6-1 3-4-1-12-8-16s-18-6-28-2c-12 5-18 16-14 28z"
        fill="#111"
      />
      <path d="M58 42c-1-3 0-8 3-10" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M106 34c2-2 4-6 2-10" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M72 14c-2-6 2-12 6-14" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 10c0-6 4-10 8-11" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M94 16c2-5 6-8 10-8" stroke="#111" strokeWidth="2" strokeLinecap="round" />

      {/* Head */}
      <ellipse cx="82" cy="48" rx="22" ry="24" fill="white" stroke="#111" strokeWidth="2.5" />

      {/* Eyebrows — worried */}
      <path d="M72 40c2-3 6-4 9-2" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M90 38c3-2 7-1 9 2" stroke="#111" strokeWidth="2" strokeLinecap="round" />

      {/* Eyes — droopy */}
      <ellipse cx="76" cy="46" rx="2.5" ry="3" fill="#111" />
      <ellipse cx="92" cy="46" rx="2.5" ry="3" fill="#111" />
      <path d="M78 50c0 2 1 5 2 6" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="80" cy="57" r="1.2" fill="#111" opacity="0.5" />

      {/* Mouth — frown */}
      <path d="M77 60c2-3 6-3 8 0" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Stubble */}
      <circle cx="76" cy="62" r="0.6" fill="#111" opacity="0.3" />
      <circle cx="80" cy="64" r="0.6" fill="#111" opacity="0.3" />
      <circle cx="84" cy="63" r="0.6" fill="#111" opacity="0.3" />
      <circle cx="88" cy="62" r="0.6" fill="#111" opacity="0.3" />

      {/* Neck */}
      <path d="M76 70v8M88 70v8" stroke="#111" strokeWidth="2" strokeLinecap="round" />

      {/* T-shirt */}
      <path
        d="M56 80c-4 2-10 8-14 16l16 4 2-8h40l2 8 16-4c-4-8-10-14-14-16z"
        fill="white" stroke="#111" strokeWidth="2.5" strokeLinejoin="round"
      />
      <path d="M76 78l6 10 6-10" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 88l2 2 3-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M78 92l2 2 3-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 88l2 2 3-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 98l2 2 3-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M86 98l2 2 3-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Left arm — hand on face */}
      <path d="M62 56c-6 2-12 6-14 12-1 4 1 6 4 6 2 0 4-2 6-4l4-8" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="white" />

      {/* Right arm — resting */}
      <path d="M104 96c4 4 8 12 6 16-1 3-4 3-6 1l-4-10" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="white" />

      {/* Bench */}
      <rect x="30" y="120" width="100" height="8" rx="3" fill="white" stroke="#111" strokeWidth="2" />
      <rect x="34" y="128" width="92" height="6" rx="2" fill="white" stroke="#111" strokeWidth="1.5" />
      {Array.from({ length: 12 }).map((_, i) => (
        <circle key={i} cx={40 + i * 7} cy="131" r="1.5" fill="#111" opacity="0.2" />
      ))}

      {/* Pants */}
      <path d="M64 108h32v12c0 4-2 20-4 28h-8c0-8-1-16-4-24h-4c-3 8-4 16-4 24h-8c-2-8-4-24-4-28z" fill="#111" />

      {/* Shoes */}
      <path d="M56 148c-4 2-6 4-4 6h14c0-2-2-4-4-4z" fill="#111" />
      <path d="M96 148c4 2 6 4 4 6H86c0-2 2-4 4-4z" fill="#111" />

      {/* Phone on bench */}
      <rect x="110" y="114" width="12" height="8" rx="1.5" fill="white" stroke="#111" strokeWidth="1.5" />
      <line x1="114" y1="116" x2="118" y2="116" stroke="#111" strokeWidth="0.8" />
      <line x1="114" y1="118" x2="118" y2="118" stroke="#111" strokeWidth="0.8" />
    </svg>
  );
}
