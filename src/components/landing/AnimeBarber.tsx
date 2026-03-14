import { motion } from "framer-motion";

/** Anime-style barber character holding scissors */
export function AnimeBarber() {
  return (
    <motion.svg
      width="140"
      height="220"
      viewBox="0 0 140 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
    >
      {/* Body - dark uniform */}
      <rect x="35" y="100" width="70" height="80" rx="16" fill="#1a1a2e" />
      {/* Collar detail */}
      <path d="M55 100 L70 115 L85 100" stroke="#2a2a4e" strokeWidth="2" fill="none" />
      
      {/* Left arm */}
      <rect x="18" y="110" width="22" height="50" rx="11" fill="#1a1a2e" />
      {/* Right arm (holding scissors) */}
      <rect x="100" y="105" width="22" height="50" rx="11" fill="#1a1a2e" />
      
      {/* Hand (right) */}
      <circle cx="111" cy="103" r="10" fill="#FFCBA4" />
      
      {/* Scissors */}
      <g transform="translate(98, 78) rotate(15)">
        <line x1="0" y1="10" x2="20" y2="0" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="10" x2="20" y2="20" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="10" r="4" fill="#FF4757" stroke="#888" strokeWidth="1" />
        <circle cx="22" cy="0" r="2" fill="#ccc" />
        <circle cx="22" cy="20" r="2" fill="#ccc" />
      </g>
      
      {/* Head */}
      <circle cx="70" cy="60" r="38" fill="#FFCBA4" />
      
      {/* Hair - structured dark */}
      <path
        d="M32 55 Q32 20 70 18 Q108 20 108 55 Q108 42 95 38 Q85 35 78 38 Q72 32 62 38 Q50 35 42 42 Q32 48 32 55Z"
        fill="#1a1a2e"
      />
      {/* Hair highlights */}
      <path d="M48 35 Q55 28 65 32" stroke="#2d2d50" strokeWidth="2" fill="none" />
      <path d="M75 30 Q85 25 95 35" stroke="#2d2d50" strokeWidth="2" fill="none" />
      
      {/* Eyes - large anime style */}
      <ellipse cx="55" cy="62" rx="8" ry="9" fill="white" />
      <ellipse cx="85" cy="62" rx="8" ry="9" fill="white" />
      <ellipse cx="57" cy="63" rx="5" ry="6" fill="#1a1a2e" />
      <ellipse cx="87" cy="63" rx="5" ry="6" fill="#1a1a2e" />
      {/* Eye shine */}
      <circle cx="59" cy="60" r="2.5" fill="white" />
      <circle cx="89" cy="60" r="2.5" fill="white" />
      <circle cx="55" cy="65" r="1.2" fill="white" opacity="0.6" />
      <circle cx="85" cy="65" r="1.2" fill="white" opacity="0.6" />
      
      {/* Eyebrows */}
      <path d="M46 50 Q55 46 64 50" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M76 50 Q85 46 94 50" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      
      {/* Blush cheeks */}
      <ellipse cx="42" cy="72" rx="7" ry="4" fill="#FFB3B3" opacity="0.5" />
      <ellipse cx="98" cy="72" rx="7" ry="4" fill="#FFB3B3" opacity="0.5" />
      
      {/* Smile */}
      <path d="M58 78 Q70 90 82 78" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      
      {/* Nose */}
      <path d="M68 70 Q70 73 72 70" stroke="#e8b090" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      
      {/* Legs */}
      <rect x="42" y="175" width="22" height="30" rx="10" fill="#1a1a2e" />
      <rect x="76" y="175" width="22" height="30" rx="10" fill="#1a1a2e" />
      {/* Shoes */}
      <ellipse cx="53" cy="207" rx="14" ry="7" fill="#333" />
      <ellipse cx="87" cy="207" rx="14" ry="7" fill="#333" />
    </motion.svg>
  );
}
