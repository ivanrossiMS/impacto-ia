import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { 
  Sword, 
  ChevronRight, 
  CheckCircle2, 
  Timer,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/utils';
import { DuelService } from '../../services/duel.service';
import type { Duel, DuelQuestion } from '../../types/duel';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';

export const DuelGame: React.FC = () => {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questionId: string; selectedOptionId: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [duel, setDuel] = useState<Duel | null>(null);
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [opponent, setOpponent] = useState<any>(null);

  const fetchData = async () => {
    if (!duelId || !user) return;
    try {
      const { data: d } = await supabase.from('duels').select('*').eq('id', duelId).single();
      setDuel(d);
      
      if (d) {
        const { data: q } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
        setQuestions(q || []);
        
        const opponentId = d.challengerId === user.id ? d.challengedId : d.challengerId;
        const { data: opp } = await supabase.from('users').select('*').eq('id', opponentId).single();
        setOpponent(opp);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel(`duel_game_${duelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `id=eq.${duelId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [duelId, user?.id]);

  useEffect(() => {
    if (duel && questions && questions.length > 0) {
      // Check if user already played
      const alreadyPlayed = (duel.challengerId === user?.id && duel.challengerTurnCompleted) ||
                            (duel.challengedId === user?.id && duel.challengedTurnCompleted);
      
      if (alreadyPlayed) {
        setIsFinished(true);
      }
      setIsLoading(false);
    }
  }, [duel, questions, user?.id]);

  if (isLoading || !duel || !questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !currentQuestion) return;
    setAnswered(true);
    setResults(prev => [...prev, { questionId: currentQuestion.id, selectedOptionId: selectedAnswer }]);
    
    const isCorrect = currentQuestion.options.find(o => o.id === selectedAnswer)?.isCorrect;
    if (isCorrect) {
      toast.success('Você acertou!');
    } else {
      toast.error('Opa, errou essa!');
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      // End turn
      if (!user || !duelId) return;
      try {
        await DuelService.submitTurn(duelId, user.id, results);
        setIsFinished(true);
        toast.success('Turno enviado! Aguarde o oponente.');
        
        // Update mission progress
        await incrementMissionProgress(user.id, 'duel_completed');
      } catch (error) {
        toast.error('Erro ao salvar resultado.');
        console.error(error);
      }
    }
  };

  const correctCount = results.filter((r, i) => 
    questions?.[i]?.options?.find(o => o.id === r.selectedOptionId)?.isCorrect
  ).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isFinished ? (
        <div className="space-y-8">
          <header className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-special-100 rounded-full flex items-center justify-center text-special-600">
                <Sword size={24} />
              </div>
              <div>
                <h2 className="font-black text-slate-800 text-lg">Duelo contra {opponent?.name || '...'}</h2>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{duel.theme}</span>
                   <span className="w-1 h-1 bg-slate-200 rounded-full" />
                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{duel.difficulty}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
               <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Questão</div>
               <div className="text-2xl font-black text-special-600">{currentQuestionIndex + 1}/{totalQuestions}</div>
            </div>
          </header>

          <div className="bg-special-600 h-1.5 w-full rounded-full overflow-hidden bg-white/20">
             <div 
               className="h-full bg-special-400 transition-all duration-500" 
               style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
             />
          </div>

          <Card className="p-8 space-y-8 border-slate-100 shadow-xl">
             <p className="text-2xl font-black text-slate-800 leading-snug">{currentQuestion.questionText}</p>
             
             <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    disabled={answered}
                    onClick={() => setSelectedAnswer(opt.id)}
                    className={cn(
                      'w-full text-left p-5 rounded-2xl border-2 font-bold transition-all text-lg',
                      answered
                        ? opt.isCorrect
                          ? 'bg-success-50 border-success-400 text-success-700'
                          : selectedAnswer === opt.id
                            ? 'bg-red-50 border-red-400 text-red-700'
                            : 'bg-slate-50 border-slate-100 text-slate-400'
                        : selectedAnswer === opt.id
                          ? 'bg-special-50 border-special-500 text-special-700 shadow-md ring-2 ring-special-200 ring-opacity-50'
                          : 'bg-white border-slate-100 hover:border-special-200 hover:bg-special-50/30 text-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <span>{opt.text}</span>
                       {answered && opt.isCorrect && <CheckCircle2 size={24} className="text-success-500" />}
                       {answered && selectedAnswer === opt.id && !opt.isCorrect && <X size={24} className="text-red-500" />}
                    </div>
                  </button>
                ))}
             </div>

             <div className="flex gap-4 pt-4">
                {!answered ? (
                  <Button
                    variant="ai"
                    className="w-full h-16 rounded-[2rem] font-black text-lg shadow-xl shadow-special-500/20"
                    disabled={!selectedAnswer}
                    onClick={handleSubmitAnswer}
                  >
                    Confirmar Resposta
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full h-16 rounded-[2rem] font-black text-lg shadow-xl shadow-primary-500/20"
                    onClick={handleNext}
                  >
                    {currentQuestionIndex < totalQuestions - 1 ? 'Próxima Questão' : 'Ver Resultado do Turno'}
                    <ChevronRight size={20} className="ml-2" />
                  </Button>
                )}
             </div>
          </Card>
        </div>
      ) : (
        /* Result Turn Summary */
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
           <Card className="p-12 text-center space-y-8 shadow-2xl border-special-100">
              <div className="w-32 h-32 bg-special-100 rounded-full flex items-center justify-center text-7xl mx-auto ring-8 ring-special-50">
                 🏃
              </div>
              
              <div>
                 <h2 className="text-4xl font-black text-slate-800">Seu turno acabou!</h2>
                 <p className="text-slate-500 font-bold text-lg">Parabéns pelo esforço no duelo!</p>
              </div>

              <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Acertos</div>
                    <div className="text-4xl font-black text-slate-800">{correctCount}</div>
                 </div>
                 <div className="bg-special-50 p-6 rounded-3xl border border-special-100 text-special-700">
                    <div className="text-special-400 text-xs font-black uppercase tracking-widest mb-2">XP Ganho</div>
                    <div className="text-4xl font-black">+{correctCount * 25}</div>
                 </div>
              </div>

              <div className="pt-6">
                 {duel.status === 'completed' ? (
                   <div className="mb-8 p-6 bg-slate-900 rounded-[2.5rem] text-white">
                      <h3 className="text-xl font-black mb-2">Resultado Final</h3>
                      <div className="text-3xl font-black text-special-400">
                         {duel.challengerScore} X {duel.challengedScore}
                      </div>
                      <p className="font-bold text-slate-400 mt-2">
                         {duel.winnerId === user?.id ? '🎉 VITÓRIA!' : duel.winnerId === 'draw' ? '🤝 Empate!' : '😔 Não foi dessa vez!'}
                      </p>
                   </div>
                 ) : (
                   <div className="mb-8 p-6 bg-primary-50 rounded-[2.5rem] border border-primary-100 text-primary-700">
                      <p className="font-bold flex items-center justify-center gap-2">
                         <Timer size={18} /> Aguardando turno do oponente para saber o vencedor!
                      </p>
                   </div>
                 )}
                 
                 <Button 
                   variant="ghost" 
                   className="w-full h-14 rounded-2xl font-black text-slate-400 hover:text-slate-600" 
                   onClick={() => navigate('/student/missions')} // Redirecting to missions since Duel is there
                 >
                    Voltar para Missões
                 </Button>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};
