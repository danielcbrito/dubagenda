import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, Gift, Calendar, Scissors, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVerifiedAuthUser } from "@/utils/authSession";
import { ClientHeader } from "@/components/client/ClientHeader";
import { LoyaltyCard } from "@/components/client/LoyaltyCard";
import { PlanTrackerCard } from "@/components/client/PlanTrackerCard";
import { ScheduleButton } from "@/components/client/ScheduleButton";
import { AppointmentCardPremium } from "@/components/client/AppointmentCardPremium";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PointsDetailModal } from "@/components/PointsDetailModal";
import { WalletSheet } from "@/components/WalletSheet";
import { MyPlansSheet } from "@/components/MyPlansSheet";

const Cliente = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);

  useEffect(() => {
    getVerifiedAuthUser().then(u => {
      if (!u) navigate("/auth");
      else setUser(u);
    });
  }, [navigate]);

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['cliente', 'profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: appointments } = useQuery({
    queryKey: ['cliente', 'appointments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("agendamentos")
        .select(`*, servico:servicos(nome), barbeiro:barbeiros(apelido, tenant:tenants(nome)), pagamentos(metodo, status)`)
        .eq("user_id", user?.id)
        .in("status", ["pending", "confirmed"])
        .order("data", { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['cliente', 'loyalty', user?.id],
    queryFn: async () => {
      const [credits, points] = await Promise.all([
        supabase.rpc('get_user_available_credits', { p_user_id: user?.id }),
        supabase.from("pontos").select("pontos").eq("user_id", user?.id).maybeSingle()
      ]);
      return { credits: credits.data || 0, points: points.data?.pontos || 0 };
    },
    enabled: !!user?.id,
  });

  if (profileLoading || !user) return <div className="flex items-center justify-center h-screen bg-background">Loading...</div>;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24">
        <div className="px-5 pt-5 max-w-lg mx-auto space-y-6">
          <ClientHeader profileName={profileData?.nome} userId={user?.id} />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
             <div onClick={() => setWalletSheetOpen(true)} className="p-4 rounded-2xl bg-card border border-border/40 shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
               <Wallet className="w-5 h-5 text-primary mb-1" />
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</p>
               <p className="text-lg font-bold">R$ {loyaltyData?.credits?.toFixed(2) || "0,00"}</p>
             </div>
             <div onClick={() => setPointsModalOpen(true)} className="p-4 rounded-2xl bg-card border border-border/40 shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
               <Gift className="w-5 h-5 text-secondary mb-1" />
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Pontos</p>
               <p className="text-lg font-bold">{loyaltyData?.points || 0}</p>
             </div>
          </div>

          <ScheduleButton onClick={() => navigate("/agendar")} />

          {/* Appointments */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 px-1">Próximos Agendamentos</h2>
            {appointments && appointments.length > 0 ? (
              appointments.map((apt: any) => (
                <AppointmentCardPremium key={apt.id} appointment={apt} />
              ))
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center text-center space-y-2">
                <Calendar className="w-8 h-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation onProfileClick={() => navigate("/cliente/perfil")} onPlansClick={() => setPlansSheetOpen(true)} />
      
      <WalletSheet open={walletSheetOpen} onOpenChange={setWalletSheetOpen} userId={user?.id} profile={profileData} />
      <MyPlansSheet open={plansSheetOpen} onOpenChange={setPlansSheetOpen} userId={user?.id} />
      <PointsDetailModal open={pointsModalOpen} onOpenChange={setPointsModalOpen} points={loyaltyData?.points || 0} redemptions={0} pontosNecessarios={8} />
    </div>
  );
};

export default Cliente;
