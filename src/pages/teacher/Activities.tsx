import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Search, BookOpen, Plus, Sparkles, Brain, Clock, ChevronRight,
  X, FileText, Target, CheckSquare, AlignLeft, Trash2, GraduationCap,
  Edit2, Eye, Save, Zap, Gamepad2, Check, TrendingUp, Star
} from 'lucide-react';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { StudentActivityResult } from '../../types/gamification';

// ─── Storage Helpers (from dedicated file to avoid Fast Refresh conflicts) ─────
import { saveActivityToStorage } from '../../lib/activityStorage';
// ─── Types ─────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  objetiva: 'Objetiva', dissertativa: 'Dissertativa', simulado: 'Simulado',
  prova_bimestral: 'Prova Bimestral', quiz_divertido: 'Quiz Divertido', prova_mensal: 'Prova Mensal',
};

const TYPE_COLORS: Record<string, string> = {
  objetiva: 'bg-blue-50 text-blue-700', dissertativa: 'bg-purple-50 text-purple-700',
  simulado: 'bg-orange-50 text-orange-700', prova_bimestral: 'bg-red-50 text-red-700',
  quiz_divertido: 'bg-pink-50 text-pink-700', prova_mensal: 'bg-cyan-50 text-cyan-700',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  objetiva: CheckSquare, dissertativa: AlignLeft, simulado: Target,
  prova_bimestral: FileText, quiz_divertido: Gamepad2, prova_mensal: FileText,
};

// ─── Schema ────────────────────────────────────────────────────────────────────
const activitySchema = z.object({
  title: z.string().min(3, 'Título obrigatório'),
  subject: z.string().min(1, 'Disciplina obrigatória'),
  type: z.enum(['objetiva', 'dissertativa', 'simulado', 'prova_bimestral', 'quiz_divertido', 'prova_mensal']),
  difficulty: z.enum(['Fácil', 'Médio', 'Difícil']),
  duration: z.string().min(1, 'Duração obrigatória'),
  classId: z.string().optional(),
  description: z.string().optional(),
});
type ActivityFormData = z.infer<typeof activitySchema>;

// ─── Activity Review Modal (Shared Logic) ───────────────────────────────────
export const ActivityReviewModal: React.FC<{
  result: StudentActivityResult;
  activity: any;
  onClose: () => void;
}> = ({ result, activity, onClose }) => {
  const score = result.score || 0;
  const isPassed = result.status === 'passed';
  const responses = result.responses || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className={cn("p-8 relative overflow-hidden flex-shrink-0 text-white", isPassed ? "bg-emerald-600" : "bg-red-600")}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl">
                {isPassed ? '🏆' : '🔴'}
              </div>
              <div>
                <h2 className="text-2xl font-black">{activity.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    Gabarito do Aluno
                  </span>
                  <span className="text-white/80 text-xs font-bold">• {result.completedAt ? new Date(result.completedAt).toLocaleDateString() : 'Sem data'}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black">{score}%</div>
              <div className="text-[9px] font-black uppercase tracking-widest opacity-60">Nota Final</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black">+{result.xpEarned}</div>
              <div className="text-[9px] font-black uppercase tracking-widest opacity-60">XP Ganhos</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black">{isPassed ? 'Passou' : 'Falhou'}</div>
              <div className="text-[9px] font-black uppercase tracking-widest opacity-60">Status</div>
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Check size={16} /> Histórico de Respostas
          </h3>

          {activity.questions?.map((q: any, idx: number) => {
            const response = responses.find(r => r.questionId === q.id);
            const isCorrect = response?.isCorrect;
            const selectedOptIdx = response?.selectedOptionId;

            return (
              <div key={q.id} className={cn("p-6 rounded-3xl border-2 transition-all",
                isCorrect === true ? "bg-emerald-50 border-emerald-100" :
                isCorrect === false ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
              )}>
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm",
                    isCorrect === true ? "bg-emerald-500 text-white" :
                    isCorrect === false ? "bg-red-500 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    {idx + 1}
                  </div>
                  <p className="text-sm font-black text-slate-800 leading-relaxed pt-1.5">{q.text}</p>
                </div>

                {q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                    {q.options.map((opt: string, optIdx: number) => {
                      const isSelected = String(optIdx) === selectedOptIdx;
                      const isCorrectAnswer = String(optIdx) === q.answer;

                      return (
                        <div key={optIdx} className={cn("relative p-3 rounded-2xl text-xs font-bold border-2 transition-all flex items-center gap-3",
                          isCorrectAnswer ? "bg-emerald-100 border-emerald-300 text-emerald-800" :
                          isSelected && !isCorrectAnswer ? "bg-red-100 border-red-300 text-red-800" :
                          "bg-white border-slate-100 text-slate-500"
                        )}>
                          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                            isCorrectAnswer ? "bg-emerald-500 text-white" :
                            isSelected ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400"
                          )}>
                            {LETTERS[optIdx]}
                          </div>
                          <span className="flex-1">{opt}</span>
                          {isSelected && <div className="absolute -top-2 -right-2 bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded-full">Marcada</div>}
                          {isCorrectAnswer && !isSelected && <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full">Correta</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === 'dissertativa' && (
                  <div className="pl-12 space-y-3">
                    <div className="bg-white/50 border border-slate-200 p-4 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Resposta do Aluno</div>
                      <p className="text-sm font-bold text-slate-700 italic text-center">"{response?.dissertativeAnswer || 'Sem resposta escrita.'}"</p>
                    </div>
                    {q.answer && (
                      <div className="bg-emerald-100/50 border border-emerald-200 p-4 rounded-2xl">
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 text-center">Gabarito Sugerido</div>
                        <p className="text-sm font-bold text-emerald-800 text-center">{q.answer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-sm hover:bg-slate-50 transition-all">
            Fechar Revisão
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Activity Progress Modal ────────────────────────────────────────────────
export const ActivityProgressModal: React.FC<{
  activity: any;
  classId: string;
  onClose: () => void;
}> = ({ activity, classId, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResult, setSelectedResult] = useState<StudentActivityResult | null>(null);

  // Load class and students directly from db.users using classId
  const cls = useLiveQuery(() => db.classes.get(classId), [classId]);
  const students = useLiveQuery(async () => {
    return db.users.where('classId').equals(classId)
      .filter(u => u.role === 'student')
      .toArray();
  }, [classId]) || [];

  // Load results for this activity
  const results = useLiveQuery(async () => {
    return db.studentActivityResults.where('activityId').equals(activity.id).toArray();
  }, [activity.id]) || [];

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">

        <div className="p-8 border-b border-slate-100 flex justify-between items-start flex-shrink-0 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                Acompanhamento Real-time
              </span>
              <span className="text-slate-400 font-bold text-xs">• {cls?.name}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800">{activity.title}</h2>
            <p className="text-sm text-slate-500 font-medium">Veja quem já completou e como foi o desempenho individual.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row gap-4 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-primary-500/20 focus:bg-white transition-all font-bold text-sm outline-none" />
          </div>
          <div className="flex gap-4">
             <div className="bg-slate-50 px-5 py-3.5 rounded-2xl flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concluído</span>
                <span className="text-lg font-black text-slate-800">{results.length} / {students.length}</span>
             </div>
             {results.length > 0 && (
               <div className="bg-primary-50 px-5 py-3.5 rounded-2xl flex flex-col items-center min-w-[100px]">
                  <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Média da Turma</span>
                  <span className="text-lg font-black text-primary-600">
                    {Math.round(results.reduce((acc, r) => {
                      const p = r.totalQuestions ? (r.score || 0) / r.totalQuestions * 100 : 0;
                      return acc + p;
                    }, 0) / results.length)}%
                  </span>
               </div>
             )}
             {results.length > 0 && (
               <div className="bg-orange-50 px-5 py-3.5 rounded-2xl flex flex-col items-center min-w-[100px]">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Tempo Médio</span>
                  <span className="text-lg font-black text-orange-600">
                    {(() => {
                      const totalTime = results.reduce((acc, r) => acc + (r.timeSpent || 0), 0);
                      const avg = Math.round(totalTime / (results.length || 1));
                      return avg >= 60 ? `${Math.floor(avg / 60)}m ${avg % 60}s` : `${avg}s`;
                    })()}
                  </span>
               </div>
             )}
             {results.length > 0 && (
               <div className="hidden lg:flex gap-2">
                 {results
                   .sort((a, b) => {
                     const pA = a.totalQuestions ? (a.score || 0) / a.totalQuestions : 0;
                     const pB = b.totalQuestions ? (b.score || 0) / b.totalQuestions : 0;
                     return pB - pA;
                   })
                   .slice(0, 3)
                   .map((r, i) => {
                     const stu = students.find(s => s.id === r.studentId);
                     if (!stu) return null;
                     return (
                       <div key={r.id} className="bg-emerald-50 px-4 py-2 rounded-2xl flex items-center gap-3 border border-emerald-100">
                         <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs">
                           {i + 1}º
                         </div>
                         <div>
                           <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">Destaque</div>
                           <div className="text-xs font-black text-emerald-700 truncate max-w-[80px]">{stu.name.split(' ')[0]}</div>
                         </div>
                       </div>
                     );
                   })}
               </div>
             )}
          </div>
          
          <div className="px-8 pb-4">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 transition-all duration-1000" 
                style={{ width: `${(results.length / (students.length || 1)) * 100}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Aluno</th>
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Status</th>
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Desempenho</th>
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Duração</th>
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Concluído em</th>
                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const result = results.find(r => r.studentId === student.id);
                const status = result ? (result.status === 'passed' ? 'passou' : 'falhou') : 'pendente';

                return (
                  <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 overflow-hidden">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          {result && results
                            .sort((a, b) => {
                              const pA = a.totalQuestions ? (a.score || 0) / a.totalQuestions : 0;
                              const pB = b.totalQuestions ? (b.score || 0) / b.totalQuestions : 0;
                              return pB - pA;
                            })
                            .slice(0, 3)
                            .some(r => r.studentId === student.id) && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                              <Star size={10} fill="white" stroke="white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                            {student.name}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className={cn('px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-widest inline-block min-w-[100px]',
                        status === 'passou' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                        status === 'falhou' ? 'text-red-700 bg-red-50 border-red-100' :
                        result?.status === 'given_up' ? 'text-orange-700 bg-orange-50 border-orange-100' :
                        'text-slate-500 bg-slate-50 border-slate-100'
                      )}>
                        {status === 'passou' ? '✅ Finalizada' : 
                         status === 'falhou' ? '❌ Falhou' : 
                         result?.status === 'given_up' ? '⏸️ Desistiu' :
                         '⏳ Pendente'}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      {result ? (
                         <div className="flex flex-col items-center gap-1.5">
                            {(() => {
                               const percent = result.totalQuestions ? Math.round((result.score || 0) / result.totalQuestions * 100) : 0;
                               return (
                                 <>
                                   <span className="font-black text-slate-800">{percent}%</span>
                                   <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={cn("h-full rounded-full transition-all", percent >= 70 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${percent}%` }} />
                                   </div>
                                 </>
                               );
                             })()}
                         </div>
                      ) : <span className="text-xs font-bold text-slate-300">—</span>}
                    </td>
                    <td className="p-6 text-center">
                      {result?.timeSpent ? (
                        <div className="flex flex-col items-center">
                          <span className="font-black text-slate-700 text-sm">
                            {result.timeSpent >= 60 
                              ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s` 
                              : `${result.timeSpent}s`}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tempo Total</span>
                        </div>
                      ) : <span className="text-xs font-bold text-slate-300">—</span>}
                    </td>
                    <td className="p-6 text-center">
                       {result?.completedAt ? (
                         <div className="flex flex-col items-center">
                           <span className="text-xs font-black text-slate-700">{new Date(result.completedAt).toLocaleDateString()}</span>
                           <span className="text-[10px] font-bold text-slate-400">{new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                       ) : <span className="text-[10px] font-black text-slate-300 uppercase italic">Não concluído</span>}
                    </td>
                    <td className="p-6 text-right">
                      {result ? (
                        <button
                          onClick={() => setSelectedResult(result)}
                          className="p-2.5 text-primary-500 hover:bg-primary-50 rounded-xl transition-all font-black text-xs flex items-center gap-2 ml-auto"
                        >
                          <Eye size={14} /> Detalhes
                        </button>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase italic">Aguardando...</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-20">
              <p className="text-slate-400 font-bold">Nenhum aluno encontrado.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-8 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 font-black text-sm hover:border-slate-300 transition-all">
            Fechar
          </button>
        </div>

        <AnimatePresence>
          {selectedResult && (
            <ActivityReviewModal
              result={selectedResult}
              activity={activity}
              onClose={() => setSelectedResult(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
const LETTERS = ['A', 'B', 'C', 'D'];

interface Question { id: string; text: string; type: 'objetiva' | 'dissertativa'; options?: string[]; answer?: string; }

const QuizQuestionCard: React.FC<{ q: Question; idx: number; onEdit: () => void; onDelete: () => void }> = ({ q, idx, onEdit, onDelete }) => (
  <div className="relative bg-gradient-to-br from-pink-50 to-violet-50 border-2 border-pink-100 rounded-2xl p-5 group">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 bg-pink-500 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-md">{idx + 1}</span>
        <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest">🎮 Quiz</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 text-pink-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors" title="Editar"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 text-pink-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={13} /></button>
      </div>
    </div>
    <p className="text-sm font-black text-slate-800 mb-3">{q.text}</p>
    {q.options && (
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt, j) => (
          <div key={j} className={cn('text-xs font-bold px-3 py-2.5 rounded-xl flex items-center gap-2',
            String(j) === q.answer ? 'bg-green-500 text-white shadow-md' : 'bg-white text-slate-600 border border-pink-100')}>
            <span className={cn('w-4 h-4 rounded-lg flex items-center justify-center text-[8px] font-black flex-shrink-0',
              String(j) === q.answer ? 'bg-white/20' : 'bg-pink-100 text-pink-500')}>
              {LETTERS[j]}
            </span>
            <span className="line-clamp-2">{opt}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OjetivaQuestionCard: React.FC<{ q: Question; idx: number; onEdit: () => void; onDelete: () => void }> = ({ q, idx, onEdit, onDelete }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors group">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow">{idx + 1}</span>
        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Objetiva</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
    <p className="text-sm font-bold text-slate-700 leading-relaxed mb-3">{q.text}</p>
    {q.options && (
      <div className="space-y-1.5">
        {q.options.map((opt, j) => (
          <div key={j} className={cn('text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2',
            String(j) === q.answer ? 'bg-green-50 text-green-700 font-bold border border-green-100' : 'bg-slate-50 text-slate-500')}>
            <span className={cn('w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0',
              String(j) === q.answer ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500')}>
              {LETTERS[j]}
            </span>
            {opt}
          </div>
        ))}
      </div>
    )}
  </div>
);

const DissertativaQuestionCard: React.FC<{ q: Question; idx: number; onEdit: () => void; onDelete: () => void }> = ({ q, idx, onEdit, onDelete }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-purple-100 transition-colors group">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 bg-violet-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow">{idx + 1}</span>
        <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Dissertativa</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
    <p className="text-sm font-bold text-slate-700 leading-relaxed mb-3">{q.text}</p>
    <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
      <div className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">Resposta Esperada</div>
      <p className="text-xs text-violet-700 font-medium">{q.answer || 'Nenhum gabarito definido.'}</p>
    </div>
  </div>
);

const InlineQuestionEditor: React.FC<{
  q: Question; idx: number; onSave: (updated: Question) => void; onCancel: () => void;
}> = ({ q, idx, onSave, onCancel }) => {
  const [text, setText] = useState(q.text);
  const [type, setType] = useState<'objetiva' | 'dissertativa'>(q.type);
  const [options, setOptions] = useState<string[]>(q.options?.length === 4 ? q.options : ['', '', '', '']);
  const [answer, setAnswer] = useState(q.answer || '0');
  const [dissAnswer, setDissAnswer] = useState(q.answer || '');

  const save = () => {
    if (!text.trim()) { toast.error('O enunciado não pode ser vazio.'); return; }
    onSave({ ...q, text: text.trim(), type, options: type === 'objetiva' ? options.map(o => o.trim()) : undefined, answer: type === 'objetiva' ? answer : dissAnswer.trim() });
    toast.success('Questão salva!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-indigo-600">✏️ Editando Q{idx + 1}</span>
        <button onClick={onCancel} className="p-1 hover:bg-white rounded-lg text-slate-400"><X size={14} /></button>
      </div>
      {/* Type toggle */}
      <div className="flex bg-white p-1 rounded-xl gap-1">
        {(['objetiva', 'dissertativa'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={cn('flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              type === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-700')}>
            {t === 'objetiva' ? '📝 Objetiva' : '✍️ Dissertativa'}
          </button>
        ))}
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Enunciado</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
      </div>
      {type === 'objetiva' && (
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alternativas (clique na letra para marcar correta)</label>
          {options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <button onClick={() => setAnswer(String(j))}
                className={cn('w-7 h-7 rounded-lg text-[10px] font-black transition-all flex-shrink-0',
                  String(j) === answer ? 'bg-green-500 text-white shadow' : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-green-400')}>
                {LETTERS[j]}
              </button>
              <input value={opt} onChange={e => { const n=[...options]; n[j]=e.target.value; setOptions(n); }}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={`Alternativa ${LETTERS[j]}`} />
            </div>
          ))}
        </div>
      )}
      {type === 'dissertativa' && (
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Gabarito / Resposta Esperada</label>
          <textarea value={dissAnswer} onChange={e => setDissAnswer(e.target.value)} rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Descreva a resposta esperada..." />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
        <button onClick={save} className="flex-1 py-2.5 bg-indigo-600 text-white font-black text-sm rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
          <Check size={14} /> Salvar
        </button>
      </div>
    </motion.div>
  );
};

const AddQuestionInlinePanel: React.FC<{ defaultType: 'objetiva' | 'dissertativa'; onAdd: (q: Question) => void; onCancel: () => void }> = ({ defaultType, onAdd, onCancel }) => {
  const [type, setType] = useState<'objetiva' | 'dissertativa'>(defaultType);
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('0');
  const [dissAnswer, setDissAnswer] = useState('');

  const doAdd = () => {
    if (!text.trim()) { toast.error('Escreva o enunciado.'); return; }
    if (type === 'objetiva' && options.some(o => !o.trim())) { toast.error('Preencha todas as alternativas.'); return; }
    onAdd({ id: crypto.randomUUID(), type, text: text.trim(), options: type === 'objetiva' ? options.map(o => o.trim()) : undefined, answer: type === 'objetiva' ? answer : dissAnswer.trim() });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border-2 border-primary-500/30 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-primary-400">➕ Nova Questão</span>
        <button onClick={onCancel} className="p-1 text-slate-400 hover:text-white rounded-lg"><X size={14} /></button>
      </div>
      <div className="flex bg-white/10 p-1 rounded-xl gap-1">
        {(['objetiva', 'dissertativa'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={cn('flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              type === t ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-white')}>
            {t === 'objetiva' ? '📝 Objetiva' : '✍️ Dissertativa'}
          </button>
        ))}
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Enunciado</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-primary-400 resize-none placeholder:text-slate-500"
          placeholder="Escreva a pergunta..." />
      </div>
      {type === 'objetiva' && (
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alternativas</label>
          {options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <button onClick={() => setAnswer(String(j))}
                className={cn('w-7 h-7 rounded-lg text-[10px] font-black flex-shrink-0 transition-all',
                  String(j) === answer ? 'bg-green-500 text-white shadow' : 'bg-white/10 text-slate-400 hover:bg-green-500/20')}>
                {LETTERS[j]}
              </button>
              <input value={opt} onChange={e => { const n=[...options]; n[j]=e.target.value; setOptions(n); }}
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                placeholder={`Alternativa ${LETTERS[j]}`} />
            </div>
          ))}
        </div>
      )}
      {type === 'dissertativa' && (
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Gabarito (opcional)</label>
          <textarea value={dissAnswer} onChange={e => setDissAnswer(e.target.value)} rows={2}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-slate-500 resize-none"
            placeholder="Resposta esperada..." />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-white/5 text-slate-400 font-bold text-sm rounded-xl hover:bg-white/10 transition-all">Cancelar</button>
        <button onClick={doAdd} className="flex-1 py-2.5 bg-primary-500 text-white font-black text-sm rounded-xl hover:bg-primary-400 transition-all flex items-center justify-center gap-2">
          <Plus size={14} /> Adicionar
        </button>
      </div>
    </motion.div>
  );
};

// ─── Activity View Modal (Full CRUD) ─────────────────────────────────────────
const ActivityViewModal: React.FC<{ activity: any; onClose: () => void; onEdit: () => void; onExternalSave?: (updated: any) => void }> = ({ activity, onClose, onEdit, onExternalSave }) => {
  const TypeIcon = TYPE_ICON[activity.type] || FileText;
  const isQuiz = activity.type === 'quiz_divertido';
  const isDisser = activity.type === 'dissertativa';
  const defaultQType: 'objetiva' | 'dissertativa' = isDisser ? 'dissertativa' : 'objetiva';

  const [questions, setQuestions] = useState<Question[]>(activity.questions || []);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [duration, setDuration] = useState(activity.duration || '45 min');
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // DURATION is now numeric (minutes)

  const persistChanges = async (qs: Question[], dur: string) => {
    try {
      await db.activities.update(activity.id, { questions: qs, duration: dur });
      if (onExternalSave) onExternalSave({ ...activity, questions: qs, duration: dur });
      setHasUnsaved(false);
      toast.success('Atividade atualizada!');
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Erro ao atualizar atividade.');
    }
  };

  const updateQ = (idx: number, q: Question) => {
    const next = questions.map((old, i) => i === idx ? q : old);
    setQuestions(next);
    setEditingIdx(null);
    setHasUnsaved(true);
  };

  const deleteQ = (idx: number) => {
    const next = questions.filter((_, i) => i !== idx);
    setQuestions(next);
    if (editingIdx === idx) setEditingIdx(null);
    setHasUnsaved(true);
    toast.success('Questão removida.');
  };

  const addQ = (q: Question) => {
    const next = [...questions, q];
    setQuestions(next);
    setShowAdd(false);
    setHasUnsaved(true);
    toast.success('Questão adicionada!');
  };

  const saveDuration = () => {
    setEditingDuration(false);
    setHasUnsaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg',
              isQuiz ? 'bg-gradient-to-br from-pink-500 to-violet-600' : isDisser ? 'bg-gradient-to-br from-violet-500 to-purple-700' : 'bg-gradient-to-br from-primary-500 to-special-500')}>
              <TypeIcon size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">{activity.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider', TYPE_COLORS[activity.type] || 'bg-slate-50 text-slate-600')}>
                  {TYPE_LABELS[activity.type] || activity.type}
                </span>
                {activity.subject && <span className="text-[10px] font-black uppercase text-primary-600 tracking-widest">{activity.subject}</span>}
                {activity.aiAssisted && <Badge variant="ai" className="px-2 py-0.5 text-[8px]">IA</Badge>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"><X size={20} /></button>
        </div>

        {/* ── Scrollable Content ──────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Meta: difficulty + duration (editable) + count */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="text-base font-black text-slate-800">{activity.difficulty || '—'}</div>
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Dificuldade</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-center relative group cursor-pointer" onClick={() => setEditingDuration(true)}>
              {editingDuration ? (
                <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={duration === 'Sem limite' ? '' : duration.replace(/\D/g, '')}
                    onChange={e => setDuration(e.target.value ? `${e.target.value} min` : 'Sem limite')}
                    autoFocus
                    placeholder="Minutos"
                    className="w-20 bg-white border border-indigo-300 rounded-xl text-xs font-black text-slate-700 outline-none px-2 py-1.5 text-center"
                    onBlur={saveDuration}
                  />
                  <button onClick={saveDuration} className="text-xs text-indigo-500 font-black">✓</button>
                </div>
              ) : (
                <>
                  <div className="text-base font-black text-slate-800">{duration || '—'}</div>
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Duração</div>
                  <Edit2 size={10} className="absolute top-2 right-2 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="text-base font-black text-slate-800">{questions.length}</div>
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Questões</div>
            </div>
          </div>

          {activity.description && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-1">Descrição</div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{activity.description}</p>
            </div>
          )}

          {/* Questions section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                {isQuiz ? '🎮' : isDisser ? '✍️' : '📝'} Questões
                <span className="text-slate-400 font-bold text-xs normal-case tracking-normal">({questions.length})</span>
              </h3>
              {hasUnsaved && (
                <button onClick={() => persistChanges(questions, duration)}
                  className="flex items-center gap-1.5 text-xs font-black bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all shadow">
                  <Save size={13} /> Salvar Alterações
                </button>
              )}
            </div>

            {/* Render questions by type */}
            <div className="space-y-3">
              <AnimatePresence>
                {questions.map((q, i) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                    {editingIdx === i ? (
                      <InlineQuestionEditor q={q} idx={i}
                        onSave={updated => updateQ(i, updated)}
                        onCancel={() => setEditingIdx(null)} />
                    ) : isQuiz ? (
                      <QuizQuestionCard q={q} idx={i}
                        onEdit={() => { setEditingIdx(i); setShowAdd(false); }}
                        onDelete={() => deleteQ(i)} />
                    ) : isDisser ? (
                      <DissertativaQuestionCard q={q} idx={i}
                        onEdit={() => { setEditingIdx(i); setShowAdd(false); }}
                        onDelete={() => deleteQ(i)} />
                    ) : (
                      <OjetivaQuestionCard q={q} idx={i}
                        onEdit={() => { setEditingIdx(i); setShowAdd(false); }}
                        onDelete={() => deleteQ(i)} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {questions.length === 0 && !showAdd && (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                  <FileText size={28} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400 font-medium">Nenhuma questão ainda. Adicione abaixo.</p>
                </div>
              )}

              <AnimatePresence>
                {showAdd && (
                  <AddQuestionInlinePanel defaultType={defaultQType}
                    onAdd={addQ} onCancel={() => setShowAdd(false)} />
                )}
              </AnimatePresence>

              {!showAdd && (
                <button onClick={() => { setShowAdd(true); setEditingIdx(null); }}
                  className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-primary-400 text-slate-400 hover:text-primary-500 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> Adicionar Questão
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Fechar</Button>
          {hasUnsaved ? (
            <Button variant="primary" onClick={() => persistChanges(questions, duration)} className="flex-1 rounded-xl py-3 gap-2 bg-green-500 hover:bg-green-600">
              <Save size={15} /> Salvar Alterações
            </Button>
          ) : (
            <Button variant="primary" onClick={onEdit} className="flex-1 rounded-xl py-3 gap-2">
              <Edit2 size={15} /> Editar Metadados
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Activity Edit Modal ────────────────────────────────────────────────────────
const ActivityEditModal: React.FC<{
  activity: any;
  classOptions: any[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ activity, classOptions, onClose, onSaved }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema) as any,
    defaultValues: {
      title: activity.title,
      subject: activity.subject,
      type: activity.type,
      difficulty: activity.difficulty || 'Médio',
      duration: activity.duration || '45 min',
      classId: activity.classId || '',
      description: activity.description || '',
    },
  });

  const SUBJECTS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação Física'];

  const onSubmit = async (data: ActivityFormData) => {
    try {
      await db.activities.update(activity.id, { ...data, updatedAt: new Date().toISOString() });
      toast.success(`"${data.title}" atualizada!`);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Erro ao salvar alterações.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-7 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-[2rem]">
          <div>
            <h2 className="text-xl font-black text-slate-800">Editar Atividade</h2>
            <p className="text-sm text-slate-400 font-medium">Atualize as informações da atividade</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-7 space-y-5">
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Título</label>
            <input {...register('title')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Disciplina</label>
              <select {...register('subject')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="">— Escolha —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Tipo</label>
              <select {...register('type')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="objetiva">📝 Objetiva</option>
                <option value="dissertativa">✍️ Dissertativa</option>
                <option value="simulado">🎯 Simulado</option>
                <option value="quiz_divertido">🎮 Quiz Divertido</option>
                <option value="prova_mensal">📅 Prova Mensal</option>
                <option value="prova_bimestral">📋 Prova Bimestral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Dificuldade</label>
              <select {...register('difficulty')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="Fácil">🟢 Fácil</option>
                <option value="Médio">🟡 Médio</option>
                <option value="Difícil">🔴 Difícil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 font-black">Duração (minutos)</label>
              <input 
                type="number" 
                {...register('duration')} 
                placeholder="Ex: 45"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 transition-all" 
              />
            </div>
          </div>

          {classOptions.length > 0 && (
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1">
                <GraduationCap size={12} /> Turma Destinatária
              </label>
              <select {...register('classId')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="">— Todas as turmas —</option>
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Descrição / Instruções</label>
            <textarea {...register('description')} rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Descreva o objetivo pedagógico desta atividade..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-1 rounded-xl py-3 gap-2 shadow-indigo-200 shadow">
              <Save size={15} /> {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Create Activity Modal ──────────────────────────────────────────────────────
const CreateActivityModal: React.FC<{
  teacherId: string;
  classIds: string[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ teacherId, classIds, onClose, onCreated }) => {
  const classes = useLiveQuery(async () => {
    const all = await db.classes.toArray();
    return all.filter(c => classIds.includes(c.id));
  }, [classIds.join(',')]) || [];

  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema) as any,
    defaultValues: { type: 'objetiva', difficulty: 'Médio', duration: '45 min' }
  });

  const onSubmit = async (data: ActivityFormData) => {
    const now = new Date().toISOString();
    const newActivity = {
      id: crypto.randomUUID(), ...data, questions: [], aiAssisted: false,
      teacherId, createdAt: now,
    };
    await saveActivityToStorage(newActivity);
    toast.success(`Atividade "${data.title}" criada!`);
    onCreated();
    onClose();
  };

  const SUBJECTS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação Física'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="p-7 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-[2rem]">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Nova Atividade</h2>
            <p className="text-sm text-slate-400 font-medium">Crie manualmente ou use a IA para gerar</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        {/* Quick IA shortcut */}
        <div className="p-5 border-b border-slate-50 bg-gradient-to-r from-indigo-50 to-violet-50">
          <button
            onClick={() => { onClose(); navigate('/teacher/create-activity'); }}
            className="w-full flex items-center gap-3 p-4 bg-white border-2 border-indigo-100 rounded-2xl hover:border-indigo-300 transition-all group">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-all">
              <Sparkles size={18} />
            </div>
            <div className="text-left">
              <div className="font-black text-slate-800 text-sm">Criar com IA ✨</div>
              <div className="text-xs text-slate-400">Gere questões automaticamente com inteligência artificial</div>
            </div>
            <ChevronRight size={18} className="ml-auto text-slate-300 group-hover:text-indigo-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-7 space-y-5">
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Título da Atividade</label>
            <input {...register('title')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              placeholder="Ex: Revisão de Frações — 5º Ano" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Disciplina</label>
              <select {...register('subject')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="">— Escolha —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Tipo</label>
              <select {...register('type')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="objetiva">📝 Objetiva</option>
                <option value="dissertativa">✍️ Dissertativa</option>
                <option value="simulado">🎯 Simulado</option>
                <option value="quiz_divertido">🎮 Quiz Divertido</option>
                <option value="prova_bimestral">📋 Prova Bimestral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Dificuldade</label>
              <select {...register('difficulty')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="Fácil">🟢 Fácil</option>
                <option value="Médio">🟡 Médio</option>
                <option value="Difícil">🔴 Difícil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 font-black">Duração (minutos)</label>
              <input 
                type="number" 
                {...register('duration')} 
                placeholder="Ex: 45"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 transition-all" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1">
              <GraduationCap size={12} /> Turma Destinatária
            </label>
            <select {...register('classId')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
              <option value="">— Todas as turmas —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Descrição / Instruções (opcional)</label>
            <textarea {...register('description')} rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Descreva o objetivo pedagógico desta atividade..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Cancelar</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-1 rounded-xl py-3 shadow-indigo-200 shadow">
              {isSubmitting ? 'Criando...' : 'Criar Atividade'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const Activities: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewActivity, setViewActivity] = useState<any | null>(null);
  const [editActivity, setEditActivity] = useState<any | null>(null);
  const [progressActivity, setProgressActivity] = useState<any | null>(null);

  const allActivities = useLiveQuery(() => db.activities.toArray()) || [];
  const myActivities = allActivities.filter((a: any) => !a.teacherId || a.teacherId === user?.id);

  const handleCreated = () => { /* useLiveQuery handles it */ };

  const teacherUser = useLiveQuery(async () => {
    if (!user) return null;
    return db.users.get(user.id);
  }, [user?.id]);

  const classIds: string[] = (teacherUser as any)?.classIds || [];
  const classes = useLiveQuery(async () => {
    const all = await db.classes.toArray();
    return all.filter(c => classIds.includes(c.id));
  }, [classIds.join(',')]) || [];

  const filtered = myActivities.filter((a: any) => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesClass = filterClass === 'all' || a.classId === filterClass;
    const matchesSearch =
      (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.subject || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesClass && matchesSearch;
  });

  const handleDelete = async (id: string) => {
    await db.activities.delete(id);
    toast.success('Atividade removida.');
  };

  const TYPE_TABS = [
    { key: 'all', label: 'Todas' },
    { key: 'objetiva', label: 'Objetivas' },
    { key: 'dissertativa', label: 'Dissertativas' },
    { key: 'simulado', label: 'Simulados' },
    { key: 'quiz_divertido', label: 'Quiz' },
    { key: 'prova_bimestral', label: 'Provas Bimestrais' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Banco de Atividades</h1>
          <p className="text-slate-500 font-medium">
            {myActivities.length} atividade{myActivities.length !== 1 ? 's' : ''} criada{myActivities.length !== 1 ? 's' : ''}. Explore, crie e gerencie para suas turmas.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate('/teacher/create-activity')}
            variant="outline"
            className="rounded-2xl gap-2 font-bold px-5 bg-white border-slate-200">
            <Sparkles size={18} className="text-indigo-500" /> Criar com IA
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="rounded-2xl gap-2 font-black px-8 shadow-xl shadow-primary-500/20">
            <Plus size={20} /> Nova Atividade
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Buscar por título, matéria ou conteúdo..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-[1.5rem] py-4 pl-14 pr-4 text-sm font-bold focus:border-primary-500/20 outline-none transition-all shadow-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            {TYPE_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setFilterType(key)}
                className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  filterType === key ? 'bg-white text-slate-800 shadow border border-slate-200' : 'text-slate-400 hover:text-slate-600')}>
                {label}
              </button>
            ))}
          </div>
          {classes.length > 0 && (
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer">
              <option value="all">🏫 Todas as turmas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Activities Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border-4 border-dashed border-slate-100 rounded-[3rem]">
          <BookOpen size={48} className="mx-auto mb-4 text-slate-200" />
          <h3 className="text-xl font-black text-slate-800">
            {myActivities.length === 0 ? 'Nenhuma atividade criada ainda' : 'Nenhum resultado'}
          </h3>
          <p className="text-slate-400 mt-2 mb-6">
            {myActivities.length === 0 ? 'Crie sua primeira atividade manualmente ou use nossa IA.' : 'Tente ajustar os filtros de busca.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/teacher/create-activity')} variant="outline" className="rounded-2xl gap-2 font-bold">
              <Sparkles size={18} /> Criar com IA
            </Button>
            <Button onClick={() => setIsModalOpen(true)} variant="primary" className="rounded-2xl gap-2 font-bold">
              <Plus size={18} /> Nova Atividade
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((act: any) => {
            const TypeIcon = TYPE_ICON[act.type] || FileText;
            return (
              <Card key={act.id} className="p-0 overflow-hidden border-slate-100 group hover:border-primary-100 hover:shadow-xl transition-all duration-500">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-44 bg-slate-50 p-8 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-100 relative group-hover:bg-indigo-50 transition-colors flex-shrink-0">
                    {act.aiAssisted && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="ai" className="px-2 py-0.5 text-[8px]">IA</Badge>
                      </div>
                    )}
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover:text-indigo-400 group-hover:scale-110 transition-all">
                      <TypeIcon size={36} />
                    </div>
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider', TYPE_COLORS[act.type] || 'bg-slate-50 text-slate-600')}>
                        {TYPE_LABELS[act.type] || act.type}
                      </span>
                      {act.subject && <span className="text-[10px] font-black uppercase text-primary-600 tracking-widest">{act.subject}</span>}
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">{act.title}</h3>

                    {act.description && (
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{act.description}</p>
                    )}

                    <div className="flex gap-3 mb-4 flex-wrap">
                      {act.duration && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <Clock size={13} /> {act.duration}
                        </div>
                      )}
                      {act.difficulty && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <Brain size={13} /> {act.difficulty}
                        </div>
                      )}
                      {act.questions?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <Zap size={13} /> {act.questions.length} questões
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleDelete(act.id)}
                          className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={() => setEditActivity(act)}
                          className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => setViewActivity(act)}
                        className="flex items-center gap-1.5 text-xs font-black text-slate-400 bg-slate-50 hover:bg-primary-500 hover:text-white px-4 py-2 rounded-xl transition-all group-hover:bg-primary-500 group-hover:text-white"
                      >
                        <Eye size={14} /> Ver questões
                      </button>
                      {act.classId && (
                        <button
                          onClick={() => setProgressActivity(act)}
                          className="flex items-center gap-1.5 text-xs font-black text-primary-500 bg-primary-50 hover:bg-primary-500 hover:text-white px-4 py-2 rounded-xl transition-all"
                        >
                          <TrendingUp size={14} /> Acompanhar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Banner */}
      <Card className="p-10 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-primary-500 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-primary-500/20 shrink-0">
            <Sparkles size={40} className="text-white" />
          </div>
          <div className="space-y-3 text-center md:text-left">
            <h2 className="text-2xl font-black tracking-tight">Crie atividades em segundos com IA</h2>
            <p className="text-slate-400 font-medium max-w-2xl">
              Descreva o tema e nossa IA gera questões objetivas, dissertativas, simulados ou provas bimestrais — alinhadas à BNCC.
            </p>
          </div>
          <Button onClick={() => navigate('/teacher/create-activity')}
            className="shrink-0 bg-white text-slate-900 hover:bg-slate-50 rounded-2xl px-8 py-5 font-black text-sm">
            <Sparkles size={18} className="mr-2 text-indigo-500" /> Experimentar Gerador
          </Button>
        </div>
      </Card>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <CreateActivityModal teacherId={user?.id || ''} classIds={classIds}
            onClose={() => setIsModalOpen(false)} onCreated={handleCreated} />
        )}
        {viewActivity && (
          <ActivityViewModal activity={viewActivity}
            onClose={() => setViewActivity(null)}
            onEdit={() => { setEditActivity(viewActivity); setViewActivity(null); }} />
        )}
        {editActivity && (
          <ActivityEditModal activity={editActivity} classOptions={classes}
            onClose={() => setEditActivity(null)}
            onSaved={() => {}} />
        )}

        {progressActivity && (
          <ActivityProgressModal
            activity={progressActivity}
            classId={progressActivity.classId}
            onClose={() => setProgressActivity(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
