import { motion } from "framer-motion";

/** Clean cartoon barber — confident, lab coat, goatee, phone in hand */
export function SketchBarber() {
  return (
    <motion.svg
      width="135"
      height="290"
      viewBox="0 0 135 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, delay: 0.4 }}
    >
      {/* ═══ HEAD ═══ */}
      <ellipse cx="68" cy="52" rx="26" ry="29" stroke="#111" strokeWidth="2.2" fill="none" />

      {/* ═══ HAIR — clean fade ═══ */}
      <path d="M42 44 Q40 18 56 10 Q66 4 76 8 Q94 8 96 32 Q96 38 94 44"
        stroke="#111" strokeWidth="2.2" fill="none" />
      <path d="M48 30 Q56 16 66 14" stroke="#111" strokeWidth="1" fill="none" />
      <path d="M70 10 Q82 10 92 24" stroke="#111" strokeWidth="1" fill="none" />
      {/* Fade lines */}
      <line x1="42" y1="40" x2="42" y2="30" stroke="#111" strokeWidth="0.5" strokeDasharray="1.5 2" />
      <line x1="94" y1="38" x2="94" y2="28" stroke="#111" strokeWidth="0.5" strokeDasharray="1.5 2" />

      {/* ═══ EYEBROWS — confident arch ═══ */}
      <path d="M50 42 Q58 37 64 42" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M72 42 Q78 37 86 42" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* ═══ EYES — cool, slightly narrowed ═══ */}
      <ellipse cx="57" cy="50" rx="5" ry="4.5" stroke="#111" strokeWidth="1.6" fill="none" />
      <ellipse cx="79" cy="50" rx="5" ry="4.5" stroke="#111" strokeWidth="1.6" fill="none" />
      <circle cx="58" cy="50.5" r="2.5" fill="#111" />
      <circle cx="80" cy="50.5" r="2.5" fill="#111" />
      <circle cx="59.5" cy="49" r="1.2" fill="white" />
      <circle cx="81.5" cy="49" r="1.2" fill="white" />

      {/* ═══ NOSE ═══ */}
      <path d="M66 58 Q68 63 70 58" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* ═══ SMILE — confident ═══ */}
      <path d="M58 66 Q68 74 78 66" stroke="#111" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* ═══ GOATEE ═══ */}
      <path d="M60 70 Q64 78 68 80 Q72 78 76 70" stroke="#111" strokeWidth="1.6" fill="none" />
      <line x1="68" y1="70" x2="68" y2="76" stroke="#111" strokeWidth="0.7" />

      {/* ═══ EAR ═══ */}
      <path d="M94 46 Q100 50 98 58 Q96 62 93 60" stroke="#111" strokeWidth="1.4" fill="none" />

      {/* ═══ NECK ═══ */}
      <line x1="60" y1="78" x2="60" y2="94" stroke="#111" strokeWidth="1.8" />
      <line x1="76" y1="78" x2="76" y2="94" stroke="#111" strokeWidth="1.8" />

      {/* ═══ LAB COAT ═══ */}
      <path d="M22 96 Q22 92 46 90 L60 90 L76 90 Q90 92 90 96 L94 184 Q94 190 68 190 Q42 190 42 184 Z"
        stroke="#111" strokeWidth="2" fill="none" />
      {/* Lapels */}
      <path d="M52 90 L60 110 L68 92" stroke="#111" strokeWidth="1.6" fill="none" />
      <path d="M84 90 L76 110 L68 92" stroke="#111" strokeWidth="1.6" fill="none" />
      {/* Center seam */}
      <line x1="68" y1="110" x2="68" y2="184" stroke="#111" strokeWidth="0.7" strokeDasharray="3 3" />
      {/* Pocket */}
      <rect x="46" y="122" width="16" height="12" rx="2" stroke="#111" strokeWidth="1" fill="none" />
      {/* Badge */}
      <rect x="48" y="124" width="12" height="5" rx="1" stroke="#111" strokeWidth="0.7" fill="none" />
      <text x="49.5" y="128.5" fontFamily="sans-serif" fontSize="3.5" fontWeight="800" fill="#111">PRO</text>
      {/* Buttons */}
      <circle cx="68" cy="132" r="2" stroke="#111" strokeWidth="0.9" fill="none" />
      <circle cx="68" cy="148" r="2" stroke="#111" strokeWidth="0.9" fill="none" />
      <circle cx="68" cy="164" r="2" stroke="#111" strokeWidth="0.9" fill="none" />

      {/* ═══ LEFT ARM — at side ═══ */}
      <path d="M22 100 Q10 110 12 148" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M10 148 Q8 154 12 158 Q16 156 14 152" stroke="#111" strokeWidth="1.4" fill="none" />

      {/* ═══ RIGHT ARM — holding phone up ═══ */}
      <path d="M90 100 Q108 106 110 134" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ═══ PHONE ═══ */}
      <rect x="102" y="128" width="20" height="36" rx="3.5" stroke="#111" strokeWidth="1.8" fill="none" />
      <rect x="105" y="133" width="14" height="24" rx="1" stroke="#111" strokeWidth="0.7" fill="none" />
      <text x="106.5" y="148" fontFamily="sans-serif" fontSize="8" fontWeight="900" fill="#111">DUB</text>
      <circle cx="112" cy="160" r="1.5" stroke="#111" strokeWidth="0.6" fill="none" />
      {/* Hand on phone */}
      <path d="M104 140 Q100 136 102 130" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M122 140 Q126 136 124 130" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* ═══ PANTS — filled dark ═══ */}
      <path d="M44 186 L40 244 L56 244 L60 192 L76 192 L80 244 L96 244 L92 186 Z"
        stroke="#111" strokeWidth="1.8" fill="#111" />

      {/* ═══ SHOES ═══ */}
      <path d="M34 244 Q42 240 56 243 Q60 247 34 250 Z" stroke="#111" strokeWidth="1.6" fill="#111" />
      <path d="M80 243 Q90 240 106 243 Q110 247 80 250 Z" stroke="#111" strokeWidth="1.6" fill="#111" />
    </motion.svg>
  );
}
