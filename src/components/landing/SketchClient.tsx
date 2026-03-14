import { motion } from "framer-motion";

/** Pencil-sketch client — worried guy scratching head, detailed anatomy */
export function SketchClient() {
  return (
    <motion.svg
      width="140"
      height="310"
      viewBox="0 0 140 310"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
    >
      {/* ═══ HAIR — messy, voluminous ═══ */}
      <path d="M38 52 Q32 20 58 10 Q70 6 82 10 Q108 18 104 52"
        stroke="#111" strokeWidth="2.4" fill="none" />
      <path d="M42 42 Q48 22 62 16" stroke="#111" strokeWidth="1.4" fill="none" />
      <path d="M78 12 Q94 14 100 32" stroke="#111" strokeWidth="1.4" fill="none" />
      <path d="M50 30 Q56 18 68 20" stroke="#111" strokeWidth="1" fill="none" />
      <path d="M72 14 Q80 12 90 22" stroke="#111" strokeWidth="0.9" fill="none" />
      {/* Hair strands */}
      <path d="M46 38 Q50 28 56 32" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M82 20 Q88 16 94 24" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M60 14 Q66 8 74 12" stroke="#111" strokeWidth="0.8" fill="none" />

      {/* ═══ HEAD — slightly tilted ═══ */}
      <ellipse cx="70" cy="62" rx="30" ry="32" stroke="#111" strokeWidth="2.4" fill="none" />
      
      {/* Jaw detail */}
      <path d="M44 72 Q50 88 70 92 Q90 88 96 72" stroke="#111" strokeWidth="0.6" fill="none" opacity="0.3" />

      {/* ═══ EYEBROWS — deeply furrowed, worried ═══ */}
      <path d="M50 48 Q56 42 66 48" stroke="#111" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M76 48 Q86 42 92 48" stroke="#111" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      {/* Worry lines between brows */}
      <line x1="68" y1="44" x2="67" y2="50" stroke="#111" strokeWidth="1" strokeLinecap="round" />
      <line x1="74" y1="44" x2="75" y2="50" stroke="#111" strokeWidth="1" strokeLinecap="round" />

      {/* ═══ EYES — wide, anxious ═══ */}
      <ellipse cx="58" cy="58" rx="6" ry="6.5" stroke="#111" strokeWidth="1.8" fill="none" />
      <ellipse cx="84" cy="58" rx="6" ry="6.5" stroke="#111" strokeWidth="1.8" fill="none" />
      {/* Pupils — looking to the side (thinking) */}
      <circle cx="56" cy="59" r="3" fill="#111" />
      <circle cx="82" cy="59" r="3" fill="#111" />
      {/* Highlights */}
      <circle cx="58" cy="56" r="1.5" fill="white" />
      <circle cx="84" cy="56" r="1.5" fill="white" />
      {/* Under-eye stress lines */}
      <path d="M52 64 Q55 66 58 64" stroke="#111" strokeWidth="0.5" fill="none" opacity="0.4" />
      <path d="M82 64 Q85 66 88 64" stroke="#111" strokeWidth="0.5" fill="none" opacity="0.4" />

      {/* ═══ NOSE ═══ */}
      <path d="M68 68 Q70 74 72 68" stroke="#111" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M66 72 Q70 76 74 72" stroke="#111" strokeWidth="0.8" fill="none" opacity="0.5" />

      {/* ═══ MOUTH — open slightly, worried/confused ═══ */}
      <path d="M60 82 Q65 79 70 80 Q75 79 80 82" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M62 82 Q70 86 78 82" stroke="#111" strokeWidth="1" fill="none" opacity="0.4" />

      {/* ═══ EARS ═══ */}
      <path d="M40 54 Q34 58 36 68 Q38 74 42 70" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M37 62 Q39 64 38 66" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* ═══ NECK ═══ */}
      <line x1="62" y1="92" x2="62" y2="112" stroke="#111" strokeWidth="2" />
      <line x1="78" y1="92" x2="78" y2="112" stroke="#111" strokeWidth="2" />
      {/* Adam's apple hint */}
      <path d="M69 100 Q70 103 71 100" stroke="#111" strokeWidth="0.7" fill="none" />

      {/* ═══ T-SHIRT — casual, relaxed fit ═══ */}
      <path d="M26 114 Q26 108 48 106 L62 106 L78 106 Q94 108 94 114 L96 195 Q96 202 70 202 Q44 202 44 195 Z"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* Crew neckline */}
      <path d="M56 106 Q70 114 84 106" stroke="#111" strokeWidth="1.6" fill="none" />
      {/* Shirt wrinkles — natural fabric flow */}
      <path d="M52 125 Q56 135 54 148" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M84 122 Q80 136 85 150" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M64 140 Q68 148 66 160" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M72 150 Q76 158 74 168" stroke="#111" strokeWidth="0.5" fill="none" />
      {/* Collar detail */}
      <path d="M54 108 Q56 112 58 108" stroke="#111" strokeWidth="0.5" fill="none" />
      <path d="M82 108 Q84 112 86 108" stroke="#111" strokeWidth="0.5" fill="none" />

      {/* ═══ LEFT ARM — raised, hand scratching head (confused) ═══ */}
      <path d="M26 118 Q14 110 10 90 Q8 78 14 68"
        stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Hand on head */}
      <path d="M14 68 Q18 62 26 58 Q32 56 36 60"
        stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Fingers on scalp */}
      <path d="M20 62 Q22 56 28 54" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M24 64 Q26 58 32 56" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M16 66 Q18 60 24 58" stroke="#111" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Elbow line */}
      <path d="M12 86 Q14 90 12 94" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* ═══ RIGHT ARM — hanging, slightly forward ═══ */}
      <path d="M94 118 Q110 128 108 165" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Right hand — relaxed */}
      <path d="M106 165 Q108 170 106 176 Q104 178 102 174" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M104 168 Q102 172 104 176" stroke="#111" strokeWidth="0.8" fill="none" />
      <line x1="106" y1="170" x2="108" y2="168" stroke="#111" strokeWidth="0.8" strokeLinecap="round" />

      {/* ═══ PANTS — jeans, slightly baggy ═══ */}
      <path d="M48 198 L44 260 L62 260 L66 205 L74 205 L78 260 L96 260 L92 198 Z"
        stroke="#111" strokeWidth="2" fill="none" />
      {/* Knee creases */}
      <path d="M50 230 Q54 234 52 238" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M88 228 Q84 232 86 236" stroke="#111" strokeWidth="0.6" fill="none" />
      {/* Fly line */}
      <line x1="70" y1="198" x2="70" y2="215" stroke="#111" strokeWidth="0.6" />
      {/* Pocket outlines */}
      <path d="M50 200 Q52 206 56 200" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M84 200 Q86 206 90 200" stroke="#111" strokeWidth="0.7" fill="none" />

      {/* ═══ SHOES — sneakers ═══ */}
      <path d="M36 260 Q44 255 62 259 Q66 262 64 268 Q50 270 36 266 Z"
        stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M40 264 L60 264" stroke="#111" strokeWidth="0.8" />
      <path d="M78 259 Q88 255 104 259 Q108 262 106 268 Q92 270 78 266 Z"
        stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M82 264 L102 264" stroke="#111" strokeWidth="0.8" />
      {/* Laces hint */}
      <path d="M48 260 L52 258 L56 260" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M88 260 L92 258 L96 260" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* ═══ QUESTION MARKS floating — confused ═══ */}
      <motion.g
        animate={{ opacity: [0.3, 0.8, 0.3], y: [0, -3, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      >
        <text x="100" y="40" fontFamily="Caveat, cursive" fontSize="16" fontWeight="700" fill="#111" opacity="0.5">?</text>
      </motion.g>
      <motion.g
        animate={{ opacity: [0.2, 0.6, 0.2], y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1.2 }}
      >
        <text x="112" y="52" fontFamily="Caveat, cursive" fontSize="12" fontWeight="700" fill="#111" opacity="0.35">?</text>
      </motion.g>
    </motion.svg>
  );
}
