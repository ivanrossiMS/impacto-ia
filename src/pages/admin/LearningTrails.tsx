import React, { useState } from 'react';
import { 
  Zap, Search, BookOpen, Target, 
  ChevronRight, Trash2, Edit3, 
  Sparkles, Layers, GraduationCap, Calendar,
  AlertCircle, Trophy, X, CheckCircle2, History,
  PenTool, BrainCircuit, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { createBulkNotifications } from '../../lib/notificationUtils';
import { callAI, callGenerateTrailStep } from '../../ai/client';

// --- Modals ---

const TrailDetailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void }> = ({ trail, isOpen, onClose }) => {
  if (!isOpen || !trail) return null;

  const stepIcons: Record<string, any> = {
    intro: <Info className="text-blue-500" />,
    theory: <BrainCircuit className="text-indigo-500" />,
    practice: <PenTool className="text-orange-500" />,
    quiz: <CheckCircle2 className="text-emerald-500" />,
    boss: <Trophy className="text-amber-500" />,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto"
      >
        <div className="p-10 space-y-8">
           <header className="flex items-center justify-between">
              <div className="space-y-1">
                 <Badge variant="energy" className="uppercase tracking-widest text-[9px] italic">{trail.subject}</Badge>
                 <h2 className="text-4xl font-black text-slate-800 tracking-tight">{trail.title}</h2>
              </div>
              <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-800 transition-colors">
                <X size={24} />
              </button>
           </header>

           <section className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objetivo Pedagógico</h4>
              <p className="text-slate-600 font-medium leading-relaxed">{trail.description}</p>
              <div className="flex gap-4 pt-4">
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <Trophy className="text-amber-500" size={16} />
                    <span className="text-xs font-bold text-slate-700">{trail.rewardXp} XP</span>
                 </div>
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <History className="text-primary-500" size={16} />
                    <span className="text-xs font-bold text-slate-700">{trail.steps.length} Etapas</span>
                 </div>
              </div>
           </section>

           <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mapa de Aprendizagem</h4>
              <div className="relative space-y-8 pl-10">
                 <div className="absolute left-[20px] top-4 bottom-4 w-1 bg-slate-100 rounded-full" />
                 {trail.steps.map((step: any, idx: number) => (
                   <div key={step.id} className="relative group">
                      <div className="absolute -left-[30px] w-10 h-10 bg-white border-4 border-slate-100 rounded-2xl flex items-center justify-center group-hover:border-primary-500 transition-all">
                         {stepIcons[step.type] || <CheckCircle2 size={20} />}
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-md group-hover:bg-slate-50 transition-all">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Fase {idx + 1}</span>
                            <Badge variant="outline" className="text-[8px] uppercase">{step.type}</Badge>
                         </div>
                         <h5 className="text-lg font-black text-slate-800 tracking-tight">{step.title}</h5>
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </div>
      </motion.div>
    </div>
  );
};

const EditTrailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onSave: (data: any) => void }> = ({ trail, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = React.useState({ ...trail });

  React.useEffect(() => {
    if (trail) setFormData({ ...trail });
  }, [trail]);

  if (!isOpen || !trail) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black text-slate-800">Editar Trilha</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Título</label>
                <input 
                  value={formData.title} 
                  onChange={e => setFormData((p: any) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-4 focus:ring-primary-500/10" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição</label>
                <textarea 
                  rows={3}
                  value={formData.description} 
                  onChange={e => setFormData((p: any) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-4 focus:ring-primary-500/10 resize-none" 
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dificuldade</label>
                   <select 
                     value={formData.difficulty} 
                     onChange={e => setFormData((p: any) => ({ ...p, difficulty: e.target.value as any }))}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                   >
                     <option value="easy">Fácil</option>
                     <option value="medium">Médio</option>
                     <option value="hard">Difícil</option>
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Série</label>
                   <input 
                     value={formData.grade} 
                     onChange={e => setFormData((p: any) => ({ ...p, grade: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none" 
                   />
                </div>
             </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-50">
             <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
             <Button variant="primary" className="flex-1 rounded-2xl" onClick={() => { onSave(formData); onClose(); }}>Salvar Alterações</Button>
          </div>
       </motion.div>
    </div>
  );
};

const LinkClassModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onLink: (classId: string, year: string) => void }> = ({ trail, isOpen, onClose, onLink }) => {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  React.useEffect(() => {
    supabase.from('schools').select('*').then(({ data }) => setSchools(data || []));
  }, []);

  React.useEffect(() => {
    if (!selectedSchool) {
      setClasses([]);
      return;
    }
    supabase.from('classes').select('*').eq('schoolId', selectedSchool).then(({ data }) => setClasses(data || []));
  }, [selectedSchool]);

  if (!isOpen || !trail) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-6">
          <div className="flex items-center justify-between">
             <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-800">Vincular Turma</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trail.title}</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
          
          <div className="space-y-5">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Escola</label>
                <select 
                  value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   <option value="">Selecione a Escola</option>
                   {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Turma Destino</label>
                <select 
                  disabled={!selectedSchool}
                  value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full disabled:opacity-50 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   <option value="">Selecione a Turma</option>
                   {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
                </select>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ano Letivo</label>
                <select 
                  value={year} onChange={e => setYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                </select>
             </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
             <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
             <Button 
               variant="primary" 
               className="flex-1 rounded-2xl" 
               disabled={!selectedClass}
               onClick={() => { onLink(selectedClass, year); onClose(); }}
             >
                Confirmar Vínculo
             </Button>
          </div>
       </motion.div>
    </div>
  );
};


const PHASE_TYPES = [
  { type: 'intro',    label: 'Introdução' },
  { type: 'theory',  label: 'Teoria' },
  { type: 'practice',label: 'Prática' },
  { type: 'quiz',    label: 'Quiz' },
  { type: 'boss',    label: 'Desafio Final' },
];

const AIGeneratorModal: React.FC<{ isOpen: boolean; onClose: () => void; onGenerate: (data: any) => void }> = ({ isOpen, onClose, onGenerate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPhases, setGeneratedPhases] = useState(0);
  const [formData, setFormData] = useState({
    subject: '',
    topic: '',
    grade: '',
    difficulty: 'medium'
  });

  const handleGenerate = async () => {
    if (!formData.topic || !formData.subject || !formData.grade) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setIsGenerating(true);
    setGeneratedPhases(0);
    try {
      // Fetch existing trail titles to avoid duplicates
      const { data: existingTrails } = await supabase.from('learning_paths').select('title');
      const existingTitles = (existingTrails || []).map((t: any) => t.title).filter(Boolean);
      const forbiddenBlock = existingTitles.length > 0
        ? `\n\nATENÇÃO OBRIGATÓRIO: As seguintes trilhas JÁ EXISTEM no sistema. É PROIBIDO gerar conteúdo igual, parecido ou que sobreponha esses tópicos. O conteúdo deve ser 100% distinto:\n${existingTitles.map(t => `- "${t}"`).join('\n')}`
        : '';

      // 1. Generate meta + all 5 steps in parallel
      const metaPromise = callAI({
        feature: 'generate-trail-meta',
        topic: formData.topic + forbiddenBlock,
        subject: formData.subject,
        grade: formData.grade,
      });

      const stepPromises = PHASE_TYPES.map((phase, idx) =>
        callGenerateTrailStep({
          topic: formData.topic + forbiddenBlock,
          subject: formData.subject,
          grade: formData.grade,
          difficulty: formData.difficulty,
          phaseIndex: idx,
          phaseType: phase.type,
        }).then(result => {
          setGeneratedPhases(prev => prev + 1);
          return result;
        })
      );

      const [metaRes, ...steps] = await Promise.all([metaPromise, ...stepPromises]);
      const meta = metaRes.result as any;

      const newTrail = {
        id: crypto.randomUUID(),
        title: meta.title,
        description: meta.description,
        rewardXp: meta.rewardXp || 600,
        rewardCoins: meta.rewardCoins || 250,
        steps: steps.map((s, i) => ({ ...s, id: String(i + 1) })),
        subject: formData.subject,
        grade: formData.grade,
        difficulty: formData.difficulty,
        isAIGenerated: true,
        createdAt: new Date().toISOString()
      };

      onGenerate(newTrail);
      onClose();
      toast.success('Trilha completa gerada com IA! ✨');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar trilha. Tente novamente.');
    } finally {
      setIsGenerating(false);
      setGeneratedPhases(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary-600 to-indigo-700 p-8 text-white relative">
          <Sparkles className="mb-4 text-primary-200" size={32} />
          <h2 className="text-2xl font-black tracking-tight">IA Magic Generator</h2>
          <p className="text-primary-100/80 text-sm font-medium">Crie trilhas completas em segundos.</p>
        </div>
        <div className="p-8 space-y-6">
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary-100 rounded-full"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <Zap className="absolute inset-0 m-auto text-primary-500 animate-pulse" size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-800 italic uppercase">Gerando trilha com IA...</h4>
                <div className="flex items-center justify-center gap-2">
                  {PHASE_TYPES.map((p, i) => (
                    <div key={p.type} className={cn("w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center transition-all",
                      i < generatedPhases ? "bg-primary-500 text-white scale-110" : "bg-slate-100 text-slate-400"
                    )}>
                      {i < generatedPhases ? "✓" : i + 1}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-bold">{generatedPhases}/5 fases concluídas</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assunto / Tema Central</label>
                  <input placeholder="Ex: Sistema Solar..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.topic} onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Disciplina</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.subject} onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}>
                    <option value="">Selecione...</option>
                    <option value="Português">Português</option><option value="Matemática">Matemática</option><option value="História">História</option><option value="Geografia">Geografia</option><option value="Ciências">Ciências</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Série</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.grade} onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', 'EM'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
                <Button disabled={!formData.topic || !formData.subject || !formData.grade} variant="primary" className="flex-1 rounded-2xl" onClick={handleGenerate}>Gerar com IA</Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Bulk AI Generator Modal ─────────────────────────────────────────────────

const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', 'EM - 1º', 'EM - 2º', 'EM - 3º'];
const SUBJECTS = ['Português', 'Matemática', 'História', 'Geografia', 'Ciências', 'Física', 'Química', 'Biologia', 'Artes', 'Educação Física'];

const BulkAIGeneratorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onBulkGenerate: (trails: any[]) => void;
}> = ({ isOpen, onClose, onBulkGenerate }) => {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [quantity, setQuantity] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTrail, setCurrentTrail] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [status, setStatus] = useState('');

  const handleGenerate = async () => {
    if (!grade || !subject) {
      toast.error('Selecione a série e a disciplina.');
      return;
    }
    if (quantity < 1 || quantity > 10) {
      toast.error('Quantidade deve ser entre 1 e 10 trilhas.');
      return;
    }

    setIsGenerating(true);
    setCurrentTrail(0);
    setCurrentPhase(0);

    // Fetch existing trail titles to build the forbidden list
    const { data: existingTrails } = await supabase.from('learning_paths').select('title');
    const existingTitles = (existingTrails || []).map((t: any) => t.title).filter(Boolean);
    const forbiddenNote = existingTitles.length > 0
      ? `\n\nATENÇÃO CRÍTICO: As trilhas abaixo JÁ EXISTEM no sistema. É ABSOLUTAMENTE PROIBIDO gerar contúedo igual, similar, parecido ou que sobreponha qualquer um desses tópicos. Cada nova trilha DEVE ser 100% única e distinta:\n${existingTitles.map(t => `- "${t}"`).join('\n')}`
      : '';

    // Build the master curriculum prompt to get N unique topics
    const topicsPrompt = `Você é um especialista em currículo escolar brasileiro (BNCC).
Gere exatamente ${quantity} tópicos/temas distintos e progressivos para trilhas de aprendizagem da disciplina "${subject}" para a série "${grade}" do Ensino Básico/Médio.
Regras obrigatórias:
- Cada tópico deve ser diferente e não repetitivo
- Respeitar rigorosamente o currículo da BNCC para ${grade}
- Progressividade: do mais simples ao mais complexo
- Linguagem adequada ao nível do aluno
- Cada tópico deve ser uma string curta e descritiva (ex: "Frações Equivalentes", "Ecossistemas Brasileiros")${forbiddenNote}
Retorne APENAS um array JSON com ${quantity} strings. Exemplo: ["Tópico 1", "Tópico 2", ...]`;

    let topics: string[] = [];
    try {
      setStatus('Analisando currículo BNCC e verificando conteúdo existente...');
      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'generate-trail-meta', prompt: topicsPrompt }),
      });
      const raw = await res.text();
      const match = raw.match(/\[.*\]/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) topics = parsed.slice(0, quantity);
      }
    } catch (_) {
      // fallback: generic topics
    }

    while (topics.length < quantity) {
      topics.push(`${subject} - Tópico ${topics.length + 1} (${grade})`);
    }

    const generated: any[] = [];

    for (let i = 0; i < quantity; i++) {
      const topic = topics[i];
      // Build the accumulated forbidden list (existing + already-generated in this batch)
      const allForbidden = [
        ...existingTitles,
        ...generated.map(g => g.title),
      ];
      const batchForbiddenNote = allForbidden.length > 0
        ? `\n\nATENÇÃO CRÍTICO: NÃO gere conteúdo igual ou similar a:\n${allForbidden.map(t => `- "${t}"`).join('\n')}`
        : '';
      const topicWithContext = topic + batchForbiddenNote;

      setCurrentTrail(i + 1);
      setCurrentPhase(0);
      setStatus(`Gerando trilha ${i + 1}/${quantity}: "${topic}"...`);

      try {
        const metaPromise = callAI({
          feature: 'generate-trail-meta',
          topic: topicWithContext,
          subject,
          grade,
        });
        const stepPromises = PHASE_TYPES.map((phase, idx) =>
          callGenerateTrailStep({
            topic: topicWithContext,
            subject,
            grade,
            difficulty: 'medium',
            phaseIndex: idx,
            phaseType: phase.type,
          }).then(result => {
            setCurrentPhase(prev => prev + 1);
            return result;
          })
        );
        const [metaRes, ...steps] = await Promise.all([metaPromise, ...stepPromises]);
        const meta = (metaRes as any).result || metaRes;
        generated.push({
          id: crypto.randomUUID(),
          title: (meta as any).title || topic,
          description: (meta as any).description || '',
          rewardXp: (meta as any).rewardXp || 600,
          rewardCoins: (meta as any).rewardCoins || 250,
          steps: steps.map((s, si) => ({ ...s, id: String(si + 1) })),
          subject,
          grade,
          difficulty: 'medium',
          isAIGenerated: true,
          createdAt: new Date().toISOString(),
        });
      } catch (err: any) {
        toast.error(`Erro na trilha "${topic}": ${err.message}`);
      }
    }

    onBulkGenerate(generated);
    onClose();
    toast.success(`${generated.length} trilha(s) gerada(s) com sucesso! ✨`);
    setIsGenerating(false);
    setCurrentTrail(0);
    setCurrentPhase(0);
    setStatus('');
    setGrade('');
    setSubject('');
    setQuantity(3);
  };

  if (!isOpen) return null;

  const totalPhases = quantity * 5;
  const donePhases = (currentTrail > 0 ? (currentTrail - 1) * 5 : 0) + currentPhase;
  const overallPct = totalPhases > 0 ? Math.round((donePhases / totalPhases) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-primary-600 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Layers size={20} className="text-white" />
              </div>
              <span className="text-white/70 text-xs font-black uppercase tracking-widest">IA Educativa</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Criar Trilhas em Lote</h2>
            <p className="text-white/70 text-sm font-medium mt-1">A IA analisa o currículo BNCC e gera trilhas pedagógicas completas para a série escolhida.</p>
          </div>
        </div>

        <div className="p-8">
          {isGenerating ? (
            <div className="space-y-6">
              {/* Overall progress */}
              <div className="text-center space-y-2">
                <div className="relative inline-flex">
                  <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
                  <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-indigo-500 animate-pulse" size={28} />
                </div>
                <p className="font-black text-slate-800 text-base uppercase italic tracking-wide">Gerando trilhas com IA...</p>
                <p className="text-slate-400 text-xs font-bold">{status}</p>
              </div>

              {/* Trail progress */}
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Trilha {currentTrail}/{quantity}</span>
                  <span>{overallPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${overallPct}%` }} />
                </div>
                {/* Phase dots */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {PHASE_TYPES.map((p, i) => (
                    <div key={p.type} className={cn(
                      "w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center transition-all",
                      i < currentPhase ? "bg-indigo-500 text-white scale-110" : "bg-slate-100 text-slate-400"
                    )}>
                      {i < currentPhase ? '✓' : i + 1}
                    </div>
                  ))}
                </div>
                <p className="text-center text-[10px] text-slate-400 font-bold">{currentPhase}/5 fases da trilha atual</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Grade */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Série do Aluno</label>
                <select
                  value={grade} onChange={e => setGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-400 transition-colors"
                >
                  <option value="">Selecione a série...</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Disciplina</label>
                <select
                  value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-400 transition-colors"
                >
                  <option value="">Selecione a disciplina...</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Quantidade de Trilhas</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min={1} max={10} value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <div className="w-14 h-14 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-700">
                    {quantity}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-bold ml-1">≈ {quantity * 5} fases no total &bull; Tempo estimado: ~{Math.ceil(quantity * 0.5)} min
                </p>
              </div>

              {/* Info box */}
              {grade && subject && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                  <BrainCircuit size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700 font-bold leading-relaxed">
                    A IA irá analisar o currículo BNCC para <strong>{grade}</strong> em <strong>{subject}</strong>, gerar {quantity} tópicos progressivos distintos e criar trilhas pedagógicas completas com teoria, prática e quiz para cada fase.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
                <Button
                  disabled={!grade || !subject}
                  variant="primary"
                  className="flex-[2] rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 border-0"
                  onClick={handleGenerate}
                >
                  <Sparkles size={16} className="mr-2" />
                  Gerar {quantity} Trilha{quantity > 1 ? 's' : ''} com IA
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Page ---

export const AdminLearningTrails: React.FC = () => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [showBulkAIModal, setShowBulkAIModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  
  // Modal States
  const [activeTrailDetail, setActiveTrailDetail] = useState<any>(null);
  const [trailToEdit, setTrailToEdit] = useState<any>(null);
  const [trailToLink, setTrailToLink] = useState<any>(null);

  const [trails, setTrails] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: tData } = await supabase.from('learning_paths').select('*');
    const { data: cData } = await supabase.from('classes').select('*');
    if (tData) setTrails(tData);
    if (cData) setClasses(cData);
  };

  React.useEffect(() => {
    fetchData();
    const ch = supabase.channel('admin_trails')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learning_paths' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredTrails = trails.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
    const matchYear = !filterYear || (t.schoolYear || '') === filterYear;
    const matchSubject = !filterSubject || (t.subject || '') === filterSubject;
    const matchGrade = !filterGrade || (t.grade || '') === filterGrade;
    return matchSearch && matchYear && matchSubject && matchGrade;
  });

  // Dynamic options derived from loaded data
  const yearOptions = Array.from(new Set(trails.map(t => t.schoolYear).filter(Boolean))).sort();
  const subjectOptions = Array.from(new Set(trails.map(t => t.subject).filter(Boolean))).sort();
  const gradeOptions = Array.from(new Set(trails.map(t => t.grade).filter(Boolean))).sort();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Excluir esta trilha permanentemente?')) {
      await supabase.from('learning_paths').delete().eq('id', id);
      toast.success('Trilha removida');
    }
  };

  const handleUpdateTrail = async (data: any) => {
    if (!data.id) return;
    await supabase.from('learning_paths').update(data).eq('id', data.id);
    toast.success('Trilha atualizada com sucesso!');
  };

  const handleLinkTrail = async (classId: string, year: string) => {
    if (!trailToLink) return;
    await supabase.from('learning_paths').update({ classId, schoolYear: year }).eq('id', trailToLink.id);
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (cls && cls.studentIds && cls.studentIds.length > 0) {
      // Notify students (and Guardians automatically via mirroring)
      await createBulkNotifications(
        cls.studentIds,
        'student',
        'Nova Trilha de Aprendizagem! 🚀',
        `Uma nova trilha foi liberada para sua turma: "${trailToLink.title}".`,
        'success',
        'high',
        '/student/learning'
      );
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
           <Badge variant="primary" className="px-3 py-1 text-[9px] uppercase tracking-widest font-black italic">Pedagogia Gamificada</Badge>
           <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none group">
             Trilhas de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Aprendizagem</span>
           </h1>
           <p className="text-slate-400 font-bold max-w-xl text-lg tracking-tight leading-relaxed">Gerencie roteiros dinâmicos e utilize <span className="text-primary-500">IA</span> educativa.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
           <Button variant="outline" className="rounded-2xl border-2 border-slate-200" onClick={() => setShowAIModal(true)}><Zap className="mr-2 text-amber-500" size={18} />Gerar individual com IA</Button>
           <Button variant="primary" className="rounded-2xl px-8 bg-gradient-to-r from-indigo-600 to-purple-600 border-0" onClick={() => setShowBulkAIModal(true)}><Layers size={18} className="mr-2" /> Criar em lote com IA</Button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total de Trilhas', val: trails.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Classes Atendidas', val: Array.from(new Set(trails.map(t => t.classId).filter(Boolean))).length, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'IA Generated', val: trails.filter(t => t.isAIGenerated).length, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Engajamento', val: '84%', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", s.bg, s.color)}><s.icon size={24} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">{s.label}</p>
              <h4 className="text-2xl font-black text-slate-800 tracking-tight">{s.val}</h4>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título ou disciplina..." className="w-full bg-white border border-slate-100 rounded-[2rem] py-5 pl-16 pr-6 text-sm font-bold shadow-sm outline-none" />
        </div>
        {/* Filters row */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 shadow-sm outline-none cursor-pointer hover:border-primary-300 transition-colors"
          >
            <option value="">Todos os Anos
            </option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 shadow-sm outline-none cursor-pointer hover:border-primary-300 transition-colors"
          >
            <option value="">Todas as Disciplinas</option>
            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            className="bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 shadow-sm outline-none cursor-pointer hover:border-primary-300 transition-colors"
          >
            <option value="">Todas as Séries</option>
            {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {/* Active filter count + clear */}
          {(filterYear || filterSubject || filterGrade) && (
            <button
              onClick={() => { setFilterYear(''); setFilterSubject(''); setFilterGrade(''); }}
              className="px-5 py-3 bg-red-50 text-red-500 border border-red-100 rounded-2xl text-sm font-black hover:bg-red-100 transition-colors"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto self-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
            {filteredTrails.length} trilha{filteredTrails.length !== 1 ? 's' : ''} encontrada{filteredTrails.length !== 1 ? 's' : ''}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {filteredTrails.map((trail) => (
            <motion.div
              layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} key={trail.id}
              onClick={() => setActiveTrailDetail(trail)}
              className="bg-white rounded-[2.5rem] border border-transparent hover:border-primary-200 shadow-xl hover:shadow-primary-500/10 transition-all p-8 flex flex-col group cursor-pointer relative overflow-hidden"
            >
              {trail.isAIGenerated && <div className="absolute top-0 right-0 p-3 bg-amber-500/10 text-amber-600 rounded-bl-3xl"><Sparkles size={14} className="animate-pulse" /></div>}
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-primary-500 border border-slate-100 group-hover:bg-primary-50 group-hover:scale-110 transition-all"><BookOpen size={32} /></div>
                <div className="flex gap-2 relative z-10">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setTrailToEdit(trail); }}
                     className="p-3 bg-slate-50 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all"
                   >
                     <Edit3 size={18} />
                   </button>
                   <button onClick={(e) => handleDelete(e, trail.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight line-clamp-2">{trail.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                       <Badge variant="energy" className="text-[9px] uppercase italic">{trail.subject}</Badge>
                       <Badge variant="outline" className="text-[9px] uppercase border-slate-200 font-black">{trail.grade}</Badge>
                    </div>
                 </div>
                 <p className="text-slate-500 text-sm font-medium line-clamp-3 leading-relaxed">{trail.description}</p>
                 <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span className="flex items-center gap-1.5"><Calendar size={14} /> {trail.schoolYear || 'Qualquer Ano'}</span>
                       <span className="flex items-center gap-1.5 text-primary-500"><History size={14} /> {trail.steps.length} Etapas</span>
                    </div>
                    {trail.classId ? (
                      <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                         <GraduationCap size={16} className="text-blue-500" />
                         <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight truncate">
                           {classes.find(c => c.id === trail.classId)?.name || 'Classe Vinculada'}
                         </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                         <AlertCircle size={16} className="text-slate-400" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Sem vínculo de turma</span>
                      </div>
                    )}
                 </div>
              </div>

              <Button 
                variant="outline" 
                className="mt-8 rounded-2xl w-full border-2 group/btn hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all overflow-hidden"
                onClick={(e) => { e.stopPropagation(); setTrailToLink(trail); }}
              >
                <Target size={18} className="mr-2 group-hover/btn:scale-125 transition-transform" />
                Vincular Alunos
                <ChevronRight size={16} className="ml-auto opacity-0 group-hover/btn:opacity-100 transition-all" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* Modals */}
      <TrailDetailModal trail={activeTrailDetail} isOpen={!!activeTrailDetail} onClose={() => setActiveTrailDetail(null)} />
      <EditTrailModal trail={trailToEdit} isOpen={!!trailToEdit} onClose={() => setTrailToEdit(null)} onSave={handleUpdateTrail} />
      <LinkClassModal trail={trailToLink} isOpen={!!trailToLink} onClose={() => setTrailToLink(null)} onLink={handleLinkTrail} />
      <AIGeneratorModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} onGenerate={async (t) => { await supabase.from('learning_paths').insert(t); toast.success('Trilha gerada'); }} />
      <BulkAIGeneratorModal
        isOpen={showBulkAIModal}
        onClose={() => setShowBulkAIModal(false)}
        onBulkGenerate={async (trails) => {
          if (trails.length === 0) return;
          const { error } = await supabase.from('learning_paths').insert(trails);
          if (error) toast.error('Erro ao salvar trilhas: ' + error.message);
          else toast.success(`${trails.length} trilha(s) salva(s) com sucesso!`);
        }}
      />
    </div>
  );
};
