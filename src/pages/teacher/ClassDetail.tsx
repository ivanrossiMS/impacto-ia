import React, { useState } from 'react';
import {
  ArrowLeft, Search, User, MessageCircle, BarChart2,
  MoreHorizontal, Users, BookOpen,
  TrendingUp, Star, Zap, ChevronUp, ChevronDown,
  X, Mail, Eye, TrendingUp as TrendingUpIcon,
  CheckCircle2, AlertCircle, History
} from 'lucide-react';
import { ActivityProgressModal, ActivityReviewModal } from './Activities';
import type { StudentActivityResult } from '../../types/gamification';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

// ─── Helper ────────────────────────────────────────────────────────────────────
function getStudentStatus(score: number): 'excellent' | 'good' | 'warning' | 'danger' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}

const STATUS_CONFIG = {
  excellent: { label: '🏆 Excelente', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  good:      { label: '✨ Bom',       color: 'text-blue-700 bg-blue-50 border-blue-100' },
  warning:   { label: '⚡ Atenção',   color: 'text-amber-700 bg-amber-50 border-amber-100' },
  danger:    { label: '🔴 Risco',     color: 'text-red-700 bg-red-50 border-red-100' },
};

const SUBJECT_EMOJIS: Record<string, string> = {
  matematica: '📐', portugues: '📚', ciencias: '🧪', historia: '🏺',
  geografia: '🌍', ingles: '🗣️', artes: '🎨', ed_fisica: '⚽',
};

// ─── Student Profile Modal ──────────────────────────────────────────────────────
const StudentProfileModal: React.FC<{
  student: any;
  score: number;
  onClose: () => void;
  studentResults: StudentActivityResult[];
  allActivities: any[];
  onViewReview: (result: StudentActivityResult, activity: any) => void;
}> = ({ student, score, onClose, studentResults, allActivities, onViewReview }) => {
  const status = getStudentStatus(score);
  const cfg = STATUS_CONFIG[status];

  // Helper to get avatar
  const avatarUrl = student.avatarUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-20 h-20 rounded-[1.5rem] bg-slate-800 overflow-hidden border-2 border-white/10 flex items-center justify-center shadow-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-3xl font-black text-white/20">{student.name.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black">{student.name}</h2>
              <p className="text-slate-400 text-sm">{student.email}</p>
              <span className={cn('mt-2 inline-block px-3 py-1 rounded-xl border font-black text-[10px] uppercase tracking-widest', cfg.color)}>
                {cfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black text-slate-800">{score > 0 ? `${score}%` : '—'}</div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Desempenho</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black text-slate-800">{student.studentCode || '—'}</div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Código</div>
            </div>
          </div>

          {score > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Desempenho Geral</span>
                <span>{score}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={cn('h-full rounded-full',
                    score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                />
              </div>
            </div>
          )}

          {/* Activity History */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
               <History size={16} /> Histórico de Atividades
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
               {studentResults && studentResults.length > 0 ? (
                 studentResults.map((res: StudentActivityResult) => {
                   const act = allActivities.find(a => a.id === res.activityId);
                   const isPassed = res.status === 'passed';
                   return (
                     <div key={res.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between group/item">
                        <div className="flex items-center gap-3">
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm",
                             isPassed ? "bg-emerald-500" : "bg-red-500"
                           )}>
                              {isPassed ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                           </div>
                           <div>
                              <div className="text-sm font-black text-slate-800 line-clamp-1">{act?.title || 'Atividade Excluída'}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {res.totalQuestions ? Math.round((res.score || 0) / res.totalQuestions * 100) : 0}% • {res.completedAt ? new Date(res.completedAt).toLocaleDateString() : 'Sem data'}
                              </div>
                           </div>
                        </div>
                        <button
                          onClick={() => onViewReview(res, act)}
                          className="p-2 text-primary-500 hover:bg-primary-50 rounded-lg transition-all opacity-0 group-hover/item:opacity-100"
                        >
                           <Eye size={14} />
                        </button>
                     </div>
                   );
                 })
               ) : (
                 <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                    <p className="text-xs font-bold text-slate-400">Nenhuma atividade concluída.</p>
                 </div>
               )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { navigator.clipboard.writeText(student.email); toast.success('E-mail copiado!'); }}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl transition-all text-sm"
            >
              <Mail size={15} /> Copiar E-mail
            </button>
            <button
              onClick={() => { toast.info('Funcionalidade de mensagem em breve!'); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold py-3 rounded-2xl transition-all text-sm"
            >
              <MessageCircle size={15} /> Mensagem
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export const ClassDetail: React.FC = () => {
  const navigate = useNavigate();
  const { classId } = useParams<{ classId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'students' | 'activities' | 'overview'>('students');
  const [selectedStudent, setSelectedStudent] = useState<{ student: any; score: number } | null>(null);
  const [progressActivity, setProgressActivity] = useState<any | null>(null);
  const [reviewData, setReviewData] = useState<{ result: StudentActivityResult; activity: any } | null>(null);

  // ── Load auxiliary data ───────────────────────────────────────────────────
  const allResults = useLiveQuery(() => db.studentActivityResults.toArray()) || [];
  const allAvatarProfiles = useLiveQuery(() => db.studentAvatarProfiles.toArray()) || [];
  const allCatalogItems = useLiveQuery(() => db.avatarCatalog.toArray()) || [];
  const allActivities = useLiveQuery(() => db.activities.toArray()) || [];

  // ── Load real class from DB ────────────────────────────────────────────────
  const cls = useLiveQuery(async () => {
    if (!classId) return null;
    return db.classes.get(classId);
  }, [classId]);

  const teacher = useLiveQuery(async () => {
    if (!cls?.teacherId) return null;
    return db.users.get(cls.teacherId);
  }, [cls?.teacherId]);

  // ── Load real students linked to this class ────────────────────────────────
  const students = useLiveQuery(async () => {
    if (!cls) return [];
    return db.users
      .where('classId')
      .equals(cls.id)
      .and(u => u.role === 'student')
      .toArray();
  }, [cls?.id]) || [];

  // ── Load gamification stats for all students ───────────────────────────────
  const allStats = useLiveQuery(async () => {
    return db.gamificationStats.toArray();
  }, []) || [];

  // ── Load activities for this class from Dexie ──────────────────────
  const classActivities = React.useMemo(() => {
    return allActivities.filter((a: any) => !a.classId || a.classId === classId);
  }, [allActivities, classId]);

  // ── Calculate real score from gamificationStats ───────────────────────────
  const getStudentScore = (studentId: string): number => {
    const stat = allStats.find(s => s.id === studentId);
    if (!stat) return 0;
    // Normalize XP to 0-100 scale (every 100 XP = up to 100% cap)
    const xp = (stat as any).xp || (stat as any).totalXp || 0;
    const level = (stat as any).level || 1;
    // Score based on level (1-10 → 10–100%) and XP progress within level
    const baseScore = Math.min(level * 10, 90);
    return Math.min(Math.round(baseScore + (xp % 100) / 10), 100);
  };

  if (!cls) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Users size={40} className="text-slate-300" />
          </div>
          <p className="font-black text-slate-400 text-lg">Turma não encontrada</p>
          <button onClick={() => navigate('/teacher/classes')}
            className="font-bold text-primary-600 hover:underline text-sm flex items-center gap-1 mx-auto">
            <ArrowLeft size={14} /> Voltar para Gestão de Turmas
          </button>
        </div>
      </div>
    );
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalStudents = students.length;
  const fillPercent = totalStudents > 0 ? Math.min(100, Math.round((totalStudents / 30) * 100)) : 0;

  const studentScores = students.map(s => getStudentScore(s.id));
  const avgScore = studentScores.length > 0 && studentScores.some(s => s > 0)
    ? Math.round(studentScores.filter(s => s > 0).reduce((a, b) => a + b, 0) / studentScores.filter(s => s > 0).length)
    : 0;
  const excellentCount = students.filter((student) => getStudentStatus(getStudentScore(student.id)) === 'excellent').length;

  // ── Filtered + sorted student list ────────────────────────────────────────
  const filteredStudents = students
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const scoreA = getStudentScore(a.id);
      const scoreB = getStudentScore(b.id);
      return sortDir === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });

  const toggleSort = (col: 'name' | 'score') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/teacher/classes')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold text-xs bg-white border-2 border-slate-100 px-5 py-3 rounded-2xl shadow-sm transition-all hover:-translate-x-1">
          <ArrowLeft size={16} /> Gestão de Turmas
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/teacher/reports')}
            className="p-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-500 hover:text-primary-500 transition-all shadow-sm" title="Relatório">
            <BarChart2 size={20} />
          </button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl">
              {SUBJECT_EMOJIS[cls.subject as string] || '🎓'}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">{cls.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="bg-primary-500 text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                  {cls.grade}
                </span>
                {cls.year && (
                  <span className="bg-white/10 text-white/70 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-white/10">
                    {cls.year}
                  </span>
                )}
                <span className="text-slate-400 font-bold text-sm">• {totalStudents} aluno{totalStudents !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          {teacher && (
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <User size={13} className="text-primary-400" />
              Responsável: <strong className="text-white">{teacher.name}</strong>
            </p>
          )}
        </div>

        <div className="relative z-10 flex gap-4 w-full md:w-auto">
          {[
            { label: 'Alunos', val: totalStudents },
            { label: 'Atividades', val: classActivities.length },
            { label: '⭐ Excelentes', val: excellentCount },
          ].map((m, i) => (
            <div key={i} className="flex-1 md:w-28 bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-[1.5rem] text-center">
              <div className="text-2xl font-black text-white mb-1">{m.val}</div>
              <div className="text-[9px] font-black uppercase text-white/40 tracking-widest">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl w-fit">
        {([
          { id: 'students', label: '👥 Alunos' },
          { id: 'activities', label: '📝 Atividades' },
          { id: 'overview', label: '📊 Desempenho' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all',
              activeTab === tab.id ? 'bg-white text-slate-800 shadow-md' : 'text-slate-400 hover:text-slate-600'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── STUDENTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="bg-white border-2 border-slate-50 rounded-[3rem] overflow-hidden shadow-xl shadow-slate-200/40">
          <div className="p-8 border-b border-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800">Quadro de Alunos</h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                {totalStudents} aluno{totalStudents !== 1 ? 's' : ''} nesta turma
                {avgScore > 0 && <span className="ml-2 text-primary-500">• Média: {avgScore}%</span>}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar por nome..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full lg:w-72 pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-primary-500/20 focus:bg-white transition-all font-bold text-sm outline-none shadow-inner" />
              </div>
            </div>
          </div>

          {totalStudents === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Users size={32} />
              </div>
              <p className="font-black text-slate-400 text-lg">Nenhum aluno nesta turma</p>
              <p className="text-slate-300 text-sm mt-1 font-medium">O administrador ainda não vinculou alunos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                        Aluno {sortBy === 'name' ? (sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : null}
                      </button>
                    </th>
                    <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">
                      <button onClick={() => toggleSort('score')} className="flex items-center gap-1 mx-auto hover:text-slate-600 transition-colors">
                        Desempenho {sortBy === 'score' ? (sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : null}
                      </button>
                    </th>
                    <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Status</th>
                    <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const score = getStudentScore(student.id);
                    const status = score > 0 ? getStudentStatus(score) : 'warning';
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <motion.tr
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        key={student.id}
                        className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            {(() => {
                              const profile = allAvatarProfiles.find(p => p.studentId === student.id);
                              const avatarItem = allCatalogItems.find(item => item.id === profile?.selectedAvatarId);
                              const avatarUrl = avatarItem?.assetUrl;

                              return (
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border-2 border-slate-50 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={student.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-lg font-black text-slate-300">{student.name.charAt(0).toUpperCase()}</div>
                                  )}
                                </div>
                              );
                            })()}
                            <div>
                              <div className="font-black text-slate-800">{student.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          {score > 0 ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="font-black text-slate-800 text-lg">{score}%</span>
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all',
                                  score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                )} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-300">Sem dados</span>
                          )}
                        </td>
                        <td className="p-6 text-center">
                          <span className={cn('px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-widest', cfg.color)}>
                            {score > 0 ? cfg.label : '⏳ Aguardando'}
                          </span>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedStudent({ student, score })}
                              className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                              title="Ver Perfil">
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => { toast.info('Mensagem: em breve!'); }}
                              className="p-2.5 text-slate-400 hover:text-special-600 hover:bg-special-50 rounded-xl transition-all"
                              title="Enviar Mensagem">
                              <MessageCircle size={16} />
                            </button>
                            <button
                              onClick={() => { toast.info('Mais opções: em breve!'); }}
                              className="p-2.5 text-slate-400 hover:text-slate-800 rounded-xl transition-all">
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITIES TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800">Atividades da Turma</h2>
            <span className="text-sm font-bold text-slate-400">{classActivities.length} atividade{classActivities.length !== 1 ? 's' : ''}</span>
          </div>
          {classActivities.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="font-black text-slate-400">Nenhuma atividade criada para esta turma ainda.</p>
              <button
                onClick={() => navigate('/teacher/activities')}
                className="mt-4 bg-primary-500 text-white font-black px-6 py-3 rounded-2xl hover:bg-primary-600 transition-all text-sm flex items-center gap-2 mx-auto"
              >
                <Zap size={15} /> Criar Atividade
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {classActivities.map((act: any, i: number) => (
                <motion.div key={act.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-special-500 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
                      <Zap size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-slate-800 truncate">{act.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-primary-600 tracking-wider">{act.subject}</span>
                        {act.type && <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md">{act.type}</span>}
                        {act.difficulty && <span className="text-[10px] bg-indigo-50 text-indigo-500 font-bold px-1.5 py-0.5 rounded-md">{act.difficulty}</span>}
                      </div>
                      {act.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{act.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                    <button
                      onClick={() => setProgressActivity(act)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 py-2 rounded-xl transition-all"
                    >
                      <TrendingUpIcon size={13} /> Acompanhar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-slate-800">Visão Geral de Desempenho</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Total de Alunos', val: totalStudents, icon: Users, color: 'from-blue-500 to-indigo-500' },
              { label: 'Excelentes', val: excellentCount, icon: Star, color: 'from-emerald-400 to-teal-500' },
              { label: 'Ocupação', val: `${fillPercent}%`, icon: TrendingUp, color: 'from-violet-500 to-purple-600' },
              { label: 'Atividades', val: classActivities.length, icon: BookOpen, color: 'from-orange-400 to-rose-500' },
            ].map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
                className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-md">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white mb-4`}>
                  <m.icon size={22} />
                </div>
                <div className="text-3xl font-black text-slate-800">{m.val}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{m.label}</div>
              </motion.div>
            ))}
          </div>

          {totalStudents === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <Users size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="font-black text-slate-400">Nenhum aluno para analisar ainda.</p>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-50 shadow-md space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800">Distribuição de Desempenho</h3>
                {avgScore > 0 && (
                  <span className="text-xs font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl">
                    Média da turma: <span className="text-primary-600">{avgScore}%</span>
                  </span>
                )}
              </div>
              {(['excellent', 'good', 'warning', 'danger'] as const).map(status => {
                const count = students.filter((s) => {
                  const score = getStudentScore(s.id);
                  return score > 0 && getStudentStatus(score) === status;
                }).length;
                const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className={cn('text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border', cfg.color)}>{cfg.label}</span>
                      <span className="text-xs font-black text-slate-600">{count} aluno{count !== 1 ? 's' : ''} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2 }}
                        className={cn('h-full rounded-full',
                          status === 'excellent' ? 'bg-emerald-500' : status === 'good' ? 'bg-blue-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                        )} />
                    </div>
                  </div>
                );
              })}
              {students.filter(s => getStudentScore(s.id) === 0).length > 0 && (
                <p className="text-xs text-slate-400 font-medium pt-2 border-t border-slate-50">
                  ⏳ {students.filter(s => getStudentScore(s.id) === 0).length} aluno(s) sem atividade registrada ainda.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Student Profile Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentProfileModal
            student={{
              ...selectedStudent.student,
              avatarUrl: (() => {
                const profile = allAvatarProfiles.find(p => p.studentId === selectedStudent.student.id);
                const avatarItem = allCatalogItems.find(item => item.id === profile?.selectedAvatarId);
                return avatarItem?.assetUrl;
              })()
            }}
            score={selectedStudent.score}
            onClose={() => setSelectedStudent(null)}
            studentResults={allResults.filter(r => r.studentId === selectedStudent.student.id)}
            allActivities={allActivities}
            onViewReview={(result, activity) => setReviewData({ result, activity })}
          />
        )}
        {progressActivity && (
          <ActivityProgressModal
            activity={progressActivity}
            classId={classId!}
            onClose={() => setProgressActivity(null)}
          />
        )}
        {reviewData && (
          <ActivityReviewModal
            result={reviewData.result}
            activity={reviewData.activity}
            onClose={() => setReviewData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
