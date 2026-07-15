import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Shield,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Wallet,
  CreditCard,
  History,
  Gift,
  HelpCircle,
  Store,
  MapPin,
  Bell,
  Star,
  Tag,
  UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import referralMascot from "@/assets/referral-mascot.png";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { BackArrow } from "@/components/ui/back-arrow";
import { MyPlansSheet } from "@/components/MyPlansSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { AppointmentHistorySheet } from "@/components/AppointmentHistorySheet";
import { PointsDetailModal } from "@/components/PointsDetailModal";
import { MyCouponsSheet } from "@/components/MyCouponsSheet";
import { BottomNavigation } from "@/components/BottomNavigation";

/* ─── Reusable sub-components ─── */

function ProfileItem({ icon: Icon, label, onClick, badge, danger, trailing }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between py-4 border-b border-border/10 last:border-0 transition-all active:opacity-60",
        danger && "text-destructive"
      )}
    >
      <div className="flex items-center gap-4">
        <Icon className={cn("w-5 h-5", danger ? "text-destructive" : "text-foreground/80")} strokeWidth={1.5} />
        <span className="text-[14px] font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
        {trailing || <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
      </div>
    </button>
  );
}

export default function ClientePerfil() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string>();
  const [availableCredits, setAvailableCredits] = useState(0);
  const [redemptions, setRedemptions] = useState(0);
  const [plansOpen, setPlansOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    setUserId(user.id);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof) setProfile(prof);
    const { data: creditsData } = await supabase.rpc("get_user_available_credits", { p_user_id: user.id });
    if (creditsData !== null) setAvailableCredits(Number(creditsData));
    const { data: resgates } = await supabase.from("resgates").select("id").eq("user_id", user.id).eq("status", "available");
    setRedemptions(resgates?.length || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu da conta");
    navigate("/auth");
  };

  const avatarUrl = profile?.avatar_url ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl : null;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24">
        <div className="px-5 pt-12 pb-4 space-y-6 max-w-lg mx-auto">
          {/* iFood Header Style */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 px-1">
            <div className="h-14 w-14 rounded-full border border-border bg-card flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} className="h-full w-full object-cover" /> : profile?.nome?.[0] || "U"}
            </div>
            <div className="flex-1">
              <h1 className="text-[18px] font-bold text-foreground leading-tight">{profile?.nome || "Olá"}</h1>
              <button onClick={() => navigate("/cliente/dados-pessoais")} className="text-[12px] text-muted-foreground font-medium flex items-center gap-1">
                Ver perfil <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>

          {/* Wallet Card - style iFood Pago */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div onClick={() => navigate("/cliente/carteira")} className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden active:scale-[0.99] transition-transform cursor-pointer">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">iFood Pago</p>
                    <p className="text-[17px] font-bold text-foreground tabular-nums">
                      R$ {availableCredits.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
              </div>
            </div>
          </motion.div>

          {/* Referral Card - style Pontos Decolar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div onClick={() => setPointsModalOpen(true)} className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden active:scale-[0.99] transition-transform cursor-pointer">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-secondary" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Meus Pontos Decolar</p>
                    <h3 className="text-[14px] font-bold text-foreground">Programa de Fidelidade</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {redemptions > 0 && <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{redemptions}</span>}
                   <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Indique e Ganhe Banner with Mascot */}
          <div className="relative pt-6 group">
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate("/cliente/indicacoes")}
              className="relative w-full h-20 rounded-xl bg-muted/60 dark:bg-card border border-border/40 text-left overflow-visible"
            >
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-[0.04] dark:opacity-[0.08]">
                <div className="absolute inset-0" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='24' viewBox='0 0 40 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 4h32v16H4z' fill='none' stroke='currentColor' stroke-width='0.5'/%3E%3Cpath d='M10 4v16M30 4v16' stroke='currentColor' stroke-width='0.5' stroke-dasharray='1 1'/%3E%3C/svg%3E")`,
                  backgroundSize: '80px 48px'
                }} />
              </div>
              <div className="relative h-full flex items-center pl-[92px] pr-3.5 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-semibold text-foreground leading-tight tracking-tight">
                    Indique e ganhe corte grátis
                  </p>
                </div>
                <span className="text-[12px] font-bold bg-foreground text-background px-4 py-1.5 rounded-full flex-shrink-0 active:scale-95 transition-transform shadow-sm">
                  Convidar
                </span>
              </div>
            </motion.button>
            <div className="absolute left-1 bottom-0 w-24 h-[130px] pointer-events-none z-10 flex items-end overflow-visible">
              <img src={referralMascot} alt="" className="h-full w-auto object-contain object-bottom drop-shadow-sm transition-transform duration-500 group-hover:-translate-y-2" />
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 pt-2">
            <ProfileItem icon={History} label="Conversas" onClick={() => toast.info("Em breve")} />
            <ProfileItem icon={Bell} label="Notificações" onClick={() => setNotificationsOpen(true)} />
            <ProfileItem icon={Star} label="Minhas Avaliações" onClick={() => navigate("/cliente/avaliacoes")} />
            <ProfileItem icon={Tag} label="Cupons" onClick={() => setCouponsOpen(true)} />
            <ProfileItem icon={UserPlus} label="Indicar amigos" onClick={() => navigate("/cliente/indicacoes")} />
            <ProfileItem icon={History} label="Histórico de Agendamentos" onClick={() => setHistoryOpen(true)} />
            <ProfileItem icon={Store} label="Minha Barbearia" onClick={() => navigate("/escolher-barbearia?mode=change&open=current")} />
            <ProfileItem icon={Shield} label="Segurança" onClick={() => navigate("/cliente/seguranca")} />
            <ProfileItem icon={LogOut} label="Sair da conta" danger onClick={handleLogout} />
          </div>
        </div>
      </div>

      <BottomNavigation onProfileClick={() => navigate("/cliente/perfil")} onPlansClick={() => setPlansOpen(true)} />
      
      <MyPlansSheet open={plansOpen} onOpenChange={setPlansOpen} userId={userId} />
      <MyCouponsSheet open={couponsOpen} onOpenChange={setCouponsOpen} />
      <AppointmentHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} userId={userId} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} userId={userId} />
      <PointsDetailModal open={pointsModalOpen} onOpenChange={setPointsModalOpen} points={profile?.pontos || 0} completedAppointments={0} redemptions={redemptions} pontosNecessarios={8} />
    </div>
  );
}
