import { motion } from "framer-motion";

/** Pencil-sketch barber — confident pro in lab coat, goatee, phone showing DUB */
export function SketchBarber() {
  return (
    <motion.svg
      width="145"
      height="310"
      viewBox="0 0 145 310"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, delay: 0.4 }}
    >
      {/* ═══ HAIR — sharp fade, clean top ═══ */}
      <path d="M42 50 Q38 20 56 12 Q68 6 80 10 Q100 14 102 46"
        stroke="#111" strokeWidth="2.4" fill="none" />
      {/* Top volume */}
      <path d="M48 36 Q56 18 70 16" stroke="#111" strokeWidth="1.4" fill="none" />
      <path d="M74 12 Q88 12 98 28" stroke="#111" strokeWidth="1.4" fill="none" />
      <path d="M54 26 Q62 16 72 18" stroke="#111" strokeWidth="0.9" fill="none" />
      {/* Fade lines on sides — barber signature */}
      <path d="M42 46 Q40 38 42 30" stroke="#111" strokeWidth="0.7" strokeDasharray="1.5 2" fill="none" />
      <path d="M44 44 Q42 36 44 28" stroke="#111" strokeWidth="0.5" strokeDasharray="1.5 2" fill="none" />
      <path d="M102 44 Q104 36 102 28" stroke="#111" strokeWidth="0.7" strokeDasharray="1.5 2" fill="none" />
      <path d="M100 42 Q102 34 100 26" stroke="#111" strokeWidth="0.5" strokeDasharray="1.5 2" fill="none" />
      {/* Hair part line */}
      <path d="M56 16 Q60 14 64 16" stroke="#111" strokeWidth="1" fill="none" />

      {/* ═══ HEAD ═══ */}
      <ellipse cx="72" cy="58" rx="30" ry="32" stroke="#111" strokeWidth="2.4" fill="none" />
      
      {/* Strong jawline */}
      <path d="M46 68 Q52 86 72 90 Q92 86 98 68" stroke="#111" strokeWidth="0.7" fill="none" opacity="0.3" />

      {/* ═══ EYEBROWS — confident arch ═══ */}
      <path d="M52 46 Q60 40 68 46" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M78 46 Q86 40 94 46" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* ═══ EYES — cool, slightly narrowed, confident ═══ */}
      <ellipse cx="60" cy="55" rx="5.5" ry="5" stroke="#111" strokeWidth="1.8" fill="none" />
      <ellipse cx="86" cy="55" rx="5.5" ry="5" stroke="#111" strokeWidth="1.8" fill="none" />
      {/* Eyelids — cool half-closed */}
      <path d="M54.5 53 Q60 50 65.5 53" stroke="#111" strokeWidth="1.2" fill="none" />
      <path d="M80.5 53 Q86 50 91.5 53" stroke="#111" strokeWidth="1.2" fill="none" />
      {/* Pupils */}
      <circle cx="61" cy="56" r="2.8" fill="#111" />
      <circle cx="87" cy="56" r="2.8" fill="#111" />
      {/* Highlights */}
      <circle cx="63" cy="54" r="1.3" fill="white" />
      <circle cx="89" cy="54" r="1.3" fill="white" />

      {/* ═══ NOSE ═══ */}
      <path d="M70 64 Q72 70 74 64" stroke="#111" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M68 68 Q72 72 76 68" stroke="#111" strokeWidth="0.7" fill="none" opacity="0.4" />

      {/* ═══ MOUTH — confident smirk ═══ */}
      <path d="M62 74 Q72 82 82 74" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Tooth hint */}
      <path d="M66 76 L68 76" stroke="white" strokeWidth="1.5" strokeLinecap="round" />

      {/* ═══ GOATEE — detailed beard ═══ */}
      <path d="M64 78 Q68 86 72 88 Q76 86 80 78" stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M66 80 Q72 90 78 80" stroke="#111" strokeWidth="1" fill="none" />
      <line x1="72" y1="76" x2="72" y2="84" stroke="#111" strokeWidth="0.8" />
      {/* Stubble dots */}
      <circle cx="60" cy="78" r="0.4" fill="#111" />
      <circle cx="62" cy="80" r="0.4" fill="#111" />
      <circle cx="82" cy="78" r="0.4" fill="#111" />
      <circle cx="84" cy="80" r="0.4" fill="#111" />

      {/* ═══ EARS ═══ */}
      <path d="M102 52 Q108 56 106 66 Q104 70 101 68" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M104 60 Q105 62 104 64" stroke="#111" strokeWidth="0.6" fill="none" />

      {/* ═══ NECK ═══ */}
      <line x1="64" y1="88" x2="64" y2="108" stroke="#111" strokeWidth="2" />
      <line x1="80" y1="88" x2="80" y2="108" stroke="#111" strokeWidth="2" />

      {/* ═══ LAB COAT / JALECO — professional ═══ */}
      <path d="M22 110 Q22 104 48 102 L64 102 L80 102 Q98 104 98 110 L102 206 Q102 214 72 214 Q42 214 42 206 Z"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* Lapels — sharp V */}
      <path d="M56 102 L64 126 L72 104" stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M88 102 L80 126 L72 104" stroke="#111" strokeWidth="1.8" fill="none" />
      {/* Center seam */}
      <line x1="72" y1="126" x2="72" y2="206" stroke="#111" strokeWidth="0.8" strokeDasharray="4 3" />
      
      {/* Chest pocket with pen */}
      <rect x="48" y="132" width="18" height="14" rx="2" stroke="#111" strokeWidth="1.2" fill="none" />
      <line x1="54" y1="132" x2="53" y2="124" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      {/* Badge / crachá */}
      <rect x="50" y="134" width="14" height="6" rx="1.5" stroke="#111" strokeWidth="0.8" fill="none" />
      <text x="52" y="139.5" fontFamily="sans-serif" fontSize="4" fontWeight="800" fill="#111">PRO</text>
      
      {/* Buttons */}
      <circle cx="72" cy="148" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      <circle cx="72" cy="165" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      <circle cx="72" cy="182" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      
      {/* Coat wrinkles */}
      <path d="M52 155 Q56 164 54 176" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M90 152 Q86 162 90 174" stroke="#111" strokeWidth="0.6" fill="none" />
      <path d="M62 170 Q64 178 62 186" stroke="#111" strokeWidth="0.5" fill="none" />

      {/* ═══ LEFT ARM — relaxed at side, slightly back ═══ */}
      <path d="M22 114 Q8 124 10 168"
        stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Left hand — thumbs up gesture */}
      <path d="M8 168 Q6 172 8 178 Q12 182 14 178 Q16 174 14 170"
        stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M10 170 Q6 166 8 162" stroke="#111" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {/* Fingers */}
      <line x1="10" y1="172" x2="8" y2="168" stroke="#111" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="12" y1="174" x2="11" y2="170" stroke="#111" strokeWidth="0.8" strokeLinecap="round" />

      {/* ═══ RIGHT ARM — holding phone up, presenting ═══ */}
      <path d="M98 114 Q118 118 122 148"
        stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Elbow crease */}
      <path d="M114 130 Q116 134 114 138" stroke="#111" strokeWidth="0.5" fill="none" />

      {/* ═══ PHONE — detailed ═══ */}
      <rect x="112" y="140" width="22" height="40" rx="4" stroke="#111" strokeWidth="2" fill="none" />
      {/* Screen bezel */}
      <rect x="115" y="146" width="16" height="27" rx="1.5" stroke="#111" strokeWidth="0.8" fill="none" />
      {/* "DUB" on screen */}
      <text x="117" y="163" fontFamily="sans-serif" fontSize="9" fontWeight="900" fill="#111">DUB</text>
      {/* Notch */}
      <rect x="120" y="142" width="6" height="2" rx="1" fill="#111" opacity="0.3" />
      {/* Home indicator */}
      <rect x="119" y="176" width="8" height="1.5" rx="0.75" fill="#111" opacity="0.3" />
      {/* Hand gripping phone */}
      <path d="M114 154 Q110 150 112 142" stroke="#111" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M134 154 Q138 150 136 142" stroke="#111" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M112 158 Q110 155 112 150" stroke="#111" strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* Phone glow effect */}
      <motion.rect
        x="115" y="146" width="16" height="27" rx="1.5"
        fill="#111" opacity={0}
        animate={{ opacity: [0, 0.06, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* ═══ PANTS — dark/filled ═══ */}
      <path d="M46 210 L42 268 L60 268 L66 216 L78 216 L84 268 L102 268 L98 210 Z"
        stroke="#111" strokeWidth="2" fill="#111" />

      {/* ═══ SHOES — solid, professional ═══ */}
      <path d="M34 268 Q42 263 60 267 Q64 271 62 276 Q48 278 34 274 Z"
        stroke="#111" strokeWidth="1.8" fill="#111" />
      <path d="M84 267 Q96 263 112 267 Q116 271 114 276 Q100 278 84 274 Z"
        stroke="#111" strokeWidth="1.8" fill="#111" />

      {/* ═══ Confidence sparkle ═══ */}
      <motion.g
        animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
      >
        <path d="M126 130 L128 126 L130 130 L134 132 L130 134 L128 138 L126 134 L122 132 Z"
          fill="#111" opacity="0.4" />
      </motion.g>
    </motion.svg>
  );
}
