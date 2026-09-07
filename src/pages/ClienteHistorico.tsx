import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon,
  Clock,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { BackArrow } from "@/components/ui/back-arrow";

interface HistoryAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco?: number;
  cupom_id?: string | null;
  desconto_aplicado?: number | null;
  preco_final?: number | null;
  servico: { nome: string };
  cupom?: { codigo: string } | null;
  barbeiro?: {
    apelido: string;
    foto_url: string | null;
    tenant?: { nome: string } | null;
  } | null;
}

export default function ClienteHistorico() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      loadHistory();
    }
  }, [userId]);

  const loadHistory = async () => {
    if (!userId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("agendamentos")
      .select(`
        id,
        data,
        hora,
        status,
        preco,
        cupom_id,
        desconto_aplicado,
        preco_final,
        servico:servicos(nome),
        cupom:cupons(codigo),
        barbeiro:barbeiros(apelido, foto_url, tenant:tenants(nome))
      `)
      .eq("user_id", userId)
      .in("status", ["completed", "cancelled_by_admin", "cancelled_by_user", "no_show"])
      .order("data", { ascending: false });

    if (!error && data) {
      setAppointments(data as any || []);
    }
    setLoading(false);
  };

  // Filtered by selected date only
  const filteredAppointments = useMemo(() => {
    if (!selectedDate) return appointments;
    return appointments.filter((apt) => apt.data === selectedDate);
  }, [appointments, selectedDate]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: "Concluído",
          color: "#16a34a",
        };
      case "cancelled_by_admin":
      case "cancelled_by_user":
        return {
          label: "Cancelado",
          color: "#dc2626",
        };
      case "no_show":
        return {
          label: "Não compareceu",
          color: "#d97706",
        };
      default:
        return {
          label: status,
          color: "#737373",
        };
    }
  };

  return (
    <div className="h-full w-full bg-[#FFFFFF] dark:bg-background relative overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 pt-[max(calc(env(safe-area-inset-top,0px)+1.5rem),2rem)] pb-32">
        {/* Header no mesmo padrão do agendamento — Botão circular sem barra cortando */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-card border border-neutral-200/70 dark:border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            aria-label="Voltar"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Título da tela idêntico ao padrão de agendamento */}
        <div className="mb-6">
          <h1 className="text-[25px] sm:text-[27px] font-bold text-neutral-900 dark:text-foreground tracking-tight leading-tight font-sans">
            Histórico de Agendamentos
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-muted-foreground mt-1">
            Seus cortes e serviços anteriores
          </p>
        </div>

        {/* Filtro apenas por Data — Minimalista */}
        <div className="mb-6">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[16px] bg-white dark:bg-card border border-neutral-200/80 dark:border-border text-neutral-700 dark:text-foreground text-[12px] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <CalendarIcon className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="text-neutral-500 dark:text-muted-foreground text-[11.5px] shrink-0">
              Filtrar por data:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-neutral-900 dark:text-foreground text-[12px] font-medium focus:outline-none flex-1 cursor-pointer"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 active:scale-90 transition-transform"
                title="Limpar filtro de data"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Cards de Agendamento — Mesmo padrão limpo da home (AppointmentCardPremium) */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-neutral-400">Carregando histórico...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-24">
            <CalendarIcon className="w-9 h-9 mx-auto mb-3 text-neutral-400 dark:text-muted-foreground stroke-[1.5]" />
            <h3 className="text-[15px] font-medium text-neutral-900 dark:text-foreground">
              Nenhum agendamento encontrado
            </h3>
            <p className="text-[12px] text-neutral-400 dark:text-muted-foreground mt-1">
              {selectedDate
                ? "Nenhum agendamento para a data selecionada."
                : "Seus cortes e agendamentos anteriores aparecerão aqui."}
            </p>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="mt-3 text-[12px] font-medium text-neutral-900 dark:text-foreground underline underline-offset-4"
              >
                Ver todos os agendamentos
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((apt, idx) => {
              const statusConfig = getStatusConfig(apt.status);
              const dateObj = new Date(`${apt.data}T12:00:00`);
              const finalPrice = apt.preco_final ?? apt.preco;
              const shopName = apt.barbeiro?.tenant?.nome || "Barbearia";

              return (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.25) }}
                  className="relative mb-3 rounded-[24px] overflow-hidden bg-white dark:bg-card border border-neutral-200/80 dark:border-border/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-[0.99] transition-transform p-5"
                >
                  {/* Top row: Status Badge + Date/Time */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-tight"
                      style={{ color: statusConfig.color }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusConfig.color }}
                      />
                      {statusConfig.label}
                    </div>

                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-medium tracking-tight text-neutral-600 dark:text-neutral-400">
                        {format(dateObj, "dd MMM", { locale: ptBR })}
                      </span>
                      <span>•</span>
                      <Clock className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
                      <span className="text-[12px] font-medium tracking-tight text-neutral-700 dark:text-neutral-300">
                        {apt.hora}
                      </span>
                    </div>
                  </div>

                  {/* Center row: Service Name + Price */}
                  <div className="mb-2">
                    <h3 className="font-medium text-neutral-900 dark:text-foreground text-[16px] leading-snug tracking-tight mb-1">
                      {apt.servico?.nome || "Serviço"}
                    </h3>

                    {finalPrice !== undefined && finalPrice !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                          R$ {Number(finalPrice).toFixed(2).replace(".", ",")}
                        </span>
                        {apt.cupom?.codigo && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 px-2 py-0.5 rounded-full">
                            Cupom: {apt.cupom.codigo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Shop + Barber text (apenas texto por escrito, minimalista) */}
                  <p className="text-[12px] text-neutral-400 font-normal">
                    <span>{shopName}</span>
                    {apt.barbeiro?.apelido && (
                      <span> • {apt.barbeiro.apelido}</span>
                    )}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}