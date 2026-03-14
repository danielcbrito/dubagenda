import { motion } from "framer-motion";

/** Clean cartoon client — worried expression, hand on chin, proper proportions */
export function SketchClient() {
  return (
    <motion.svg
      width="130"
      height="290"
      viewBox="0 0 130 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
    >
      {/* ═══ HEAD — clean oval ═══ */}
      <ellipse cx="65" cy="55" rx="26" ry="29" stroke="#111" strokeWidth="2.2" fill="none" />

      {/* ═══ HAIR — clean short style ═══ */}
      <path d="M39 48 Q37 22 52 14 Q62 8 72 12 Q88 10 92 30 Q93 40 91 48"
        stroke="#111" strokeWidth="2.2" fill="none" />
      <path d="M44 34 Q52 20 64 18" stroke="#111" strokeWidth="1" fill="none" />
      <path d="M68 14 Q80 14 88 28" stroke="#111" strokeWidth="1" fill="none" />

      {/* ═══ EYEBROWS — worried, angled down center ═══ */}
      <path d="M48 44 Q54 40 62 44" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M70 44 Q78 40 84 44" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* ═══ EYES — round, expressive ═══ */}
      <ellipse cx="55" cy="52" rx="5" ry="5.5" stroke="#111" strokeWidth="1.6" fill="none" />
      <ellipse cx="77" cy="52" rx="5" ry="5.5" stroke="#111" strokeWidth="1.6" fill="none" />
      <circle cx="54" cy="53" r="2.5" fill="#111" />
      <circle cx="76" cy="53" r="2.5" fill="#111" />
      <circle cx="56" cy="51" r="1.2" fill="white" />
      <circle cx="78" cy="51" r="1.2" fill="white" />

      {/* ═══ NOSE — simple curve ═══ */}
      <path d="M63 62 Q65 67 67 62" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* ═══ MOUTH — slight frown ═══ */}
      <path d="M56 72 Q62 68 66 70 Q70 68 76 72" stroke="#111" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* ═══ EAR ═══ */}
      <path d="M39 48 Q34 52 36 60 Q38 64 40 62" stroke="#111" strokeWidth="1.4" fill="none" />

      {/* ═══ NECK ═══ */}
      <line x1="58" y1="82" x2="58" y2="98" stroke="#111" strokeWidth="1.8" />
      <line x1="72" y1="82" x2="72" y2="98" stroke="#111" strokeWidth="1.8" />

      {/* ═══ T-SHIRT ═══ */}
      <path d="M30 100 Q30 96 50 94 L58 94 L72 94 Q82 96 82 100 L84 170 Q84 176 65 176 Q46 176 46 170 Z"
        stroke="#111" strokeWidth="2" fill="none" />
      {/* Neckline */}
      <path d="M52 94 Q65 102 78 94" stroke="#111" strokeWidth="1.4" fill="none" />
      {/* Wrinkles */}
      <path d="M50 120 Q54 128 52 138" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M76 118 Q72 128 76 140" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* ═══ LEFT ARM — hand on chin, thinking ═══ */}
      {/* Upper arm */}
      <path d="M30 104 Q20 108 18 130" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Forearm going up to chin */}
      <path d="M18 130 Q16 118 28 100 Q34 90 42 80" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Hand under chin — clean */}
      <path d="M42 80 Q46 76 50 78 Q48 82 44 84" stroke="#111" strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* ═══ RIGHT ARM — relaxed at side ═══ */}
      <path d="M82 104 Q96 112 94 150" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Hand */}
      <path d="M92 150 Q94 156 92 160 Q90 162 88 158" stroke="#111" strokeWidth="1.4" fill="none" />

      {/* ═══ PANTS ═══ */}
      <path d="M48 174 L44 232 L58 232 L62 178 L68 178 L72 232 L86 232 L82 174 Z"
        stroke="#111" strokeWidth="1.8" fill="none" />

      {/* ═══ SHOES — clean sneakers ═══ */}
      <path d="M38 232 Q44 228 58 231 Q62 235 38 238 Z" stroke="#111" strokeWidth="1.6" fill="#111" />
      <path d="M72 231 Q82 228 96 231 Q100 235 72 238 Z" stroke="#111" strokeWidth="1.6" fill="#111" />
    </motion.svg>
  );
}
