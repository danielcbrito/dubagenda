import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";

interface AgendaMensalViewProps {
  appointments: any[];
  onSelectDate: (date: Date) => void;
}

export function AgendaMensalView({ appointments, onSelectDate }: AgendaMensalViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Get dates with appointments
  const datesWithAppointments = new Set(
    appointments.map(apt => format(new Date(apt.data), "yyyy-MM-dd"))
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onSelectDate(date);
    }
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return appointments.filter(apt => format(new Date(apt.data), "yyyy-MM-dd") === dateStr);
  };

  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Visão Mensal</h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          locale={ptBR}
          className="rounded-md border"
          modifiers={{
            hasAppointments: (date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              return datesWithAppointments.has(dateStr);
            }
          }}
          modifiersStyles={{
            hasAppointments: {
              fontWeight: 'bold',
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              borderRadius: '4px'
            }
          }}
        />
      </Card>

      {/* Selected Day Summary */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">
          {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
        </h3>

        {selectedDateAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedDateAppointments.length} {selectedDateAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
            <div className="space-y-2">
              {selectedDateAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{apt.hora}</p>
                    <p className="text-xs text-muted-foreground">{apt.servico?.nome || "Serviço"}</p>
                    <p className="text-xs text-muted-foreground">{apt.profile?.nome || "Cliente"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
