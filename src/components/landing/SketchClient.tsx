import { motion } from "framer-motion";

/** Pencil-sketch style client character — confused expression, hand on head */
export function SketchClient() {
  return (
    <motion.svg
      width="120"
      height="220"
      viewBox="0 0 120 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity }}
    >
      {/* Head */}
      <ellipse cx="60" cy="52" rx="28" ry="30" stroke="#111" strokeWidth="2.2" fill="none" />

      {/* Hair — messy/casual */}
      <path d="M32 45 Q30 25 45 18 Q55 12 65 16 Q78 12 88 22 Q92 30 88 42"
        stroke="#111" strokeWidth="2" fill="none" />
      <path d="M36 38 Q40 30 48 28" stroke="#111" strokeWidth="1" fill="none" />
      <path d="M70 20 Q76 16 84 24" stroke="#111" strokeWidth="1" fill="none" />

      {/* Eyebrows — furrowed/worried */}
      <path d="M42 42 Q48 37 56 42" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M64 42 Q72 37 78 42" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Eyes — worried/wide */}
      <ellipse cx="50" cy="50" rx="4.5" ry="5" stroke="#111" strokeWidth="1.5" fill="none" />
      <ellipse cx="72" cy="50" rx="4.5" ry="5" stroke="#111" strokeWidth="1.5" fill="none" />
      <circle cx="50" cy="50" r="2" fill="#111" />
      <circle cx="72" cy="50" r="2" fill="#111" />

      {/* Mouth — worried/unsure */}
      <path d="M50 68 Q55 64 60 66 Q65 64 70 68" stroke="#111" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M59 58 Q60 62 62 58" stroke="#111" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Neck */}
      <line x1="54" y1="80" x2="54" y2="95" stroke="#111" strokeWidth="1.8" />
      <line x1="66" y1="80" x2="66" y2="95" stroke="#111" strokeWidth="1.8" />

      {/* T-shirt body */}
      <path d="M28 95 Q28 92 40 90 L54 90 L66 90 Q80 92 80 95 L82 155 Q82 162 60 162 Q38 162 38 155 Z"
        stroke="#111" strokeWidth="2" fill="none" />
      {/* Collar */}
      <path d="M48 90 Q60 100 72 90" stroke="#111" strokeWidth="1.5" fill="none" />
      {/* Shirt wrinkle */}
      <path d="M50 110 Q55 115 52 125" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M68 108 Q65 118 70 128" stroke="#111" strokeWidth="0.7" fill="none" />

      {/* Left arm — hand on head (confused) */}
      <path d="M28 98 Q12 100 15 80 Q16 70 30 55" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Hand on head */}
      <path d="M30 55 Q35 50 40 52" stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="32" y1="53" x2="30" y2="48" stroke="#111" strokeWidth="1" strokeLinecap="round" />
      <line x1="35" y1="51" x2="34" y2="46" stroke="#111" strokeWidth="1" strokeLinecap="round" />

      {/* Right arm — hanging */}
      <path d="M80 98 Q95 105 92 135" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Hand */}
      <ellipse cx="92" cy="138" rx="5" ry="6" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Legs */}
      <line x1="48" y1="162" x2="45" y2="198" stroke="#111" strokeWidth="2" />
      <line x1="70" y1="162" x2="73" y2="198" stroke="#111" strokeWidth="2" />

      {/* Shoes */}
      <path d="M35 198 Q40 195 48 198 Q50 202 35 203 Z" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M70 198 Q78 195 83 198 Q85 202 70 203 Z" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Question marks floating */}
      <text x="90" y="30" fontFamily="Caveat, cursive" fontSize="16" fill="#111" opacity="0.5">?</text>
      <text x="98" y="22" fontFamily="Caveat, cursive" fontSize="12" fill="#111" opacity="0.3">?</text>
    </motion.svg>
  );
}
