import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  User, 
  HelpCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty } from '../../types/duel';
import { toast } from 'sonner';

export const DuelCreate: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [theme, setTheme] = useState<DuelTheme>('aleatorio');
  const [difficulty, setDifficulty] = useState<DuelDifficulty>('medium');
  const [questionCount, setQuestionCount] = useState<5 | 8 | 10>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const fetchClassmates = async () => {
      if (!user) return;
      if (user.role !== 'student') return;
      
      try {
        const { data: userData } = await supabase.from('users').select('classId').eq('id', user.id).single();
        if (userData?.classId) {
          const { data: classmates } = await supabase.from('users').select('*').eq('classId', userData.classId).neq('id', user.id);
          setStudents(classmates || []);
        }
      } catch (e) {
        console.error('Error fetching classmates:', e);
      }
    };
    fetchClassmates();
  }, [user?.id]);

  const themes: { id: DuelTheme; label: string; icon: string }[] = [
    { id: 'historia', label: 'História', icon: '📜' },
    { id: 'geografia', label: 'Geografia', icon: '🌍' },
    { id: 'arte', label: 'Arte', icon: '🎨' },
    { id: 'esportes', label: 'Esportes', icon: '⚽' },
    { id: 'ciencias', label: 'Ciências', icon: '🧩' },
    { id: 'entretenimento', label: 'Entretenimento', icon: '🍿' },
    { id: 'aleatorio', label: 'Aleatório', icon: '🎲' },
  ];

  const handleCreate = async () => {
    if (!user || !selectedOpponent) return;
    
    setIsSubmitting(true);
    try {
      const duel = await DuelService.createDuel(
        user.id,
        selectedOpponent,
        theme,
        difficulty,
        questionCount
      );
      toast.success('Desafio enviado com sucesso!');
      navigate(`/student/duels/${duel.id}`);
    } catch (error) {
      toast.error('Erro ao criar desafio.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/duels')} className="rounded-full">
           <ChevronRight className="rotate-180" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-800">Criar Novo <span className="text-special-600">Duelo</span></h1>
          <p className="text-slate-500 font-medium font-bold">Configure seu desafio e chame um colega!</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Step 1: Opponent */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-black">1</div>
            <h2 className="text-xl font-black uppercase tracking-tight">Escolha o Oponente</h2>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {students.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold px-4">Nenhum colega de turma encontrado para desafiar.</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-4 text-primary-600 font-bold"
                  onClick={() => window.location.reload()}
                >
                  Atualizar Lista
                </Button>
              </div>
            ) : (
              students.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedOpponent(student.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                    selectedOpponent === student.id
                      ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                      : "border-slate-100 hover:border-primary-200 bg-white"
                  )}
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 overflow-hidden">
                    {student.avatar ? <img src={student.avatar} className="w-full h-full object-cover" /> : <User size={24} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{student.name}</h4>
                    <p className="text-xs text-slate-400">{(student as any).grade || 'Aluno'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Step 2: Settings */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 mb-2">
              <div className="w-8 h-8 rounded-lg bg-special-100 flex items-center justify-center text-special-600 font-black">2</div>
              <h2 className="text-xl font-black uppercase tracking-tight">Configurações</h2>
            </div>

            {/* Themes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    theme === t.id
                      ? "border-special-500 bg-special-50"
                      : "border-slate-100 bg-white hover:border-special-200"
                  )}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Nível de Dificuldade</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'easy', label: 'Iniciante' },
                  { id: 'medium', label: 'Médio' },
                  { id: 'hard', label: 'Mestre' },
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id as any)}
                    className={cn(
                      "py-3 rounded-xl border-2 font-bold text-sm transition-all text-center",
                      difficulty === d.id
                        ? "border-energy-500 bg-energy-50 text-energy-700"
                        : "border-slate-100 bg-white"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Quantidade de Perguntas</label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 8, 10].map(count => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count as any)}
                    className={cn(
                      "py-3 rounded-xl border-2 font-bold text-sm transition-all text-center",
                      questionCount === count
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-100 bg-white"
                    )}
                  >
                    {count} Perguntas
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Button
              variant="ai"
              className="w-full h-16 rounded-[2rem] font-black text-lg gap-2 shadow-2xl shadow-special-500/20"
              disabled={!selectedOpponent || isSubmitting}
              onClick={handleCreate}
            >
              {isSubmitting ? 'Gerando Desafio...' : 'Iniciar Desafio Virtual'}
              <Sparkles size={20} />
            </Button>
            <p className="text-[10px] text-center text-slate-400 font-bold mt-4 flex items-center justify-center gap-1 uppercase tracking-widest">
              <HelpCircle size={12} /> A IA irá gerar as perguntas agora
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
