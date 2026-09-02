import { motion } from "framer-motion";

/** Anime-style satisfied client character */
export function AnimeClient() {
  return (
    <motion.svg
      width="130"
      height="210"
      viewBox="0 0 130 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity, delay: 0.5 }}
    >
      {/* Body - blue t-shirt */}
      <rect x="30" y="100" width="70" height="75" rx="16" fill="#4A90D9" />
      {/* T-shirt collar */}
      <path d="M50 100 Q65 110 80 100" stroke="#3a7bc8" strokeWidth="2" fill="none" />
      
      {/* Arms */}
      <rect x="12" y="108" width="22" height="48" rx="11" fill="#4A90D9" />
      <rect x="96" y="108" width="22" height="48" rx="11" fill="#4A90D9" />
      
      {/* Hands */}
      <circle cx="23" cy="158" r="9" fill="#FFD4A8" />
      <circle cx="107" cy="158" r="9" fill="#FFD4A8" />
      
      {/* Head */}
      <circle cx="65" cy="58" r="36" fill="#FFD4A8" />
      
      {/* Hair - spiky shonen style */}
      <path
        d="M29 50 Q25 15 45 10 Q55 6 62 12 Q65 5 75 8 Q88 5 95 15 Q105 20 101 50
           Q100 38 90 33 Q80 28 72 35 Q68 25 58 30 Q45 25 38 38 Q30 45 29 50Z"
        fill="#2c2c44"
      />
      {/* Spikes */}
      <path d="M30 40 L22 22 L38 35Z" fill="#2c2c44" />
      <path d="M55 15 L50 0 L62 12Z" fill="#2c2c44" />
      <path d="M75 12 L78 -2 L85 15Z" fill="#2c2c44" />
      <path d="M95 20 L105 8 L100 30Z" fill="#2c2c44" />
      {/* Hair highlights */}
      <path d="M42 25 Q50 18 58 25" stroke="#3d3d5c" strokeWidth="1.5" fill="none" />
      
      {/* Eyes - large anime style */}
      <ellipse cx="50" cy="60" rx="8" ry="9" fill="white" />
      <ellipse cx="80" cy="60" rx="8" ry="9" fill="white" />
      <ellipse cx="52" cy="61" rx="5" ry="6" fill="#2c2c44" />
      <ellipse cx="82" cy="61" rx="5" ry="6" fill="#2c2c44" />
      {/* Eye shine */}
      <circle cx="54" cy="58" r="2.5" fill="white" />
      <circle cx="84" cy="58" r="2.5" fill="white" />
      <circle cx="50" cy="63" r="1.2" fill="white" opacity="0.6" />
      <circle cx="80" cy="63" r="1.2" fill="white" opacity="0.6" />
      
      {/* Happy eyebrows - slightly raised */}
      <path d="M41 48 Q50 44 59 49" stroke="#2c2c44" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M71 49 Q80 44 89 48" stroke="#2c2c44" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      
      {/* Blush */}
      <ellipse cx="38" cy="70" rx="6" ry="3.5" fill="#FFB3B3" opacity="0.5" />
      <ellipse cx="92" cy="70" rx="6" ry="3.5" fill="#FFB3B3" opacity="0.5" />
      
      {/* Big happy smile */}
      <path d="M50 76 Q65 90 80 76" stroke="#2c2c44" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Open mouth smile detail */}
      <path d="M54 78 Q65 86 76 78" fill="white" />
      
      {/* Nose */}
      <path d="M63 68 Q65 71 67 68" stroke="#d4a880" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      
      {/* Floating star */}
      <motion.g
        animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M115 35 L118 43 L127 43 L120 49 L122 57 L115 52 L108 57 L110 49 L103 43 L112 43Z"
          fill="#FFD700"
          stroke="#FFA500"
          strokeWidth="1"
        />
      </motion.g>
      
      {/* Legs */}
      <rect x="37" y="170" width="22" height="28" rx="10" fill="#3a3a5a" />
      <rect x="71" y="170" width="22" height="28" rx="10" fill="#3a3a5a" />
      {/* Shoes */}
      <ellipse cx="48" cy="200" rx="13" ry="6.5" fill="#555" />
      <ellipse cx="82" cy="200" rx="13" ry="6.5" fill="#555" />
    </motion.svg>
  );
}
