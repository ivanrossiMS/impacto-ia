import React from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Bell,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

interface Event {
  id: string;
  title: string;
  type: 'school' | 'family' | 'exam';
  date: string;
  time: string;
  location?: string;
  participants: string[];
}

export const FamilyCalendar: React.FC = () => {
  const currentMonth = 'Março 2024';

  const events: Event[] = [
    { 
      id: '1', 
      title: 'Reunião de Pais e Mestres', 
      type: 'school', 
      date: '2024-03-25', 
      time: '19:00', 
      location: 'Auditório Principal',
      participants: ['Ana Silva (Profa.)', 'Ivan (Pai)']
    },
    { 
      id: '2', 
      title: 'Prova de Matemática - João', 
      type: 'exam', 
      date: '2024-03-22', 
      time: '08:00', 
      participants: ['João']
    },
    { 
      id: '3', 
      title: 'Feira de Ciências', 
      type: 'school', 
      date: '2024-03-30', 
      time: '09:00', 
      location: 'Ginásio Poliesportivo',
      participants: ['João', 'Maria', 'Ivan (Pai)']
    },
  ];

  const days = Array.from({ length: 31 }).map((_, i) => i + 1);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-energy-500">
            <CalendarIcon size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Planejamento Familiar</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Calendário <span className="text-energy-600">Interativo</span></h1>
          <p className="text-slate-500 font-medium font-outfit">Acompanhe datas importantes, provas e eventos de todos os seus filhos.</p>
        </div>
        <div className="flex gap-3">
            <Button variant="primary" className="rounded-2xl gap-2 font-black px-8 shadow-xl shadow-energy-500/20">
                <Plus size={20} /> Adicionar Lembrete
            </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Calendar Grid */}
        <Card className="lg:col-span-8 p-10 bg-white border-slate-100 rounded-[3rem] shadow-xl">
           <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-slate-800">{currentMonth}</h2>
              <div className="flex items-center gap-3">
                 <Button variant="outline" size="sm" className="rounded-xl p-2 h-10 w-10 border-slate-100 text-slate-400 group hover:border-primary-200">
                    <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                 </Button>
                 <Button variant="outline" size="sm" className="rounded-xl p-2 h-10 w-10 border-slate-100 text-slate-400 group hover:border-primary-200">
                    <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                 </Button>
              </div>
           </div>

           <div className="grid grid-cols-7 gap-4 mb-4">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">{d}</div>
              ))}
           </div>

           <div className="grid grid-cols-7 gap-4">
              {days.map(day => {
                const dayEvents = events.filter(e => parseInt(e.date.split('-')[2]) === day);
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "aspect-square rounded-[1.5rem] p-4 flex flex-col items-center justify-between relative border-2 transition-all cursor-pointer group",
                      dayEvents.length > 0 ? "bg-primary-50 border-primary-100" : "bg-slate-50/50 border-transparent hover:border-slate-100 hover:bg-white"
                    )}
                  >
                     <span className={cn(
                       "text-sm font-black",
                       dayEvents.length > 0 ? "text-primary-700" : "text-slate-400 group-hover:text-slate-600"
                     )}>{day}</span>
                     {dayEvents.length > 0 && (
                       <div className="flex gap-1">
                          {dayEvents.map((e, idx) => (
                            <div key={idx} className={cn(
                              "w-1.5 h-1.5 rounded-full shadow-sm",
                              e.type === 'school' ? "bg-primary-500" : e.type === 'exam' ? "bg-red-500" : "bg-warning-500"
                            )}></div>
                          ))}
                       </div>
                     )}
                  </div>
                );
              })}
           </div>
        </Card>

        {/* Event List / Detail Sidebar */}
        <div className="lg:col-span-4 space-y-8">
           <Card className="p-8 bg-slate-900 border-none rounded-[3rem] shadow-2xl relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-energy-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center gap-2">
                 <Bell size={16} className="text-energy-400" /> Próximos Compromissos
              </h3>
              
              <div className="space-y-6">
                 {events.map((event) => (
                   <div key={event.id} className="group relative pl-6 border-l-2 border-white/10 hover:border-primary-400 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                         <Badge variant={event.type === 'exam' ? 'danger' : 'primary'} className="scale-75 origin-left">
                            {event.type === 'exam' ? 'Avaliação' : 'Escolar'}
                         </Badge>
                         <span className="text-[10px] font-black uppercase text-slate-500">{event.date.split('-')[2]}/03</span>
                      </div>
                      <h4 className="text-lg font-black leading-tight group-hover:text-primary-400 transition-colors">{event.title}</h4>
                      <div className="flex items-center gap-3 mt-3 text-slate-400">
                         <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            <Clock size={12} /> {event.time}
                         </div>
                         {event.location && (
                           <div className="flex items-center gap-1.5 text-[11px] font-bold border-l border-white/10 pl-3">
                              <MapPin size={12} /> {event.location}
                           </div>
                         )}
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                         <div className="flex -space-x-2">
                            {event.participants.map((p, i) => (
                              <div key={i} className="w-6 h-6 rounded-full bg-slate-700 border border-slate-800 flex items-center justify-center text-[8px] font-black uppercase shadow-sm">
                                {p[0]}
                              </div>
                            ))}
                         </div>
                         <span className="text-[10px] font-bold text-slate-500">
                            {event.participants.length} envolvidos
                         </span>
                      </div>
                   </div>
                 ))}
              </div>
           </Card>

           <Card className="p-8 border-slate-100 rounded-[2.5rem] bg-slate-50/50">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-success-100 rounded-2xl flex items-center justify-center text-success-600 shadow-sm">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <h4 className="text-sm font-black text-slate-800">Dica Capy</h4>
                    <p className="text-xs font-medium text-slate-500 leading-tight mt-1">Sincronize com seu Google Calendar para não perder nada!</p>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};
