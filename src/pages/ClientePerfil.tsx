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
  UserPlus,
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
import { BottomNavigation } from "@/components/BottomNavigation";
import { MyReviewsSheet } from "@/components/MyReviewsSheet";
import { MyCouponsSheet } from "@/components/MyCouponsSheet";
import { usePendingSubscription } from "@/hooks/usePendingSubscription";
import { BarberReviewModal } from "@/components/client/BarberReviewModal";

/* ─── Reusable sub-components (iFood-style) ─── */

interface ProfileRowProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  badgeCount?: number;
  trailing?: React.ReactNode;
  danger?: boolean;
}
function ProfileRow({ icon: Icon, label, sublabel, onClick, badgeCount, trailing, danger }: ProfileRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 py-3.5 transition-colors active:bg-muted/40",
        danger && "text-destructive"
      )}
    >
      <Icon
        className={cn("h-[20px] w-[20px] flex-shrink-0", danger ? "text-destructive" : "text-foreground/80")}
        strokeWidth={1.5}
      />
      <div className="flex-1 min-w-0 text-left">
        <p className={cn("text-[14px] font-medium leading-tight", danger ? "text-destructive" : "text-foreground")}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11.5px] font-normal text-muted-foreground/70 leading-snug mt-1 truncate">
            {sublabel}
          </p>
        )}
      </div>
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10.5px] font-semibold flex items-center justify-center tabular-nums">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      {trailing || (
        <ChevronRight className="h-[15px] w-[15px] text-muted-foreground/50 flex-shrink-0" strokeWidth={1.8} />
      )}
    </button>
  );
}

function ThemeToggleRow() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Moon : Sun;
  return (
    <div className="w-full flex items-center gap-4 py-3.5">
      <Icon className="h-[20px] w-[20px] text-foreground/80 flex-shrink-0" strokeWidth={1.5} />
      <span className="flex-1 text-left text-[14px] font-medium text-foreground">
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
  const [referralCredits, setReferralCredits] = useState(0);
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
  const [couponsOpen, setCouponsOpen] = useState(false);
  const { data: pendingSubscription } = usePendingSubscription(userId);
  const [reviewModalData, setReviewModalData] = useState<any>(null);

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

    const { count: refCount } = await supabase
      .from("creditos_indicacao")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "disponivel");
    setReferralCredits(refCount || 0);

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
      const { clearLastAccount } = await import("@/utils/lastAccount");
      clearLastAccount();
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
    <div className="flex flex-col h-[100dvh]">
      {/* Scrollable area */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />
        
        <div className="h-full overflow-y-auto overscroll-contain pb-24">
          <div className="px-5 pt-8 pb-4">

            {/* Identity — iFood style: avatar + name + colored link */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3.5 mb-6"
            >
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-primary" strokeWidth={1.6} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[19px] font-bold text-foreground leading-tight truncate">
                  {profile?.nome?.split(" ")[0] || "Cliente"}
                </p>
                <button
                  onClick={() => navigate("/cliente/dados-pessoais")}
                  className="mt-0.5 inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary active:opacity-70"
                >
                  Ver meus dados
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              </div>
            </motion.div>


            {/* Featured card — Dub Pago */}
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              onClick={() => navigate("/cliente/carteira")}
              className="relative w-full rounded-2xl active:scale-[0.99] transition-transform mb-6 text-left bg-muted/60 dark:bg-muted/30 overflow-hidden"
            >
              {/* White floating card in front */}
              <div className="relative bg-card rounded-2xl border border-border/60 shadow-sm px-4 pt-3 pb-3.5">
                {/* Brand label — tight */}
                <div className="flex items-baseline mb-5">
                  <span className="text-[12px] font-bold text-primary tracking-tight leading-none">
                    Dub
                  </span>
                  <span className="text-[12px] font-bold text-primary italic tracking-tight leading-none">
                    Pago
                  </span>
                </div>

                {/* Row */}
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-[18px] w-[18px] text-foreground flex-shrink-0" strokeWidth={1.6} />
                  <p className="flex-1 text-[14px] font-medium text-foreground leading-tight">
                    Minha Carteira
                  </p>

                  {availableCredits > 0 && (
                    <span className="text-[12px] font-semibold text-primary tabular-nums">
                      R$ {availableCredits}
                    </span>
                  )}
                  <ChevronRight className="h-[15px] w-[15px] text-muted-foreground/60" strokeWidth={1.8} />
                </div>
              </div>

              {/* Gray exposed area below the white card */}
              <div className="relative px-4 py-2.5">
                <p className="text-[11.5px] font-normal text-muted-foreground leading-tight">
                  Gerencie seus créditos e saques
                </p>
              </div>
            </motion.button>




            {/* Indique e ganhe — banner preservado */}
            <div className="relative pt-6 group mb-6">
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04, duration: 0.3 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate("/cliente/indicacoes")}
                className="relative w-full h-20 rounded-2xl bg-muted/60 dark:bg-card border border-border/40 text-left overflow-visible"
              >
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-[0.04] dark:opacity-[0.08]">
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
                <img
                  src={referralMascot}
                  alt=""
                  className="h-full w-auto object-contain object-bottom drop-shadow-sm transition-transform duration-500 group-hover:-translate-y-2"
                />
              </div>
            </div>

            {/* Flat list — iFood style with hairline dividers */}
            <div className="divide-y divide-border/60">
              <ProfileRow
                icon={Bell}
                label="Notificações"
                onClick={() => setNotificationsOpen(true)}
              />
              <ProfileRow
                icon={Store}
                label={isDubExclusive ? "Barbearia DUB" : "Minha Barbearia"}
                sublabel={isDubExclusive ? "Cliente exclusivo" : preferredShopName || undefined}
                onClick={() => navigate("/escolher-barbearia?mode=change&open=current")}
              />
              <ProfileRow
                icon={MapPin}
                label="Encontrar barbearias"
                sublabel="Explore unidades perto de você"
                onClick={() => {
                  if (!profile?.barbearia_preferida_id) {
                    setShowDiscoverConfirm(true);
                  } else {
                    navigate("/escolher-barbearia?mode=change");
                  }
                }}
              />
              <ProfileRow
                icon={CreditCard}
                label="Meus Planos"
                sublabel="Assinaturas e renovações"
                onClick={() => setPlansOpen(true)}
              />
              <ProfileRow
                icon={Tag}
                label="Meus Cupons"
                sublabel="Descontos disponíveis"
                onClick={() => setCouponsOpen(true)}
              />
              <ProfileRow
                icon={Gift}
                label="Recompensas e Benefícios"
                sublabel="Pontos, resgates e fidelidade"
                badgeCount={redemptions}
                onClick={() => setPointsModalOpen(true)}
              />
              <ProfileRow
                icon={History}
                label="Histórico de Agendamentos"
                sublabel="Todos os cortes já realizados"
                onClick={() => setHistoryOpen(true)}
              />
              <ProfileRow
                icon={Star}
                label="Minhas Avaliações"
                sublabel="Notas e comentários enviados"
                onClick={() => setReviewsOpen(true)}
              />
              <ProfileRow
                icon={User}
                label="Conta"
                sublabel="Dados pessoais e segurança"
                onClick={() => navigate("/cliente/dados-pessoais")}
              />
              <ProfileRow
                icon={Shield}
                label="Segurança"
                sublabel="Senha e proteção da conta"
                onClick={() => navigate("/cliente/seguranca")}
              />
              
              <ProfileRow
                icon={HelpCircle}
                label="Central de Ajuda"
                sublabel="Fale com o suporte"
                trailing={
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                    Em breve
                  </span>
                }
                onClick={() => toast.info("Em breve")}
              />
            </div>

            <div className="h-6" />


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
      <MyCouponsSheet open={couponsOpen} onOpenChange={setCouponsOpen} userId={userId} />

      {/* Barbershop Details Sheet */}
      <BarbershopDetailsSheet
        open={shopDetailsOpen}
        onOpenChange={setShopDetailsOpen}
        barbershop={shopDetails}
        isDub={isDubExclusive}
      />

      {/* Barber Review Modal */}
      <BarberReviewModal
        appointmentId={reviewModalData?.appointmentId || ""}
        barberId={reviewModalData?.barberId || ""}
        barberName={reviewModalData?.barberName || ""}
        barberPhoto={reviewModalData?.barberPhoto || null}
        userId={userId || ""}
        userName={profile?.nome || "Cliente"}
        open={!!reviewModalData}
        onOpenChange={(open) => !open && setReviewModalData(null)}
        onSuccess={() => {
          setReviewModalData(null);
          loadProfile();
        }}
      />

      <BottomNavigation
        onProfileClick={() => {}}
        onPlansClick={() => setPlansOpen(true)}
      />
    </div>
  );
}
