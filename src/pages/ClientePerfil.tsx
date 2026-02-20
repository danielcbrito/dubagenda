import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Shield,
  Wrench,
  Bell,
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";
import { MyPlansSheet } from "@/components/MyPlansSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { AppointmentHistorySheet } from "@/components/AppointmentHistorySheet";
import { PointsDetailModal } from "@/components/PointsDetailModal";

/* ─── Reusable sub-components ─── */

interface ProfileSectionProps {
  title: string;
  children: React.ReactNode;
}
function ProfileSection({ title, children }: ProfileSectionProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 px-5">
        {title}
      </p>
      <div className="mx-4 rounded-xl bg-secondary/30 border border-border/30 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  );
}

interface ProfileItemProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  badge?: string;
  danger?: boolean;
}
function ProfileItem({ icon: Icon, label, onClick, trailing, badge, danger }: ProfileItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 transition-colors",
        "hover:bg-secondary/50 active:bg-secondary/70",
        danger && "text-destructive"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", danger ? "text-destructive" : "text-muted-foreground")} strokeWidth={1.8} />
      <span className={cn("flex-1 text-left text-[13px] font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
      {trailing || <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </button>
  );
}

function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="w-full flex items-center gap-3 px-4 py-3">
      {isDark ? (
        <Moon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.8} />
      ) : (
        <Sun className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.8} />
      )}
      <span className="flex-1 text-left text-[13px] font-medium text-foreground">Tema</span>
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "relative w-10 h-[22px] rounded-full transition-colors duration-200",
          isDark ? "bg-primary" : "bg-muted"
        )}
      >
        <motion.div
          className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-primary-foreground shadow-sm"
          animate={{ x: isDark ? 18 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

/* ─── Main Page ─── */

export default function ClientePerfil() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string>();
  const [userRole, setUserRole] = useState("cliente");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Data for badges
  const [availableCredits, setAvailableCredits] = useState(0);
  const [points, setPoints] = useState(0);
  const [completedAppointments, setCompletedAppointments] = useState(0);
  const [redemptions, setRedemptions] = useState(0);
  const [pontosNecessarios, setPontosNecessarios] = useState(5);

  // Sub-sheets
  const [plansOpen, setPlansOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [preferredShopName, setPreferredShopName] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

    setUserId(user.id);
    setUserEmail(user.email || "");

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof) {
      setProfile(prof);
      // Load preferred barbershop name
      if (prof.barbearia_preferida_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("nome")
          .eq("id", prof.barbearia_preferida_id)
          .single();
        if (tenant) setPreferredShopName(tenant.nome);
      }
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (roles?.[0]) setUserRole(roles[0].role);

    // Load credits
    const { data: creditsData } = await supabase.rpc("get_user_available_credits", { p_user_id: user.id });
    if (creditsData !== null) setAvailableCredits(Number(creditsData));

    // Load points
    const { data: pontosData } = await supabase.from("pontos").select("pontos").eq("user_id", user.id).maybeSingle();
    if (pontosData) setPoints(pontosData.pontos);

    // Load completed appointments count
    const { count } = await supabase.from("agendamentos").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed");
    setCompletedAppointments(count || 0);

    // Load redemptions
    const { data: resgates } = await supabase.from("resgates").select("id")
      .eq("user_id", user.id).eq("status", "available");
    setRedemptions(resgates?.length || 0);

    // Load pontos necessários
    const { data: promo } = await supabase.from("promocoes").select("pontos_necessarios").eq("ativo", true).limit(1).maybeSingle();
    if (promo?.pontos_necessarios) setPontosNecessarios(promo.pontos_necessarios);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast.success("Você saiu da conta");
      navigate("/auth");
    } catch {
      toast.error("Erro ao sair");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl
    : null;

  return (
    <div className="min-h-screen pb-20">
      <div className="pt-10 pb-8 space-y-6">
        {/* Identity Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 px-5"
        >
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-2 border-border/50 overflow-hidden bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-foreground">
                  {profile?.nome ? getInitials(profile.nome) : "U"}
                </span>
              )}
            </div>
          </div>

          <div className="text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {profile?.nome || "Carregando..."}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{userEmail}</p>
            <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">
              {userRole}
            </span>
          </div>
        </motion.div>

        {/* Conta */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <ProfileSection title="Conta">
            <ProfileItem
              icon={Wallet}
              label="Minha Carteira"
              badge={availableCredits > 0 ? `R$ ${availableCredits}` : undefined}
              onClick={() => navigate("/cliente/carteira")}
            />
            <ProfileItem
              icon={CreditCard}
              label="Meus Planos"
              onClick={() => setPlansOpen(true)}
            />
            <ProfileItem icon={User} label="Meus Dados" onClick={() => navigate("/cliente/dados-pessoais")} />
            <ProfileItem icon={Shield} label="Segurança" onClick={() => navigate("/cliente/seguranca")} />
          </ProfileSection>
        </motion.div>

        {/* Preferências */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ProfileSection title="Preferências">
            <ProfileItem
              icon={Store}
              label="Minha Barbearia"
              badge={preferredShopName || undefined}
              onClick={() => navigate("/escolher-barbearia?mode=change")}
            />
            <ProfileItem
              icon={Bell}
              label="Notificações"
              onClick={() => setNotificationsOpen(true)}
            />
            <ThemeToggleItem />
          </ProfileSection>
        </motion.div>

        {/* Mais */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <ProfileSection title="Mais">
            <ProfileItem
              icon={History}
              label="Histórico de Agendamentos"
              onClick={() => setHistoryOpen(true)}
            />
            <ProfileItem
              icon={Gift}
              label="Programa de Pontos"
              badge={redemptions > 0 ? `${redemptions} disponível` : undefined}
              onClick={() => setPointsModalOpen(true)}
            />
            <ProfileItem
              icon={HelpCircle}
              label="Central de Ajuda"
              trailing={
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded font-medium">
                  Em breve
                </span>
              }
              onClick={() => toast.info("Em breve")}
            />
          </ProfileSection>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="px-4">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full h-11 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Saindo..." : "Sair da conta"}
          </button>
        </motion.div>

        {/* Version */}
        <p className="text-center text-[10px] text-muted-foreground/30">
          Barbearia Dub • v1.0.0
        </p>
      </div>

      <BottomNavigation
        onProfileClick={() => {}}
        onSupportClick={() => navigate("/suporte")}
      />

      {/* Sub-sheets */}
      <MyPlansSheet open={plansOpen} onOpenChange={setPlansOpen} userId={userId} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} userId={userId} />
      <AppointmentHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} userId={userId} />
      <PointsDetailModal
        open={pointsModalOpen}
        onOpenChange={setPointsModalOpen}
        points={points}
        completedAppointments={completedAppointments}
        redemptions={redemptions}
        pontosNecessarios={pontosNecessarios}
      />
    </div>
  );
}