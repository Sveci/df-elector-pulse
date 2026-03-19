import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ManualVisitFormDialog } from "@/components/office/ManualVisitFormDialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  useScheduledVisitsByMonth, 
  useScheduledVisitsByDate, 
  useScheduledVisitsStats 
} from "@/hooks/office/useScheduledVisits";
import { CreateScheduledVisitDialog } from "@/components/office/CreateScheduledVisitDialog";
import { OfficeStatusBadge } from "@/components/office/OfficeStatusBadge";
import { ProtocolBadge } from "@/components/office/ProtocolBadge";
import { formatPhoneBR } from "@/services/office/officeService";
import { Loader2, Plus, CalendarDays, Clock, CheckCircle2, AlertCircle, User, FileText, Send } from "lucide-react";
import type { OfficeVisitStatus } from "@/types/office";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const scheduleTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="schedule-header"]',
    title: "Agenda de Visitas",
    content: "Gerencie os agendamentos de visitas ao gabinete. Visualize por mês e dia.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="schedule-stats"]',
    title: "Estatísticas do Mês",
    content: "Acompanhe o total de visitas agendadas, confirmadas e pendentes.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="schedule-calendar"]',
    title: "Calendário",
    content: "Clique em uma data para ver as visitas agendadas. Dias com visitas são destacados.",
    placement: "right",
  },
];
// Componente para mostrar o estágio da visita
const VisitStageBadge = ({ status }: { status: string }) => {
  if (status === "SCHEDULED" || status === "REGISTERED" || status === "LINK_SENT") {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Aguardando Preenchimento
      </Badge>
    );
  }
  if (status === "FORM_OPENED") {
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">
        <Send className="h-3 w-3 mr-1" />
        Form Aberto
      </Badge>
    );
  }
  if (status === "FORM_SUBMITTED" || status === "RESCHEDULED") {
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
        <FileText className="h-3 w-3 mr-1" />
        Form Preenchido
      </Badge>
    );
  }
  if (status === "CHECKED_IN") {
    return (
      <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Check-in Realizado
      </Badge>
    );
  }
  return null;
};

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { restartTutorial } = useTutorial("office-schedule", scheduleTutorialSteps);

  const { data: monthVisits = [], isLoading: monthLoading } = useScheduledVisitsByMonth(currentMonth);
  const { data: dayVisits = [], isLoading: dayLoading } = useScheduledVisitsByDate(selectedDate);
  const { data: stats } = useScheduledVisitsStats(currentMonth);

  // Mapear datas com visitas para destacar no calendário
  const datesWithVisits = monthVisits.reduce((acc, visit) => {
    if (visit.scheduled_date) {
      const dateKey = visit.scheduled_date;
      acc[dateKey] = (acc[dateKey] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  return (
    <div className="container mx-auto py-6">
      <TutorialOverlay page="office-schedule" />
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6" data-tutorial="schedule-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Agenda de Visitas</h1>
            <TutorialButton onClick={restartTutorial} />
          </div>
          <p className="text-muted-foreground">
            Gerencie os agendamentos de visitas ao gabinete
          </p>
        </div>
        
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Visita Agendada
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-tutorial="schedule-stats">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Total Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              em {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Confirmadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.confirmed || 0}</div>
            <p className="text-xs text-muted-foreground">visitas confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">aguardando confirmação</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendário */}
        <Card className="min-h-[480px]" data-tutorial="schedule-calendar">
          <CardHeader>
            <CardTitle className="text-base">Calendário</CardTitle>
            <CardDescription>Selecione uma data para ver as visitas</CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {monthLoading ? (
              <div className="flex items-center justify-center h-[380px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                onMonthChange={handleMonthChange}
                locale={ptBR}
                className="w-full"
                classNames={{
                  months: "flex flex-col w-full",
                  month: "w-full space-y-4",
                  caption: "flex justify-center pt-1 relative items-center mb-4",
                  caption_label: "text-lg font-semibold",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-muted rounded-md transition-colors",
                  nav_button_previous: "absolute left-0",
                  nav_button_next: "absolute right-0",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground flex-1 font-medium text-sm text-center py-2",
                  row: "flex w-full mt-1",
                  cell: "flex-1 text-center text-sm p-1 relative",
                  day: "h-12 w-full p-0 font-normal hover:bg-muted rounded-lg transition-colors flex items-center justify-center cursor-pointer",
                  day_range_end: "day-range-end",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-muted font-semibold",
                  day_outside: "text-muted-foreground opacity-40",
                  day_disabled: "text-muted-foreground opacity-40",
                  day_hidden: "invisible",
                }}
                modifiers={{
                  hasVisits: (date) => {
                    const dateKey = format(date, "yyyy-MM-dd");
                    return !!datesWithVisits[dateKey];
                  },
                }}
                modifiersStyles={{
                  hasVisits: {
                    fontWeight: "600",
                    backgroundColor: "hsl(var(--primary) / 0.08)",
                  },
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateKey = format(date, "yyyy-MM-dd");
                    const count = datesWithVisits[dateKey];
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <span>{date.getDate()}</span>
                        {count && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                        )}
                      </div>
                    );
                  },
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Lista de visitas do dia */}
        <Card className="min-h-[480px]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Visitas em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              {dayVisits.length} visita(s) agendada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dayLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : dayVisits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma visita agendada para este dia</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agendar Visita
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-4 bg-muted rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">
                            {visit.scheduled_time?.substring(0, 5)}
                          </span>
                          {visit.confirmed_at && (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirmada
                            </Badge>
                          )}
                        </div>
                        <ProtocolBadge protocolo={visit.protocolo} showCopy={false} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <OfficeStatusBadge status={visit.status as OfficeVisitStatus} />
                        <VisitStageBadge status={visit.status} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{visit.contact?.nome}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {visit.contact?.telefone_norm && formatPhoneBR(visit.contact.telefone_norm)}
                      </span>
                    </div>

                    {visit.leader && (
                      <div className="text-xs text-muted-foreground">
                        Indicação: {visit.leader.nome_completo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateScheduledVisitDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={selectedDate}
      />
    </div>
  );
}
