import { motion } from "framer-motion";

/** Pencil-sketch client — serious confused expression, hand on chin thinking */
export function SketchClient() {
  return (
    <motion.svg
      width="150"
      height="280"
      viewBox="0 0 150 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity }}
    >
      {/* Head */}
      <ellipse cx="75" cy="62" rx="32" ry="34" stroke="#111" strokeWidth="2.4" fill="none" />

      {/* Hair — short sides, volume on top */}
      <path d="M43 54 Q40 28 55 18 Q65 10 78 14 Q92 10 102 24 Q106 34 103 50"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* Hair texture */}
      <path d="M50 35 Q58 22 68 24" stroke="#111" strokeWidth="1.2" fill="none" />
      <path d="M72 18 Q82 14 96 26" stroke="#111" strokeWidth="1.2" fill="none" />
      <path d="M55 28 Q62 20 70 22" stroke="#111" strokeWidth="0.8" fill="none" />

      {/* Eyebrows — furrowed, serious */}
      <path d="M54 50 Q62 44 70 50" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M80 50 Q88 44 96 50" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Eyes — focused/thinking */}
      <ellipse cx="62" cy="60" rx="5.5" ry="6" stroke="#111" strokeWidth="1.8" fill="none" />
      <ellipse cx="88" cy="60" rx="5.5" ry="6" stroke="#111" strokeWidth="1.8" fill="none" />
      <circle cx="63" cy="60" r="2.8" fill="#111" />
      <circle cx="89" cy="60" r="2.8" fill="#111" />
      {/* Eye highlights */}
      <circle cx="65" cy="58" r="1.2" fill="white" />
      <circle cx="91" cy="58" r="1.2" fill="white" />

      {/* Nose */}
      <path d="M73 70 Q75 75 77 70" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Mouth — slight frown, unsure */}
      <path d="M64 82 Q70 78 75 80 Q80 78 86 82" stroke="#111" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Ear left */}
      <path d="M43 55 Q38 58 40 68 Q42 72 44 70" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <line x1="68" y1="94" x2="68" y2="112" stroke="#111" strokeWidth="2" />
      <line x1="82" y1="94" x2="82" y2="112" stroke="#111" strokeWidth="2" />

      {/* T-shirt */}
      <path d="M32 112 Q32 108 52 106 L68 106 L82 106 Q98 108 98 112 L100 185 Q100 192 75 192 Q50 192 50 185 Z"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* V-neck */}
      <path d="M62 106 Q75 118 88 106" stroke="#111" strokeWidth="1.5" fill="none" />
      {/* Shirt wrinkles */}
      <path d="M60 130 Q65 138 62 150" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M85 128 Q82 140 87 152" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M70 145 Q74 150 72 160" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* Left arm — hand on chin (thinking) */}
      <path d="M32 115 Q18 120 16 145 Q15 155 25 158 Q30 155 38 148"
        stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Hand under chin */}
      <path d="M55 88 Q48 92 42 90 Q38 88 36 85"
        stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* Right arm — pocket or side */}
      <path d="M98 115 Q115 125 112 160" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Right hand */}
      <path d="M110 160 Q114 162 112 168 Q108 170 106 166" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Pants */}
      <path d="M54 188 L50 245 L66 245 L70 195 L80 195 L84 245 L100 245 L96 188 Z"
        stroke="#111" strokeWidth="2" fill="none" />

      {/* Shoes */}
      <path d="M42 245 Q48 241 66 244 Q70 249 42 251 Z" stroke="#111" strokeWidth="1.8" fill="#111" />
      <path d="M84 244 Q96 241 108 244 Q112 249 84 251 Z" stroke="#111" strokeWidth="1.8" fill="#111" />
    </motion.svg>
  );
}
