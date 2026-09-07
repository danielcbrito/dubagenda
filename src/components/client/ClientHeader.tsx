import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { NotificationBellPremium } from "./NotificationBellPremium";
import { useNavigate } from "react-router-dom";

interface ClientHeaderProps {
  profileName?: string;
  email?: string;
  userId?: string;
  realtimeConnected?: boolean;
  shopName?: string;
}

export function ClientHeader({ profileName, userId, shopName }: ClientHeaderProps) {
  const navigate = useNavigate();
  const firstName = profileName ? String(profileName).split(" ")[0] : null;
  const initials = firstName ? firstName.charAt(0).toUpperCase() : "?";
  const today = new Date();
  const dayOfWeek = format(today, "EEEE", { locale: ptBR });
  const formattedDate = format(today, "dd 'de' MMMM", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col w-full gap-2"
    >
      {/* Top row: Date */}
      <p className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.15em] truncate">
        {dayOfWeek} · {formattedDate}
      </p>

      {/* Greeting Title + Shop pill on the same line */}
      <div className="flex items-center justify-between w-full">
        <h1 className="text-[22px] font-medium text-[#18181B] tracking-tight leading-none truncate pr-2">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
        
        {shopName && (
          <div className="flex items-center gap-1.5 flex-shrink-0 bg-white shadow-sm px-3 py-1.5 rounded-full border border-neutral-200/60">
            <span className="text-[11px] font-medium text-neutral-600 truncate max-w-[100px]">
              {shopName}
            </span>
            <span className="text-[10px] text-neutral-300">•</span>
            <button 
              onClick={() => navigate('/escolher-barbearia')}
              className="text-[11px] font-medium text-red-500 hover:underline active:opacity-70 transition-all flex-shrink-0"
            >
              Trocar
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
