import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import {
  BarChart3, TrendingUp, Users, Award, Brain, Target,
  BookOpen, Zap, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '../../store/auth.store';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  // ── Real data from Dexie ─────────────────────────────────────────────────
  const teacherUser = useLiveQuery(async () => user ? db.users.get(user.id) : null, [user?.id]);
  const classIds: string[] = (teacherUser as any)?.classIds || [];

  const classes = useLiveQuery(async () => {
    if (!classIds.length) return [];
    const all = await db.classes.toArray();
    return all.filter(c => classIds.includes(c.id));
  }, [classIds.join(',')]) || [];

  // Get all student IDs from teacher's classes
  const studentIds = useMemo(() => {
    return [...new Set(classes.flatMap(c => c.studentIds || []))];
  }, [classes]);

  const students = useLiveQuery(async () => {
    if (!studentIds.length) return [];
    const all = await db.users.where('role').equals('student').toArray();
    return all.filter(u => studentIds.includes(u.id));
  }, [studentIds.join(',')]) || [];


  // Activities from Dexie
  const activities = useLiveQuery(async () => {
    const all = await db.activities.toArray();
    return all.filter((a: any) => !a.teacherId || a.teacherId === user?.id);
  }, [user?.id]) || [];

  // Results for all students in teacher's classes
  const activityResults = useLiveQuery(async () => {
    if (!studentIds.length) return [];
    return db.studentActivityResults.where('studentId').anyOf(studentIds).toArray();
  }, [studentIds.join(',')]) || [];

  // ── Computed metrics ─────────────────────────────────────────────────────
  const totalStudents = students.length;
  const totalActivities = activities.length;
  const totalClasses = classes.length;


  // Activity distribution by subject
  const subjectDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach((a: any) => {
      const subj = a.subject || 'Outros';
      map[subj] = (map[subj] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({
        label,
        count,
        percent: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
      }));
  }, [activities, totalActivities]);

  // Activity type distribution
  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach((a: any) => {
      const t = a.type || 'outros';
      map[t] = (map[t] || 0) + 1;
    });
    const labels: Record<string, string> = {
      objetiva: 'Objetiva', dissertativa: 'Dissertativa', simulado: 'Simulado',
      prova_bimestral: 'Prova Bimestral', quiz_divertido: 'Quiz Divertido', prova_mensal: 'Prova Mensal',
    };
    return Object.entries(map).map(([type, count]) => ({
      label: labels[type] || type,
      count,
      percent: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [activities, totalActivities]);

  // Calculation of performance based on real activity results
  const studentPerformanceMap = useMemo(() => {
    const map: Record<string, { total: number; score: number }> = {};
    activityResults.forEach(r => {
      if (!map[r.studentId]) map[r.studentId] = { total: 0, score: 0 };
      map[r.studentId].total += r.totalQuestions || 1;
      map[r.studentId].score += r.score || 0;
    });
    
    // Convert to percentage
    const performance: Record<string, number> = {};
    Object.entries(map).forEach(([sid, data]) => {
      performance[sid] = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
    });
    return performance;
  }, [activityResults]);

  // Average performance
  const avgScore = useMemo(() => {
    const values = Object.values(studentPerformanceMap);
    if (!values.length) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [studentPerformanceMap]);

  // Students by performance band
  const performanceBands = useMemo(() => {
    const bands = { excellent: 0, good: 0, warning: 0, danger: 0, noData: 0 };
    
    students.forEach(student => {
      const score = studentPerformanceMap[student.id];
      if (score === undefined) { 
        bands.noData++; 
        return; 
      }
      
      if (score >= 85) bands.excellent++;
      else if (score >= 70) bands.good++;
      else if (score >= 50) bands.warning++;
      else bands.danger++;
    });
    return bands;
  }, [students, studentPerformanceMap]);

  const hasData = totalStudents > 0 || totalActivities > 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Relatórios de Desempenho</h1>
          <p className="text-slate-500 font-medium">
            {totalClasses} turma{totalClasses !== 1 ? 's' : ''} · {totalStudents} aluno{totalStudents !== 1 ? 's' : ''} · {totalActivities} atividade{totalActivities !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all border',
                period === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>
              {p === '7' ? '7 dias' : p === '30' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Desempenho Médio', value: avgScore > 0 ? `${avgScore}%` : '—',
            sub: avgScore > 0 ? (avgScore >= 70 ? '✅ Acima da média' : '⚠️ Abaixo da média') : 'Sem dados ainda',
            icon: TrendingUp, color: 'text-primary-500', bg: 'bg-primary-50',
          },
          {
            label: 'Atividades Criadas', value: String(totalActivities),
            sub: totalActivities > 0 ? `${activities.filter((a: any) => a.aiAssisted).length} com IA` : 'Nenhuma ainda',
            icon: Target, color: 'text-special-500', bg: 'bg-special-50',
          },
          {
            label: 'Total de Alunos', value: String(totalStudents),
            sub: totalClasses > 0 ? `em ${totalClasses} turma${totalClasses !== 1 ? 's' : ''}` : 'Nenhuma turma vinculada',
            icon: Users, color: 'text-success-500', bg: 'bg-success-50',
          },
          {
            label: 'Alunos Excelentes', value: String(performanceBands.excellent),
            sub: totalStudents > 0 ? `${Math.round((performanceBands.excellent / totalStudents) * 100)}% da turma` : 'Sem dados',
            icon: Award, color: 'text-warning-500', bg: 'bg-warning-50',
          },
        ].map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="p-8 border-slate-100 group hover:shadow-floating transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("p-4 rounded-2xl shadow-inner", m.bg, m.color)}>
                  <m.icon size={24} />
                </div>
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{m.label}</div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{m.value}</div>
              <div className="text-xs text-slate-400 font-medium mt-1">{m.sub}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {!hasData && (
        <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[2rem]">
          <AlertCircle size={40} className="mx-auto mb-3 text-slate-200" />
          <h3 className="font-black text-slate-400 text-lg">Nenhum dado disponível ainda</h3>
          <p className="text-slate-300 text-sm mt-1">Crie atividades e adicione alunos às suas turmas para ver os relatórios.</p>
        </div>
      )}

      {hasData && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Activity by subject */}
          <Card className="lg:col-span-2 p-8 border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-500 to-special-500" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <BarChart3 className="text-primary-500" />
                {totalActivities > 0 ? 'Atividades por Disciplina' : 'Distribuição de Alunos por Desempenho'}
              </h3>
            </div>

            {totalActivities > 0 ? (
              subjectDistribution.length > 0 ? (
                <div className="space-y-6">
                  {subjectDistribution.map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-400 uppercase text-[10px] font-black">
                          {item.count} atividade{item.count !== 1 ? 's' : ''} · {item.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden shadow-inner p-0.5 border border-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percent}%` }}
                          transition={{ delay: i * 0.1, duration: 0.7, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-special-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 font-medium text-center py-8">Nenhuma atividade com disciplina definida.</p>
              )
            ) : totalStudents > 0 ? (
              <div className="space-y-6">
                {[
                  { label: '🏆 Excelente (≥ 85%)', count: performanceBands.excellent, color: 'from-emerald-400 to-teal-500' },
                  { label: '✨ Bom (70–84%)', count: performanceBands.good, color: 'from-blue-400 to-indigo-500' },
                  { label: '⚡ Atenção (50–69%)', count: performanceBands.warning, color: 'from-amber-400 to-orange-500' },
                  { label: '🔴 Risco (< 50%)', count: performanceBands.danger, color: 'from-red-400 to-rose-500' },
                  { label: '⏳ Sem dados', count: performanceBands.noData, color: 'from-slate-200 to-slate-300' },
                ].map((item, i) => {
                  const pct = totalStudents > 0 ? Math.round((item.count / totalStudents) * 100) : 0;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-400">{item.count} aluno{item.count !== 1 ? 's' : ''} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden shadow-inner p-0.5 border border-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.1, duration: 0.7 }}
                          className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen size={36} className="mx-auto mb-3 text-slate-200" />
                <p className="text-slate-400 font-medium">Crie atividades para ver a distribuição por disciplina.</p>
              </div>
            )}
          </Card>

          {/* Right: Insights */}
          <Card className="p-8 border-slate-100 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Brain className="text-special-500" /> Resumo da Situação
            </h3>
            <div className="space-y-4">
              {/* Activity type breakdown */}
              {typeDistribution.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipos de Atividade</div>
                  <div className="space-y-2">
                    {typeDistribution.slice(0, 4).map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span className="text-xs font-bold text-slate-700">{t.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-500">{t.count}</span>
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${t.percent}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick insights */}
              <div className="space-y-3 pt-2">
                {[
                  ...(totalStudents === 0 ? [{
                    title: 'Sem alunos vinculados',
                    desc: 'Solicite ao administrador a vinculação de alunos às suas turmas.',
                    action: 'Ver Turmas', icon: Users, color: 'text-amber-600',
                  }] : []),
                  ...(totalActivities === 0 ? [{
                    title: 'Nenhuma atividade criada',
                    desc: 'Crie sua primeira atividade — manualmente ou com IA.',
                    action: 'Criar Atividade', icon: Zap, color: 'text-indigo-600',
                  }] : []),
                  ...(totalActivities > 0 && totalStudents > 0 ? [{
                    title: `${(activities.filter((a: any) => a.aiAssisted).length)} atividades com IA`,
                    desc: `${Math.round((activities.filter((a: any) => a.aiAssisted).length / totalActivities) * 100)}% das suas atividades foram geradas com IA.`,
                    action: 'Criar com IA', icon: Brain, color: 'text-primary-600',
                  }] : []),
                  ...(performanceBands.warning + performanceBands.danger > 0 ? [{
                    title: `${performanceBands.warning + performanceBands.danger} aluno(s) precisam de atenção`,
                    desc: 'Alunos com desempenho abaixo de 70%. Considere atividades de reforço.',
                    action: 'Ver Alunos', icon: AlertCircle, color: 'text-amber-600',
                  }] : []),
                ].slice(0, 4).map((ins, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-[1.2rem] border border-slate-100 hover:border-special-200 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <ins.icon size={14} className={ins.color} />
                      <h4 className="text-sm font-black text-slate-800">{ins.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">{ins.desc}</p>
                    <button 
                      onClick={() => {
                        if (ins.action === 'Ver Turmas') navigate('/teacher/classes');
                        else if (ins.action === 'Criar Atividade') navigate('/teacher/create-activity');
                        else if (ins.action === 'Criar com IA') navigate('/teacher/ai-generator');
                        else if (ins.action === 'Ver Alunos') navigate('/teacher/classes');
                      }}
                      className={cn("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity", ins.color)}
                    >
                      {ins.action} <ArrowUpRight size={12} />
                    </button>
                  </div>
                ))}

                {totalStudents > 0 && totalActivities > 0 && performanceBands.warning + performanceBands.danger === 0 && (
                  <div className="p-4 bg-emerald-50 rounded-[1.2rem] border border-emerald-100 text-center">
                    <Award size={24} className="mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-black text-emerald-700">Turmas em ótimo desempenho! 🎉</p>
                    <p className="text-xs text-emerald-600 mt-1">Todos os alunos estão acima de 70%.</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
