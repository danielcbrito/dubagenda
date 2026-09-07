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
  Smile,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import referralMascot from "@/assets/referral-mascot.png";
import logo from "@/assets/logo-dub.png";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { BackArrow } from "@/components/ui/back-arrow";
import { MyPlansSheet } from "@/components/MyPlansSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
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
        "w-full flex items-center gap-4 py-3.5 transition-colors active:bg-muted/40 text-left cursor-pointer",
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


/* Tenants sem programa "Indique e Ganhe" */
const REFERRALS_DISABLED_TENANTS = new Set<string>([
  "ed134ee7-99b5-4f72-8a2b-607e3e5bb08e", // Junior Cortes
]);

/* ─── Main Page ─── */

export default function ClientePerfil() {

  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string>();
  const [userRole, setUserRole] = useState("cliente");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

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
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [preferredShopName, setPreferredShopName] = useState<string | null>(null);
  const [showDiscoverConfirm, setShowDiscoverConfirm] = useState(false);
  const [shopDetailsOpen, setShopDetailsOpen] = useState(false);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [isDubExclusive, setIsDubExclusive] = useState(false);
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

  const avatarUrl = profile?.avatar_url?.trim()
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable area */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain scrollbar-hide">
          <div className="px-5 pt-[max(calc(env(safe-area-inset-top,0px)+2rem),3.5rem)] pb-36">

            {/* Identity & Barbearia — Título maior com a barbearia e Trocar logo abaixo */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h1 className="text-[26px] font-bold text-foreground tracking-tight leading-tight">
                Olá, {profile?.nome?.split(" ")[0] || "Cliente"}
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[13.5px] font-medium text-muted-foreground">
                  {isDubExclusive ? "Barbearia DUB" : (preferredShopName || "Barbearia DUB")}
                </span>
                <span className="text-[11px] text-muted-foreground/40">•</span>
                <button
                  onClick={() => {
                    if (!profile?.barbearia_preferida_id) {
                      setShowDiscoverConfirm(true);
                    } else {
                      navigate("/escolher-barbearia?mode=change");
                    }
                  }}
                  className="text-[13px] font-semibold text-primary hover:underline active:opacity-70 transition-all"
                >
                  Trocar
                </button>
              </div>
            </motion.div>

            {/* Featured card — Dub Pago (Original double-card floating style restored) */}
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              onClick={() => navigate("/cliente/carteira")}
              className="relative w-full rounded-2xl active:scale-[0.99] transition-transform mt-3 mb-6 text-left bg-muted/60 dark:bg-muted/30 overflow-hidden shadow-sm"
            >
              {/* White floating card in front */}
              <div className="relative bg-card rounded-2xl border border-border/60 shadow-sm px-4 pt-3.5 pb-3.5">
                {/* Brand label — tight */}
                <div className="flex items-baseline mb-4">
                  <span className="text-[13px] font-bold text-primary tracking-tight leading-none">
                    Dub
                  </span>
                  <span className="text-[13px] font-bold text-primary italic tracking-tight leading-none">
                    Pago
                  </span>
                </div>

                {/* Row */}
                <div className="flex items-center gap-3">
                  <Wallet className="h-[19px] w-[19px] text-foreground flex-shrink-0" strokeWidth={1.6} />
                  <p className="flex-1 text-[14.5px] font-medium text-foreground leading-tight">
                    Minha Carteira
                  </p>

                  {availableCredits > 0 && (
                    <span className="text-[12.5px] font-bold text-primary tabular-nums">
                      R$ {availableCredits.toFixed(2).replace('.', ',')}
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
            {!REFERRALS_DISABLED_TENANTS.has(profile?.barbearia_preferida_id) && (
              <div className="relative pt-6 group mb-6">
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04, duration: 0.3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate("/cliente/indicacoes")}
                  className="relative w-full h-20 rounded-2xl bg-card border border-border/60 shadow-sm text-left overflow-visible"
                >
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-[0.04] dark:opacity-[0.08]">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='24' viewBox='0 0 40 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 4h32v16H4z' fill='none' stroke='currentColor' stroke-width='0.5'/%3E%3Cpath d='M10 4v16M30 4v16' stroke='currentColor' stroke-width='0.5' stroke-dasharray='1 1'/%3E%3C/svg%3E")`,
                      backgroundSize: '80px 48px'
                    }} />
                  </div>

                  <div className="relative h-full flex items-center pl-[92px] pr-3.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground leading-tight tracking-tight">
                        Indique e ganhe <span className="text-primary font-bold">corte grátis</span>
                      </p>
                    </div>
                    <span className="text-[12px] font-semibold bg-foreground text-background px-4 py-1.5 rounded-full flex-shrink-0 active:scale-95 transition-transform shadow-sm">
                      Convidar
                    </span>
                  </div>
                </motion.button>

                <div className="absolute left-1 bottom-0 w-24 h-[125px] pointer-events-none z-10 flex items-end overflow-visible">
                  <img
                    src={referralMascot}
                    alt=""
                    className="h-full w-auto object-contain object-bottom drop-shadow-sm transition-transform duration-500 group-hover:-translate-y-1"
                  />
                </div>
              </div>
            )}

            {/* Flat list — Estruturada e organizada estrategicamente */}
            <div className="divide-y divide-border/60">
              {/* Benefícios & Serviços */}
              <ProfileRow
                icon={Tag}
                label="Meus Cupons"
                sublabel="Descontos disponíveis"
                onClick={() => navigate("/cliente/cupons")}
              />
              <ProfileRow
                icon={History}
                label="Histórico de Agendamentos"
                sublabel="Todos os cortes já realizados"
                onClick={() => navigate("/cliente/historico")}
              />
              <ProfileRow
                icon={Star}
                label="Minhas Avaliações"
                sublabel="Notas e comentários enviados"
                onClick={() => navigate("/cliente/avaliacoes")}
              />

              {/* Conta & Preferências */}
              <ProfileRow
                icon={User}
                label="Dados Pessoais"
                sublabel="Informações de cadastro e contato"
                onClick={() => navigate("/cliente/dados-pessoais")}
              />
              <ProfileRow
                icon={Shield}
                label="Segurança"
                sublabel="Senha e PIN da carteira"
                onClick={() => navigate("/cliente/seguranca")}
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
                className="w-full h-11 rounded-xl text-[13px] font-medium text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-destructive/20"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo..." : "Sair da conta"}
              </button>
            </motion.div>

            {/* Version */}
            <p className="text-center text-[10px] text-muted-foreground/40 tracking-wider uppercase mt-3">
              Dub App · v3.0.0
            </p>
          </div>
        </div>
      </div>


      {/* Sub-sheets */}
      <MyPlansSheet open={plansOpen} onOpenChange={setPlansOpen} userId={userId} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} userId={userId} />
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

    </div>
  );
}
