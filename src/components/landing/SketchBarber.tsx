import { motion } from "framer-motion";

/** Pencil-sketch style barber — confident pose, lab coat, goatee, holding phone */
export function SketchBarber() {
  return (
    <motion.svg
      width="130"
      height="230"
      viewBox="0 0 130 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity, delay: 0.3 }}
    >
      {/* Head */}
      <ellipse cx="65" cy="50" rx="26" ry="28" stroke="#111" strokeWidth="2.2" fill="none" />

      {/* Hair — structured, professional */}
      <path d="M39 42 Q38 22 52 16 Q62 12 72 16 Q85 18 90 30 Q92 38 90 44"
        stroke="#111" strokeWidth="2" fill="none" />
      <path d="M44 32 Q50 24 58 22" stroke="#111" strokeWidth="1" fill="none" />
      <path d="M72 18 Q80 20 86 28" stroke="#111" strokeWidth="1" fill="none" />

      {/* Eyebrows — confident, slightly raised */}
      <path d="M48 40 Q54 37 60 40" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M68 40 Q74 37 80 40" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Eyes — confident/calm */}
      <ellipse cx="54" cy="48" rx="4" ry="4.5" stroke="#111" strokeWidth="1.5" fill="none" />
      <ellipse cx="76" cy="48" rx="4" ry="4.5" stroke="#111" strokeWidth="1.5" fill="none" />
      <circle cx="54" cy="48" r="2" fill="#111" />
      <circle cx="76" cy="48" r="2" fill="#111" />

      {/* Goatee */}
      <path d="M58 66 Q62 72 65 74 Q68 72 72 66" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M62 68 Q65 76 68 68" stroke="#111" strokeWidth="1" fill="none" />

      {/* Mouth — confident smirk */}
      <path d="M56 64 Q65 70 74 64" stroke="#111" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M63 55 Q65 60 67 55" stroke="#111" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Neck */}
      <line x1="58" y1="76" x2="58" y2="92" stroke="#111" strokeWidth="1.8" />
      <line x1="72" y1="76" x2="72" y2="92" stroke="#111" strokeWidth="1.8" />

      {/* Lab coat / Jaleco */}
      <path d="M25 92 Q25 88 45 86 L58 86 L72 86 Q85 88 85 92 L88 170 Q88 176 65 176 Q42 176 42 170 Z"
        stroke="#111" strokeWidth="2" fill="none" />
      {/* Coat lapels */}
      <path d="M52 86 L58 105 L65 86" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M78 86 L72 105 L65 86" stroke="#111" strokeWidth="1.5" fill="none" />
      {/* Pocket */}
      <rect x="46" y="115" width="14" height="10" rx="2" stroke="#111" strokeWidth="1" fill="none" />
      {/* Badge/crachá */}
      <rect x="48" y="117" width="8" height="3" rx="1" stroke="#111" strokeWidth="0.6" fill="none" />
      {/* Coat button */}
      <circle cx="65" cy="125" r="2" stroke="#111" strokeWidth="1" fill="none" />
      <circle cx="65" cy="140" r="2" stroke="#111" strokeWidth="1" fill="none" />
      {/* Wrinkle detail */}
      <path d="M50 130 Q55 135 52 145" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* Left arm — relaxed */}
      <path d="M25 95 Q10 105 12 140" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Left hand */}
      <ellipse cx="12" cy="143" rx="5" ry="6" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Right arm — holding phone */}
      <path d="M85 95 Q100 100 102 125" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Phone in right hand */}
      <rect x="94" y="120" width="16" height="28" rx="3" stroke="#111" strokeWidth="1.8" fill="none" />
      {/* Phone screen */}
      <rect x="96" y="124" width="12" height="18" rx="1" stroke="#111" strokeWidth="0.6" fill="none" />
      {/* "DUB" on phone screen */}
      <text x="98" y="136" fontFamily="sans-serif" fontSize="6" fontWeight="900" fill="#111">DUB</text>
      {/* Phone home button */}
      <circle cx="102" cy="145" r="1.5" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* Right hand holding phone */}
      <path d="M96 130 Q92 128 94 122" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M110 130 Q114 128 112 122" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Pants — dark fill for contrast */}
      <path d="M46 170 L44 210 L56 210 L58 176 L72 176 L74 210 L86 210 L84 170 Z"
        stroke="#111" strokeWidth="2" fill="#111" />

      {/* Shoes — dark */}
      <path d="M36 210 Q42 207 56 210 Q58 215 36 216 Z" stroke="#111" strokeWidth="1.5" fill="#111" />
      <path d="M74 210 Q82 207 92 210 Q94 215 74 216 Z" stroke="#111" strokeWidth="1.5" fill="#111" />
    </motion.svg>
  );
}
