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
import { BarbershopDetailsSheet } from "@/components/client/BarbershopDetailsSheet";
import { MyReviewsSheet } from "@/components/MyReviewsSheet";
import { MyCouponsSheet } from "@/components/MyCouponsSheet";
import { usePendingSubscription } from "@/hooks/usePendingSubscription";

/* ─── Reusable sub-components ─── */

function ProfileSection({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 px-1">
        {title}
      </p>
      <div className="rounded-xl bg-card border border-border/30 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </motion.div>
  );
}

function ProfileItem({ icon: Icon, label, onClick, trailing, badge, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3.5 py-3 transition-colors active:bg-secondary/50",
        danger && "text-destructive"
      )}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary/50", danger && "bg-destructive/10")}>
        <Icon className={cn("h-4 w-4 text-muted-foreground", danger && "text-destructive")} strokeWidth={1.8} />
      </div>
      <span className="flex-1 text-left text-[13px] font-medium">{label}</span>
      {badge && <span className="px-1.5 py-0.5 bg-primary/15 text-primary text-[9px] font-bold rounded-md">{badge}</span>}
      {trailing || <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
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
  const [reviewsOpen, setReviewsOpen] = useState(false);
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

  const avatarUrl = profile?.avatar_url ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl : null;

  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24">
        <div className="px-4 pt-12 pb-4 space-y-6 max-w-lg mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 px-2">
            <div className="h-16 w-16 rounded-full border border-border bg-card flex items-center justify-center font-bold text-lg shadow-sm">
              {avatarUrl ? <img src={avatarUrl} className="h-full w-full rounded-full object-cover" /> : profile?.nome?.[0] || "U"}
            </div>
            <h1 className="text-[20px] font-bold text-foreground">{profile?.nome || "Olá"}</h1>
          </motion.div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-3">
             <div onClick={() => navigate("/cliente/carteira")} className="p-4 rounded-xl bg-card border border-border shadow-sm cursor-pointer active:scale-[0.98]">
               <Wallet className="w-5 h-5 text-primary mb-2" />
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Carteira</p>
               <p className="font-bold">R$ {availableCredits.toFixed(2)}</p>
             </div>
             <div onClick={() => navigate("/cliente/indicacoes")} className="p-4 rounded-xl bg-card border border-border shadow-sm cursor-pointer active:scale-[0.98]">
               <Gift className="w-5 h-5 text-secondary mb-2" />
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Indicações</p>
               <p className="font-bold">Corte grátis</p>
             </div>
          </div>

          <ProfileSection title="Conta">
            <ProfileItem icon={Wallet} label="Minha Carteira" onClick={() => navigate("/cliente/carteira")} />
            <ProfileItem icon={CreditCard} label="Meus Planos" onClick={() => setPlansOpen(true)} />
            <ProfileItem icon={Tag} label="Meus Cupons" onClick={() => setCouponsOpen(true)} />
            <ProfileItem icon={User} label="Meus Dados" onClick={() => navigate("/cliente/dados-pessoais")} />
          </ProfileSection>

          <ProfileSection title="Configurações">
            <ProfileItem icon={Bell} label="Notificações" onClick={() => setNotificationsOpen(true)} />
            <ProfileItem icon={History} label="Histórico" onClick={() => setHistoryOpen(true)} />
          </ProfileSection>
        </div>
      </div>
      <MyPlansSheet open={plansOpen} onOpenChange={setPlansOpen} userId={userId} />
      <MyCouponsSheet open={couponsOpen} onOpenChange={setCouponsOpen} />
      <AppointmentHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} userId={userId} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} userId={userId} />
    </div>
  );
}
