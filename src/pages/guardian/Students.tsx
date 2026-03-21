import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../types/user';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { User, Activity, Trophy, ChevronRight, BookOpen, Clock, Plus, Star, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { calculateLevel } from '../../lib/gamificationUtils';

const StudentInfo: React.FC<{ student: Student }> = ({ student }) => {
  const [stats, setStats] = useState<any>(null);
  const [schoolClass, setSchoolClass] = useState<any>(null);

  React.useEffect(() => {
    supabase.from('gamification_stats').select('*').eq('id', student.id).single().then(({ data }) => setStats(data));
    if (student.classId) {
      supabase.from('classes').select('*').eq('id', student.classId).single().then(({ data }) => setSchoolClass(data));
    }
  }, [student.id, student.classId]);

  return (
    <div>
      <h2 className="text-2xl font-black text-slate-800 leading-tight">{student.name}</h2>
      <div className="flex flex-col mt-2 gap-1 text-left">
        <div className="flex items-center gap-2">
           <Badge variant="primary" className="scale-90 origin-left">{student.grade}</Badge>
           <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Nível {stats ? calculateLevel(stats.xp) : 1}</span>
        </div>
        {schoolClass && (
           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
              Turma: {(schoolClass as any).name}
           </div>
        )}
      </div>
    </div>
  );
};

const StudentCardStats: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [stats, setStats] = useState<{ completedCount: number, bestSubjects: { subject: string, avg: number }[] } | null>(null);

  React.useEffect(() => {
    const fetchStats = async () => {
      const { data: results } = await supabase.from('student_activity_results').select('*').eq('studentId', studentId);
      const { data: activities } = await supabase.from('activities').select('*');
      
      if (!results || !activities) {
        setStats({ completedCount: 0, bestSubjects: [] });
        return;
      }

      // Group by subject and calculate average score
      const subjectStats: Record<string, { totalScore: number, count: number }> = {};
      results.forEach(res => {
        const act = activities.find(a => a.id === res.activityId);
        if (act) {
          const subject = act.subject || 'Geral';
          if (!subjectStats[subject]) subjectStats[subject] = { totalScore: 0, count: 0 };
          subjectStats[subject].totalScore += ((res.score || 0) / (res.totalQuestions || 1));
          subjectStats[subject].count += 1;
        }
      });

      const bestSubjects = Object.entries(subjectStats)
        .map(([subject, data]) => ({
          subject,
          avg: Math.round((data.totalScore / data.count) * 100)
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 2);

      setStats({ completedCount: results.length, bestSubjects });
    };
    fetchStats();
  }, [studentId]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-6 w-full">
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={14} className="text-primary-500" /> Atividade Recente
        </h4>
        <div className="space-y-4 text-left">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                <BookOpen size={16} />
             </div>
             <div>
                <div className="text-xs font-bold text-slate-800">{stats.completedCount}</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Lições Feitas</div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                <Clock size={16} />
             </div>
             <div>
                <div className="text-xs font-bold text-slate-800">Acompanhar</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Relatório</div>
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Trophy size={14} className="text-warning-500" /> Melhores Resultados
        </h4>
        <div className="space-y-3">
          {stats.bestSubjects.length > 0 ? stats.bestSubjects.map((mat, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-50 group-hover:border-primary-50 transition-colors">
               <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight">{mat.subject}</span>
               <span className="text-xs font-black text-success-600">{mat.avg}%</span>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center h-20 text-center gap-2">
              <span className="text-[9px] font-bold text-slate-400 italic">Sem dados suficientes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Students: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [studentCode, setStudentCode] = useState('');

  const [studentsData, setStudentsData] = useState<Student[]>([]);

  const fetchStudents = async () => {
    if (!user || user.role !== 'guardian') return;
    
    // Fetch Guardian data in case `user.studentIds` in store is stale
    const { data: liveG } = await supabase.from('users').select('*').eq('id', user.id).single();
    const sidList = liveG?.studentIds || [];

    let linkedByGuardian: any[] = [];
    if (sidList.length > 0) {
      const { data } = await supabase.from('users').select('*').in('id', sidList);
      linkedByGuardian = data || [];
    }

    // Usually guardianIds array field isn't natively queried well with .in() unless it's a JSON array. 
    // Usually 'cs' (contains) is used.
    const { data: linkedByStudent } = await supabase.from('users').select('*').contains('guardianIds', [user.id]);
    
    const all = [...linkedByGuardian, ...(linkedByStudent || [])];
    const uniqueIds = new Set();
    const sortedStudents = all.filter(s => {
      if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
      uniqueIds.add(s.id);
      return true;
    }) as Student[];
    setStudentsData(sortedStudents);
  };

  React.useEffect(() => {
     fetchStudents();
  }, [user?.id]);

  const students = studentsData;

  const handleLinkStudent = async () => {
    if (!studentCode) return toast.error('Por favor, informe o código.');
    if (!user) return;

    try {
      // Find student by code
      const { data: st } = await supabase.from('users').select('*').eq('studentCode', studentCode).single();
      const student = st as Student | undefined;
      
      if (!student || student.role !== 'student') {
        return toast.error('Código inválido ou estudante não encontrado.');
      }

      // Check if already linked
      const currentIds = student.guardianIds || ((student as any).guardianId ? [(student as any).guardianId] : []);
      if (currentIds.includes(user.id)) {
        return toast.error('Este aluno já está vinculado a você.');
      }

      // Update student
      await supabase.from('users').update({ 
        guardianIds: Array.from(new Set([...currentIds, user.id])),
        guardianId: currentIds[0] || user.id // Keep primary for compatibility
      }).eq('id', student.id);

      // Update guardian
      const { data: liveG } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (liveG && liveG.role === 'guardian') {
        const newIds = Array.from(new Set([...(liveG.studentIds || []), student.id]));
        await supabase.from('users').update({ studentIds: newIds }).eq('id', user.id);
      }
      
      fetchStudents();

      toast.success(`Aluno ${student.name} vinculado com sucesso!`);
      setIsLinkModalOpen(false);
      setStudentCode('');
    } catch (e) {
      toast.error('Erro ao vincular aluno.');
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Meus Dependentes</h1>
                <p className="text-slate-500 font-medium font-outfit">Gestão e acompanhamento detalhado de todos os seus filhos na plataforma.</p>
            </div>
            <button 
                onClick={() => setIsLinkModalOpen(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-1 active:scale-95 text-sm whitespace-nowrap"
            >
                <Plus size={20} className="stroke-[3]" />
                Vincular Novo Aluno
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {students.map(student => (
          <Card key={student.id} className="p-0 overflow-hidden border-2 border-slate-100 hover:border-primary-100 transition-all duration-500 group">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div className="flex items-center gap-5 text-left">
                  <div className="w-16 h-16 bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-400 transition-all duration-500 shadow-sm relative overflow-hidden">
                     <User size={32} className="relative z-10" />
                     <div className="absolute inset-0 bg-primary-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  </div>
                  <StudentInfo student={student} />
               </div>
               <Button onClick={() => navigate('/guardian')} variant="ghost" className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 group-hover:text-primary-500 transition-colors">
                  <ChevronRight size={24} />
               </Button>
            </div>

            <div className="p-8 space-y-8">
               <StudentCardStats studentId={student.id} />
               
               <Button variant="outline" className="w-full rounded-2xl py-4 font-black text-xs uppercase tracking-widest border-2 border-slate-100 hover:border-primary-500/20 hover:bg-primary-50/50 transition-all">
                  Ver Relatório Completo de {student.name.split(' ')[0]}
               </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── LINK STUDENT MODAL ── */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLinkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="bg-slate-900 p-12 text-white relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/30 rounded-full blur-3xl -mr-20 -mt-20" />
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-primary-400 mb-6 backdrop-blur-sm border border-white/10">
                    <User size={32} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight relative z-10">Vincular Aluno</h2>
                  <p className="text-slate-400 font-medium mt-1 relative z-10">Informe o código único fornecido pela escola.</p>
              </div>
              
              <div className="p-12 space-y-10">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Código do Estudante</label>
                        <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                            <input 
                                type="text" 
                                placeholder="Ex: IMP-2024-XXXX"
                                value={studentCode}
                                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-14 py-5 text-slate-700 font-black focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-sm placeholder:text-slate-300"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium italic ml-2">* O código de vínculo expira em 48 horas.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setIsLinkModalOpen(false)}
                        className="flex-1 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                         onClick={handleLinkStudent}
                        className="flex-[2] bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                        Validar Código <ChevronRight size={18} />
                    </button>
                </div>

                <div className="bg-primary-50 p-6 rounded-3xl flex items-start gap-4 border border-primary-100/50">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary-500 shadow-sm shrink-0">
                        <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-primary-900 uppercase tracking-tight">Vantagens Premium</h4>
                        <p className="text-[10px] text-primary-700 font-medium mt-1 leading-relaxed">
                            Ao vincular, você terá acesso a relatórios de IA em tempo real e trilhas personalizadas.
                        </p>
                    </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
