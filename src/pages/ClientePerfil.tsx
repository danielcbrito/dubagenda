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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";

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
  danger?: boolean;
}
function ProfileItem({ icon: Icon, label, onClick, trailing, danger }: ProfileItemProps) {
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
      {trailing || <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </button>
  );
}

function ThemeToggleItem() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || theme === "system";

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
  const [userRole, setUserRole] = useState("cliente");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

    setUserEmail(user.email || "");

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof) setProfile(prof);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (roles?.[0]) setUserRole(roles[0].role);
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
    <div className="min-h-screen bg-background pb-20">
      <div className="pt-6 pb-8 space-y-6">
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
            <ProfileItem icon={User} label="Meus Dados" onClick={() => navigate("/cliente/dados-pessoais")} />
            <ProfileItem icon={Shield} label="Segurança" onClick={() => toast.info("Em breve")} />
          </ProfileSection>
        </motion.div>

        {/* Preferências */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ProfileSection title="Preferências">
            <ProfileItem icon={Wrench} label="Configurações" onClick={() => toast.info("Em breve")} />
            <ThemeToggleItem />
          </ProfileSection>
        </motion.div>

        {/* Ajuda */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <ProfileSection title="Ajuda">
            <ProfileItem
              icon={Bell}
              label="Central de ajuda"
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
    </div>
  );
}
