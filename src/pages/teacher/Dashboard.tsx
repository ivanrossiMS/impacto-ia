import React, { useEffect, useState } from 'react';
import type { Teacher } from '../../types/user';
import { useAuthStore } from '../../store/auth.store';
import {
  BookOpen, Clock, AlertCircle, TrendingUp, BarChart3,
  Plus, ArrowUpRight, Wand2, Sparkles, GraduationCap,
  LayoutDashboard, Megaphone, Users
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { AnnouncementModal } from '../../components/modals/AnnouncementModal';
import { cn } from '../../lib/utils';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user) as Teacher;
  const [loading, setLoading] = useState(true);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Fetch teacher's assigned classes from DB
  const teacherUser = useLiveQuery(async () => {
    if (!user) return null;
    return db.users.get(user.id);
  }, [user?.id]);

  const teacherClassIds: string[] = (teacherUser as any)?.classIds || [];

  const myClasses = useLiveQuery(async () => {
    const all = await db.classes.toArray();
    return all.filter(c => teacherClassIds.includes(c.id));
  }, [teacherClassIds.join(',')]) || [];

  const allStudents = useLiveQuery(async () => {
    if (myClasses.length === 0) return [];
    const classIds = myClasses.map(c => c.id);
    return db.users
      .where('classId')
      .anyOf(classIds)
      .and(u => u.role === 'student')
      .toArray();
  }, [myClasses.map(c => c.id).join(',')]) || [];

  // Fetch activities from Dexie
  const dbActivities = useLiveQuery(async () => {
    return db.activities.toArray();
  }) || [];

  const savedActivitiesCount = dbActivities.length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const welcomeName = user?.name?.split(' ')[0] || 'Docente';
  const totalStudents = allStudents.length;

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Turmas Ativas', value: myClasses.length.toString(), icon: LayoutDashboard, color: 'text-primary-500', bg: 'bg-primary-50' },
          { label: 'Total de Alunos', value: totalStudents.toString(), icon: GraduationCap, color: 'text-special-500', bg: 'bg-special-50' },
          { label: 'Atividades Salvas', value: savedActivitiesCount.toString(), icon: BookOpen, color: 'text-success-500', bg: 'bg-success-50' },
          { label: 'Aguardando Avaliação', value: '0', icon: Clock, color: 'text-warning-500', bg: 'bg-warning-50' },
        ].map((stat, i) => (
          <Card key={i} className="p-6 transition-all hover:shadow-floating hover:-translate-y-1 border-slate-100">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner', stat.bg, stat.color)}>
              <stat.icon size={28} />
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] mb-1">{stat.label}</div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Classes List */}
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myClasses.slice(0, 4).map((cls) => {
                  const studentCount = allStudents.filter(s => (s as any).classId === cls.id).length;
                  return (
                    <Card
                      key={cls.id}
                      className="p-6 border-slate-100 group hover:border-primary-200 transition-colors cursor-pointer"
                      onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-black text-slate-800">{cls.name}</h4>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cls.grade}</p>
                        </div>
                        <Badge variant="primary">{studentCount} alunos</Badge>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-1.5">
                          <span>Ocupação</span>
                          <span>{studentCount > 0 ? `${Math.min(100, Math.round((studentCount / 30) * 100))}%` : '0%'}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, Math.round((studentCount / 30) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* AI Banner */}
          <section className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-special-600 rounded-[2.5rem] shadow-floating">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-white/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -ml-20 -mb-20" />
            </div>

            <div className="relative z-10 p-10 flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 space-y-5 text-center md:text-left">
                <Badge variant="ai" className="bg-white/20 border-white/30 text-white border-0 py-2 px-4 shadow-sm">Tecnologia Socrática</Badge>
                <h2 className="text-4xl font-black text-white leading-tight">Crie trilhas inteligentes com um clique</h2>
                <p className="text-primary-100 text-lg font-medium">Nossa IA gera questões alinhadas à BNCC para sua turma.</p>
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
        <div className="space-y-10">
          <Card className="p-8 border-slate-100 bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
              <AlertCircle size={24} className="text-energy-500" /> Dicas
            </h2>
            <div className="space-y-4">
              {[
                { text: 'Atribua atividades às suas turmas para acompanhar o progresso dos alunos.', icon: BookOpen },
                { text: 'Use a IA para gerar provas e simulados alinhados à BNCC.', icon: Sparkles },
                { text: 'Acesse a Biblioteca para encontrar materiais prontos para suas aulas.', icon: LayoutDashboard },
              ].map((tip, i) => (
                <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <tip.icon size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-600 font-medium">{tip.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8 bg-slate-900 border-slate-800 text-white relative h-[280px] overflow-hidden flex flex-col justify-end">
            <div className="absolute top-0 right-0 p-8">
              <Sparkles className="text-warning-500 opacity-20" size={60} />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-warning-400 border border-white/20">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-2xl font-black">Progresso da Semana</h3>
              <p className="text-slate-400 font-medium leading-relaxed text-sm">
                Você tem <span className="text-white font-bold">{myClasses.length} turma{myClasses.length !== 1 ? 's' : ''}</span> ativa{myClasses.length !== 1 ? 's' : ''} e <span className="text-white font-bold">{totalStudents} aluno{totalStudents !== 1 ? 's' : ''}</span> sob sua orientação.
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
        classes={myClasses.map(c => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
};
