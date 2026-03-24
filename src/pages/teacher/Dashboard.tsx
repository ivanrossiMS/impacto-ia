import React, { useEffect, useState } from 'react';
import type { Teacher } from '../../types/user';
import { useAuthStore } from '../../store/auth.store';
import {
  BookOpen, AlertCircle, TrendingUp, BarChart3,
  Plus, ArrowUpRight, Wand2, Sparkles, GraduationCap,
  LayoutDashboard, Megaphone, Users, AlertTriangle,
  UserCheck, Bot, Flame, Zap, MessageSquare, Activity
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { AnnouncementModal } from '../../components/modals/AnnouncementModal';
import { cn } from '../../lib/utils';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

const FORGOTTEN_DAYS = 5; // students inactive for more than this many days

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user) as Teacher;
  const [loading, setLoading] = useState(true);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [studentStats, setStudentStats] = useState<Record<string, any>>({});
  const [isLoadingAIAlert, setIsLoadingAIAlert] = useState(false);

  // ── Fetch teacher's classes & students ──────────────────────────────────────
  const teacherUsersData = useSupabaseQuery<any>('users');
  const teacherUser = teacherUsersData?.find((u: any) => u.id === user?.id);
  const teacherClassIds: string[] = teacherUser?.classIds || [];

  const allClassesData = useSupabaseQuery<any>('classes');
  const myClasses = (allClassesData || []).filter((c: any) => teacherClassIds.includes(c.id));

  const allStudentsData = useSupabaseQuery<any>('users');
  const classIds = myClasses.map((c: any) => c.id);
  const allStudents = (allStudentsData || []).filter(
    (u: any) => classIds.includes(u.classId) && u.role === 'student'
  );

  const dbActivities = useSupabaseQuery<any>('activities') || [];
  const savedActivitiesCount = dbActivities.length;

  // ── Fetch gamification stats for all students ───────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!allStudents.length) return;
    const fetchStats = async () => {
      const ids = allStudents.map((s: any) => s.id);
      const { data } = await supabase
        .from('gamification_stats')
        .select('id, xp, streak, lastStudyDate, level')
        .in('id', ids);
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(s => { map[s.id] = s; });
        setStudentStats(map);
      }
    };
    fetchStats();
  }, [allStudents.length]);

  // ── Compute risk & forgotten students ──────────────────────────────────────
  const now = Date.now();
  const FIVE_DAYS_MS = FORGOTTEN_DAYS * 24 * 60 * 60 * 1000;

  const forgottenStudents = allStudents.filter((s: any) => {
    const stats = studentStats[s.id];
    if (!stats) return false;
    const last = stats.lastStudyDate ? new Date(stats.lastStudyDate).getTime() : 0;
    return now - last > FIVE_DAYS_MS;
  });

  // Average XP per class
  const classRiskMap = myClasses.reduce((acc: Record<string, { atRisk: number; total: number }>, cls: any) => {
    const classStudents = allStudents.filter((s: any) => s.classId === cls.id);
    const xps = classStudents.map((s: any) => studentStats[s.id]?.xp ?? 0);
    const avg = xps.length ? xps.reduce((a: number, b: number) => a + b, 0) / xps.length : 0;
    const atRisk = xps.filter((x: number) => x < avg * 0.5).length;
    acc[cls.id] = { atRisk, total: classStudents.length };
    return acc;
  }, {});

  // ── AI forgotten-students alert ─────────────────────────────────────────────
  const handleAIForgottenAlert = async () => {
    if (!forgottenStudents.length) { toast.info('Nenhum aluno inativo no momento.'); return; }
    setIsLoadingAIAlert(true);
    try {
      const names = forgottenStudents.slice(0, 5).map((s: any) => s.name.split(' ')[0]).join(', ');
      const prompt = `Professor(a) ${user?.name?.split(' ')[0]}, ${forgottenStudents.length} aluno(s) não acessam a plataforma há mais de ${FORGOTTEN_DAYS} dias: ${names}. Escreva uma mensagem motivacional e acolhedora (3-4 frases) que o professor poderia enviar para eles via comunicado. Seja caloroso e incentivador.`;

      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, intent: 'teacher_alert' }),
      });
      const { text } = await res.json();
      if (text) {
        // Copy to clipboard
        await navigator.clipboard.writeText(text);
        toast.success('Mensagem gerada e copiada para a área de transferência!', { duration: 5000 });
        setIsAnnouncementOpen(true);
      }
    } catch {
      toast.error('Erro ao gerar mensagem. Tente novamente.');
    } finally {
      setIsLoadingAIAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const welcomeName = user?.name?.split(' ')[0] || 'Docente';
  const totalStudents = allStudents.length;
  const avgStreak = allStudents.length > 0
    ? Math.round(allStudents.reduce((sum: number, s: any) => sum + (studentStats[s.id]?.streak ?? 0), 0) / allStudents.length)
    : 0;
  const activeToday = allStudents.filter((s: any) => {
    const last = studentStats[s.id]?.lastStudyDate;
    if (!last) return false;
    return new Date(last).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="space-y-2">
          <Badge variant="primary" className="mb-2">Painel Docente</Badge>
          <h1 className="text-4xl font-black text-slate-900 leading-tight">
            Olá, <span className="text-primary-600">Profr. {welcomeName}</span>!
          </h1>
          <p className="text-slate-500 font-medium text-lg">Pronto para inspirar seus alunos hoje?</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setIsAnnouncementOpen(true)}
            variant="outline"
            className="rounded-2xl gap-2 font-bold px-6 border-slate-200"
          >
            <Megaphone size={18} /> Comunicado
          </Button>
          <Button
            onClick={() => navigate('/teacher/activities')}
            variant="primary"
            className="rounded-2xl gap-2 font-black px-8"
          >
            <Plus size={20} /> Nova Atividade
          </Button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { label: 'Turmas Ativas', value: myClasses.length.toString(), icon: LayoutDashboard, color: 'text-primary-500', bg: 'bg-primary-50', sub: `${classIds.length} turma${classIds.length !== 1 ? 's' : ''}` },
          { label: 'Total de Alunos', value: totalStudents.toString(), icon: GraduationCap, color: 'text-special-500', bg: 'bg-special-50', sub: `${activeToday} ativos hoje` },
          { label: 'Atividades', value: savedActivitiesCount.toString(), icon: BookOpen, color: 'text-success-500', bg: 'bg-success-50', sub: 'criadas' },
          { label: 'Streak Médio', value: `${avgStreak}d`, icon: Flame, color: 'text-energy-500', bg: 'bg-energy-50', sub: 'dos alunos' },
        ].map((stat, i) => (
          <Card key={i} className="p-5 lg:p-6 transition-all hover:shadow-floating hover:-translate-y-1 border-slate-100">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner', stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] mb-0.5">{stat.label}</div>
            <div className="text-3xl font-black text-slate-800 tracking-tight leading-none">{stat.value}</div>
            <div className="text-xs font-bold text-slate-400 mt-1">{stat.sub}</div>
          </Card>
        ))}
      </div>

      {/* Forgotten Students Alert */}
      {forgottenStudents.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
              <AlertTriangle size={28} />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Alerta de Engajamento</div>
              <h3 className="text-xl font-black">
                {forgottenStudents.length} aluno{forgottenStudents.length !== 1 ? 's' : ''} sem acessar há {FORGOTTEN_DAYS}+ dias
              </h3>
              <p className="text-white/80 text-sm font-medium">
                {forgottenStudents.slice(0, 3).map((s: any) => s.name.split(' ')[0]).join(', ')}
                {forgottenStudents.length > 3 ? ` e mais ${forgottenStudents.length - 3}...` : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAIForgottenAlert}
                disabled={isLoadingAIAlert}
                className="bg-white text-orange-600 hover:bg-orange-50 font-black px-6 rounded-2xl gap-2 shadow-lg flex-shrink-0"
              >
                {isLoadingAIAlert
                  ? <><div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/> Gerando...</>
                  : <><Bot size={18} /> Gerar Mensagem IA</>
                }
              </Button>
              <Button
                onClick={() => setIsAnnouncementOpen(true)}
                className="bg-white/20 border border-white/30 text-white hover:bg-white/30 font-bold px-5 rounded-2xl flex-shrink-0"
              >
                <Megaphone size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Classes List with Risk Indicators */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <BarChart3 size={24} className="text-primary-500" /> Minhas Turmas
            </h2>
            <Button variant="ghost" size="sm" className="text-primary-600 font-bold gap-1" onClick={() => navigate('/teacher/classes')}>
              Ver Todas <ArrowUpRight size={16} />
            </Button>
          </div>

          {myClasses.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <Users size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="font-bold text-slate-400">Nenhuma turma atribuída ainda.</p>
              <p className="text-sm text-slate-300">O administrador vinculará turmas ao seu perfil.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {myClasses.slice(0, 4).map((cls: any) => {
                const studentCount = allStudents.filter(s => (s as any).classId === cls.id).length;
                const risk = classRiskMap[cls.id] || { atRisk: 0, total: studentCount };
                const hasRisk = risk.atRisk > 0;

                return (
                  <Card
                    key={cls.id}
                    className={cn(
                      "p-6 border group hover:border-primary-200 transition-all cursor-pointer relative overflow-hidden",
                      hasRisk ? "border-orange-100 bg-orange-50/30" : "border-slate-100"
                    )}
                    onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                  >
                    {/* Risk badge */}
                    {hasRisk && (
                      <div className="absolute top-4 right-4 flex items-center gap-1 bg-orange-100 text-orange-600 px-2.5 py-1 rounded-xl text-[10px] font-black">
                        <AlertTriangle size={10} />
                        {risk.atRisk} em risco
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-4 pr-24">
                      <div>
                        <h4 className="text-xl font-black text-slate-800">{cls.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cls.grade}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <Badge variant={hasRisk ? 'energy' : 'primary'}>{studentCount} alunos</Badge>
                      {hasRisk && (
                        <span className="text-[10px] font-black text-orange-500 flex items-center gap-1">
                          <Activity size={10} /> Atenção necessária
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-1.5">
                        <span>Ocupação</span>
                        <span>{studentCount > 0 ? `${Math.min(100, Math.round((studentCount / 30) * 100))}%` : '0%'}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-1000",
                            hasRisk ? "bg-orange-400" : "bg-primary-500"
                          )}
                          style={{ width: `${Math.min(100, Math.round((studentCount / 30) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick engagement pill */}
                    {Object.keys(studentStats).length > 0 && (
                      <div className="mt-4 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <UserCheck size={11} className="text-success-500" />
                          {allStudents.filter((s: any) => {
                            if (s.classId !== cls.id) return false;
                            const last = studentStats[s.id]?.lastStudyDate;
                            return last && (now - new Date(last).getTime()) < 24 * 60 * 60 * 1000;
                          }).length} ativos hoje
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Zap size={11} className="text-primary-400" />
                          {Math.round(
                            allStudents
                              .filter((s: any) => s.classId === cls.id)
                              .reduce((sum: number, s: any) => sum + (studentStats[s.id]?.xp ?? 0), 0)
                            / Math.max(1, allStudents.filter((s: any) => s.classId === cls.id).length)
                          )} XP médio
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* AI Banner */}
          <section className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-special-600 rounded-[2.5rem] shadow-floating">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-white/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -ml-20 -mb-20" />
            </div>

            <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4 text-center md:text-left">
                <Badge variant="ai" className="bg-white/20 border-white/30 text-white border-0 py-2 px-4 shadow-sm">Tecnologia Socrática</Badge>
                <h2 className="text-3xl font-black text-white leading-tight">Crie trilhas inteligentes com um clique</h2>
                <p className="text-primary-100 font-medium">Nossa IA gera questões alinhadas à BNCC para sua turma.</p>
              </div>
              <Button
                onClick={() => navigate('/teacher/create-activity')}
                className="bg-white text-primary-700 hover:bg-white hover:scale-105 active:scale-95 px-10 py-5 rounded-[1.5rem] font-black text-xl transition-all shadow-2xl shrink-0 group-hover:rotate-1"
              >
                <Wand2 className="mr-3" /> Gerar Trilha
              </Button>
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Engagement Summary */}
          <Card className="p-6 border-slate-100">
            <h2 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary-500" /> Engajamento
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-600">Ativos hoje</div>
                <div className="font-black text-slate-800">{activeToday}/{totalStudents}</div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-success-500 rounded-full transition-all duration-1000"
                  style={{ width: `${totalStudents ? Math.round(activeToday / totalStudents * 100) : 0}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-600">Inativos (5+ dias)</div>
                <div className={cn("font-black", forgottenStudents.length > 0 ? "text-orange-500" : "text-slate-800")}>
                  {forgottenStudents.length}
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all duration-1000"
                  style={{ width: `${totalStudents ? Math.round(forgottenStudents.length / totalStudents * 100) : 0}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-600">Streak médio</div>
                <div className="flex items-center gap-1 font-black text-energy-600">
                  🔥 {avgStreak} dias
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Tips */}
          <Card className="p-6 border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-warning-500" /> Dicas Rápidas
            </h2>
            <div className="space-y-3">
              {[
                { text: 'Atribua atividades às suas turmas para acompanhar o progresso.', icon: BookOpen },
                { text: 'Alunos com XP < 50% da média da turma precisam de atenção especial.', icon: AlertCircle },
                { text: 'Use comunicados para manter todos motivados!', icon: MessageSquare },
              ].map((tip, i) => (
                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="flex items-start gap-3">
                    <tip.icon size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{tip.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary card */}
          <Card className="p-6 bg-slate-900 border-slate-800 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6">
              <Sparkles className="text-warning-500 opacity-20" size={52} />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-warning-400 border border-white/20">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-black">Progresso da Semana</h3>
              <p className="text-slate-400 font-medium leading-relaxed text-sm">
                Você tem <span className="text-white font-bold">{myClasses.length} turma{myClasses.length !== 1 ? 's' : ''}</span> ativa{myClasses.length !== 1 ? 's' : ''} e <span className="text-white font-bold">{totalStudents} aluno{totalStudents !== 1 ? 's' : ''}</span> sob sua orientação.
                {forgottenStudents.length > 0 && <span className="text-orange-300 font-black"> {forgottenStudents.length} precisam de atenção.</span>}
              </p>
              <Button
                className="w-full bg-warning-500 text-slate-900 hover:bg-warning-400 font-black py-3 rounded-2xl shadow-xl"
                onClick={() => navigate('/teacher/classes')}
              >
                Ver Turmas
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <AnnouncementModal
        isOpen={isAnnouncementOpen}
        onClose={() => setIsAnnouncementOpen(false)}
        classes={myClasses.map((c: any) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
};
