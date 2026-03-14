import { motion } from "framer-motion";

/** Pencil-sketch barber — confident pro, lab coat, goatee, phone showing DUB */
export function SketchBarber() {
  return (
    <motion.svg
      width="155"
      height="290"
      viewBox="0 0 155 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity, delay: 0.3 }}
    >
      {/* Head */}
      <ellipse cx="78" cy="58" rx="30" ry="32" stroke="#111" strokeWidth="2.4" fill="none" />

      {/* Hair — clean fade, professional */}
      <path d="M48 50 Q46 24 62 16 Q72 10 82 14 Q98 12 106 28 Q108 38 105 48"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* Hair texture lines */}
      <path d="M55 34 Q64 22 74 24" stroke="#111" strokeWidth="1.2" fill="none" />
      <path d="M78 18 Q90 16 100 28" stroke="#111" strokeWidth="1.2" fill="none" />
      <path d="M60 28 Q68 20 76 22" stroke="#111" strokeWidth="0.8" fill="none" />
      {/* Fade detail on sides */}
      <path d="M48 48 Q46 42 48 36" stroke="#111" strokeWidth="0.7" strokeDasharray="2 2" fill="none" />
      <path d="M106 46 Q108 40 106 34" stroke="#111" strokeWidth="0.7" strokeDasharray="2 2" fill="none" />

      {/* Eyebrows — confident, slightly arched */}
      <path d="M58 46 Q66 42 74 47" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M82 47 Q90 42 98 46" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Eyes — confident, slightly narrowed */}
      <ellipse cx="66" cy="56" rx="5" ry="5.5" stroke="#111" strokeWidth="1.8" fill="none" />
      <ellipse cx="90" cy="56" rx="5" ry="5.5" stroke="#111" strokeWidth="1.8" fill="none" />
      <circle cx="67" cy="56" r="2.8" fill="#111" />
      <circle cx="91" cy="56" r="2.8" fill="#111" />
      {/* Eye highlights */}
      <circle cx="69" cy="54" r="1.2" fill="white" />
      <circle cx="93" cy="54" r="1.2" fill="white" />

      {/* Nose */}
      <path d="M76 66 Q78 71 80 66" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Goatee — detailed */}
      <path d="M70 78 Q74 84 78 86 Q82 84 86 78" stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M74 80 Q78 88 82 80" stroke="#111" strokeWidth="1" fill="none" />
      <line x1="78" y1="76" x2="78" y2="82" stroke="#111" strokeWidth="0.8" />

      {/* Confident smirk */}
      <path d="M68 74 Q78 82 88 74" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Ear right */}
      <path d="M108 52 Q114 56 112 66 Q110 70 107 68" stroke="#111" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <line x1="70" y1="88" x2="70" y2="106" stroke="#111" strokeWidth="2" />
      <line x1="86" y1="88" x2="86" y2="106" stroke="#111" strokeWidth="2" />

      {/* Lab coat / Jaleco */}
      <path d="M28 106 Q28 102 52 100 L70 100 L86 100 Q104 102 104 106 L108 200 Q108 208 78 208 Q48 208 48 200 Z"
        stroke="#111" strokeWidth="2.2" fill="none" />
      {/* Coat lapels — V shape */}
      <path d="M62 100 L70 122 L78 100" stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M94 100 L86 122 L78 100" stroke="#111" strokeWidth="1.8" fill="none" />
      {/* Center line */}
      <line x1="78" y1="122" x2="78" y2="200" stroke="#111" strokeWidth="0.8" strokeDasharray="4 3" />
      {/* Pocket with pen */}
      <rect x="54" y="138" width="18" height="14" rx="2.5" stroke="#111" strokeWidth="1.2" fill="none" />
      <line x1="60" y1="138" x2="59" y2="132" stroke="#111" strokeWidth="1" strokeLinecap="round" />
      {/* Badge/crachá */}
      <rect x="56" y="140" width="12" height="5" rx="1.5" stroke="#111" strokeWidth="0.8" fill="none" />
      <text x="58" y="144" fontFamily="sans-serif" fontSize="3.5" fontWeight="700" fill="#111">PRO</text>
      {/* Buttons */}
      <circle cx="78" cy="145" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      <circle cx="78" cy="162" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      <circle cx="78" cy="179" r="2.2" stroke="#111" strokeWidth="1" fill="none" />
      {/* Coat wrinkles */}
      <path d="M58 155 Q62 162 60 172" stroke="#111" strokeWidth="0.7" fill="none" />
      <path d="M95 150 Q92 160 96 170" stroke="#111" strokeWidth="0.7" fill="none" />

      {/* Left arm — relaxed at side */}
      <path d="M28 110 Q12 120 14 165" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Left hand */}
      <path d="M12 165 Q10 170 14 174 Q18 172 16 168" stroke="#111" strokeWidth="1.5" fill="none" />
      <line x1="14" y1="168" x2="12" y2="164" stroke="#111" strokeWidth="1" strokeLinecap="round" />
      <line x1="16" y1="170" x2="15" y2="166" stroke="#111" strokeWidth="1" strokeLinecap="round" />

      {/* Right arm — holding phone up */}
      <path d="M104 110 Q124 115 126 142" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* Phone */}
      <rect x="116" y="136" width="20" height="36" rx="4" stroke="#111" strokeWidth="2" fill="none" />
      {/* Phone screen */}
      <rect x="119" y="141" width="14" height="24" rx="1.5" stroke="#111" strokeWidth="0.8" fill="none" />
      {/* "DUB" on screen */}
      <text x="121" y="156" fontFamily="sans-serif" fontSize="8" fontWeight="900" fill="#111">DUB</text>
      {/* Screen dot */}
      <circle cx="126" cy="168" r="1.8" stroke="#111" strokeWidth="0.7" fill="none" />
      {/* Hand gripping phone */}
      <path d="M118 148 Q114 145 116 138" stroke="#111" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M136 148 Q140 145 138 138" stroke="#111" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      {/* Pants — filled dark */}
      <path d="M52 204 L48 260 L66 260 L72 210 L84 210 L90 260 L108 260 L104 204 Z"
        stroke="#111" strokeWidth="2" fill="#111" />

      {/* Shoes — solid dark */}
      <path d="M40 260 Q48 256 66 259 Q70 265 40 267 Z" stroke="#111" strokeWidth="1.8" fill="#111" />
      <path d="M90 259 Q102 256 118 259 Q122 265 90 267 Z" stroke="#111" strokeWidth="1.8" fill="#111" />
    </motion.svg>
  );
}
