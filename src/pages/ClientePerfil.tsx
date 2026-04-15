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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarbershopDetailsSheet } from "@/components/client/BarbershopDetailsSheet";
import { MyReviewsSheet } from "@/components/MyReviewsSheet";

/* ─── Reusable sub-components ─── */

interface ProfileSectionProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
}
function ProfileSection({ title, children, delay = 0 }: ProfileSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 px-1">
        {title}
      </p>
      <div className="rounded-xl bg-card border border-border/30 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </motion.div>
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
        "w-full flex items-center gap-3 px-3.5 py-3 transition-colors",
        "active:bg-secondary/50 active:scale-[0.99] transition-all",
        danger && "text-destructive"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        danger ? "bg-destructive/10" : "bg-secondary/50"
      )}>
        <Icon
          className={cn("h-4 w-4", danger ? "text-destructive" : "text-muted-foreground")}
          strokeWidth={1.8}
        />
      </div>
      <span
        className={cn(
          "flex-1 text-left text-[13px] font-medium",
          danger ? "text-destructive" : "text-foreground"
        )}
      >
        {label}
      </span>
      {badge && (
        <span className="px-1.5 py-0.5 bg-primary/15 text-primary text-[9px] font-bold rounded-md min-w-[20px] text-center uppercase tracking-wider">
          {badge}
        </span>
      )}
      {trailing || (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
      )}
    </button>
  );
}

function ThemeToggleItem() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="w-full flex items-center gap-3 px-3.5 py-3">
      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
        {isDark ? (
          <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        ) : (
          <Sun className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        )}
      </div>
      <span className="flex-1 text-left text-[13px] font-medium text-foreground">
        {isDark ? "Modo escuro" : "Modo claro"}
      </span>
      <ThemeToggle />
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
  const [pontosNecessarios, setPontosNecessarios] = useState(8);

  // Sub-sheets
  const [plansOpen, setPlansOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [preferredShopName, setPreferredShopName] = useState<string | null>(null);
  const [showDiscoverConfirm, setShowDiscoverConfirm] = useState(false);
  const [shopDetailsOpen, setShopDetailsOpen] = useState(false);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [isDubExclusive, setIsDubExclusive] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

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
      if (prof.barbearia_preferida_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, nome, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo")
          .eq("id", prof.barbearia_preferida_id)
          .single();
        if (tenant) {
          setPreferredShopName(tenant.nome);
          setShopDetails(tenant);
        }
        setIsDubExclusive(false);
      } else {
        setIsDubExclusive(true);
        setPreferredShopName(null);
        setShopDetails(null);
      }
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (roles?.[0]) setUserRole(roles[0].role);

    const { data: creditsData } = await supabase.rpc("get_user_available_credits", { p_user_id: user.id });
    if (creditsData !== null) setAvailableCredits(Number(creditsData));

    const { data: pontosData } = await supabase.from("pontos").select("pontos").eq("user_id", user.id).maybeSingle();
    if (pontosData) setPoints(pontosData.pontos);

    const { count } = await supabase.from("agendamentos").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed");
    setCompletedAppointments(count || 0);

    const { data: resgates } = await supabase.from("resgates").select("id")
      .eq("user_id", user.id).eq("status", "available");
    setRedemptions(resgates?.length || 0);

    // Buscar promoção filtrada pelo tenant preferido
    let promoQuery = supabase.from("promocoes").select("pontos_necessarios").eq("ativo", true);
    if (prof?.barbearia_preferida_id) {
      promoQuery = promoQuery.eq("tenant_id", prof.barbearia_preferida_id);
    } else {
      promoQuery = promoQuery.is("tenant_id", null);
    }
    const { data: promo } = await promoQuery.limit(1).maybeSingle();
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
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px)" }}>
      {/* Scrollable area */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />
        <div className="h-full overflow-y-auto overscroll-contain pb-8">
          <div className="px-4 pt-8 pb-4 space-y-6">

            {/* Identity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2.5"
            >
              <div className="relative">
                <div className="h-[72px] w-[72px] rounded-full border-2 border-border/40 overflow-hidden bg-card flex items-center justify-center shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {profile?.nome ? getInitials(profile.nome) : "U"}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-[15px] font-semibold text-foreground tracking-tight">
                  {profile?.nome || "Carregando..."}
                </p>
                <p className="text-[11px] text-muted-foreground/60">{userEmail}</p>
                <span className="inline-block mt-1 text-[9px] uppercase tracking-[0.12em] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">
                  {userRole}
                </span>
              </div>
            </motion.div>

            {/* Conta */}
            <ProfileSection title="Conta" delay={0.05}>
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
              <ProfileItem
                icon={User}
                label="Meus Dados"
                onClick={() => navigate("/cliente/dados-pessoais")}
              />
              <ProfileItem
                icon={Shield}
                label="Segurança"
                onClick={() => navigate("/cliente/seguranca")}
              />
            </ProfileSection>

            {/* Preferências */}
            <ProfileSection title="Preferências" delay={0.1}>
              <ProfileItem
                icon={Store}
                label={isDubExclusive ? "Barbearia DUB" : "Minha Barbearia"}
                badge={isDubExclusive ? "Exclusivo" : preferredShopName || undefined}
                onClick={() => navigate("/escolher-barbearia?mode=change&open=current")}
              />
              <ProfileItem
                icon={MapPin}
                label="Encontrar barbearias"
                onClick={() => {
                  if (!profile?.barbearia_preferida_id) {
                    setShowDiscoverConfirm(true);
                  } else {
                    navigate("/escolher-barbearia?mode=change");
                  }
                }}
              />
              <ProfileItem
                icon={Bell}
                label="Notificações"
                onClick={() => setNotificationsOpen(true)}
              />
              <ThemeToggleItem />
            </ProfileSection>

            {/* Mais */}
            <ProfileSection title="Mais" delay={0.15}>
              <ProfileItem
                icon={History}
                label="Histórico de Agendamentos"
                onClick={() => setHistoryOpen(true)}
              />
              <ProfileItem
                icon={Star}
                label="Minhas Avaliações"
                onClick={() => setReviewsOpen(true)}
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
                  <span className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded font-semibold">
                    Em breve
                  </span>
                }
                onClick={() => toast.info("Em breve")}
              />
            </ProfileSection>

            {/* Logout */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full h-11 rounded-xl text-[13px] font-medium text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo..." : "Sair da conta"}
              </button>
            </motion.div>

            {/* Version */}
            <p className="text-center text-[9px] text-muted-foreground/25 tracking-wider uppercase">
              Barbearia Dub · v1.0.0
            </p>
          </div>
        </div>
      </div>

      <BottomNavigation
        onProfileClick={() => {}}
        onPlansClick={() => navigate("/cliente/assinar")}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showDiscoverConfirm} onOpenChange={setShowDiscoverConfirm}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Encontrar barbearias</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Ao continuar, você deixará de ser um <strong className="text-foreground">Cliente Exclusivo DUB</strong> e poderá explorar outras barbearias perto de você.
              {"\n\n"}Você pode voltar ao modo exclusivo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-[13px] bg-primary text-primary-foreground"
              onClick={() => navigate("/escolher-barbearia?mode=change")}
            >
              Quero explorar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MyReviewsSheet open={reviewsOpen} onOpenChange={setReviewsOpen} userId={userId} />

      {/* Barbershop Details Sheet */}
      <BarbershopDetailsSheet
        open={shopDetailsOpen}
        onOpenChange={setShopDetailsOpen}
        barbershop={shopDetails}
        isDub={isDubExclusive}
      />
    </div>
  );
}
