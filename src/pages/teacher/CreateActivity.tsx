import React, { useState } from 'react';
import {
  Wand2, BookOpen, Target, Sparkles, Brain, Cpu, MessageSquare,
  Zap, Save, CheckSquare, AlignLeft,
  FileText, GraduationCap, Copy, Check, Gamepad2, Calendar,
  Edit2, X, Plus, Trash2, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '../../store/auth.store';
import { saveActivityToStorage } from '../../lib/activityStorage';
import { createBulkNotifications } from '../../lib/notificationUtils';

interface Question {
  id: string;
  text: string;
  type: 'objetiva' | 'dissertativa';
  options?: string[];
  answer?: string;
}

function generateQuestions(topic: string, subject: string, grade: string, type: string, quantity: number): Question[] {
  const topicName = topic || 'Conteúdo Geral';
  const gradeInfo = grade || '5º Ano';
  const subjectName = subject || 'diversas matérias';

  const buildObjetiva = (i: number): Question => ({
    id: crypto.randomUUID(), type: 'objetiva',
    text: `${i + 1}. Sobre ${topicName} no contexto de ${subjectName} para o ${gradeInfo}, qual das afirmações abaixo é CORRETA?`,
    options: [
      `A opção correta relacionada a ${topicName}`,
      `Uma variação incorreta do conceito`,
      `Uma confusão com outro conceito de ${subjectName}`,
      `Uma resposta que parece correta mas está equivocada`,
    ],
    answer: '0',
  });

  const buildDissertativa = (i: number): Question => ({
    id: crypto.randomUUID(), type: 'dissertativa',
    text: `${i + 1}. Com base em ${topicName}, escreva com suas próprias palavras ${
      i % 3 === 0 ? `uma explicação sobre a importância deste tema em ${subjectName}.`
      : i % 3 === 1 ? `dois exemplos práticos do dia a dia relacionados a ${topicName}.`
      : `uma análise crítica sobre como ${topicName} se aplica ao ${gradeInfo}.`}`,
    answer: `Espera-se demonstração de compreensão de ${topicName} com vocabulário adequado para o ${gradeInfo}.`,
  });

  const buildQuiz = (i: number): Question => ({
    id: crypto.randomUUID(), type: 'objetiva',
    text: `🎮 ${i + 1}. [Quiz Rápido] Qual alternativa descreve corretamente ${topicName}? Você tem 30 segundos!`,
    options: [
      `✅ Esta afirmação está corretamente relacionada a ${topicName}`,
      `❌ Distorce o conceito`,
      `⚠️ Confunde com outro tema de ${subjectName}`,
      `🎭 Parece certo mas está errado`,
    ],
    answer: '0',
  });

  return Array.from({ length: quantity }, (_, i) => {
    if (type === 'dissertativa') return buildDissertativa(i);
    if (type === 'quiz_divertido') return buildQuiz(i);
    return buildObjetiva(i);
  });
}

type ActivityTypeId = 'objetiva' | 'quiz_divertido' | 'dissertativa' | 'simulado' | 'prova_mensal' | 'prova_bimestral';

const ACTIVITY_TYPES: { id: ActivityTypeId; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { id: 'objetiva', label: 'Objetiva', icon: CheckSquare, desc: 'Múltipla escolha com alternativas A–D', color: 'from-blue-500 to-indigo-500' },
  { id: 'quiz_divertido', label: 'Quiz Divertido', icon: Gamepad2, desc: 'Questões gamificadas e dinâmicas 🎮', color: 'from-orange-400 to-pink-500' },
  { id: 'dissertativa', label: 'Dissertativa', icon: AlignLeft, desc: 'Questões abertas e redação', color: 'from-violet-500 to-purple-600' },
  { id: 'simulado', label: 'Simulado', icon: Target, desc: 'Misto, estilo ENEM/vestibular', color: 'from-green-400 to-emerald-500' },
  { id: 'prova_mensal', label: 'Prova Mensal', icon: Calendar, desc: 'Avaliação mensal de conteúdos', color: 'from-cyan-400 to-teal-500' },
  { id: 'prova_bimestral', label: 'Prova Bimestral', icon: FileText, desc: 'Avaliação bimestral completa', color: 'from-red-400 to-rose-500' },
];

const SUBJECTS = [
  { value: 'matematica', label: '📐 Matemática' },
  { value: 'portugues', label: '📚 Português' },
  { value: 'ciencias', label: '🧪 Ciências' },
  { value: 'historia', label: '🏺 História' },
  { value: 'geografia', label: '🌍 Geografia' },
  { value: 'ingles', label: '🗣️ Inglês' },
  { value: 'artes', label: '🎨 Artes' },
  { value: 'ed_fisica', label: '⚽ Ed. Física' },
  { value: 'filosofia', label: '🧠 Filosofia' },
  { value: 'sociologia', label: '🤝 Sociologia' },
];

const CURRENT_YEAR = new Date().getFullYear();
const SCHOOL_YEARS = [String(CURRENT_YEAR + 1), String(CURRENT_YEAR), String(CURRENT_YEAR - 1), String(CURRENT_YEAR - 2)];

// DURATION is now numeric (minutes)

// ─── Question Edit Card (inline editor) ──────────────────────────────────────
const QuestionEditor: React.FC<{
  q: Question;
  idx: number;
  onUpdate: (q: Question) => void;
  onDelete: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}> = ({ q, idx, onUpdate, onDelete, isEditing, onToggleEdit }) => {
  const [text, setText] = useState(q.text);
  const [options, setOptions] = useState<string[]>(q.options || ['', '', '', '']);
  const [answer, setAnswer] = useState<string>(q.answer || '0');
  const [dissAnswer, setDissAnswer] = useState(q.answer || '');

  const save = () => {
    if (!text.trim()) { toast.error('O enunciado não pode ser vazio.'); return; }
    onUpdate({
      ...q,
      text: text.trim(),
      options: q.type === 'objetiva' ? options.map(o => o.trim()) : undefined,
      answer: q.type === 'objetiva' ? answer : dissAnswer.trim(),
    });
    onToggleEdit();
    toast.success('Questão atualizada!');
  };

  const updateOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  };

  const LETTERS = ['A', 'B', 'C', 'D'];

  if (!isEditing) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-indigo-100 transition-colors group">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider flex-shrink-0',
              q.type === 'objetiva' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600')}>
              {q.type === 'objetiva' ? 'Objetiva' : 'Dissertativa'}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Q{idx + 1}</span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onToggleEdit}
              className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar questão">
              <Edit2 size={14} />
            </button>
            <button onClick={onDelete}
              className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Excluir questão">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <p className="text-sm font-bold text-slate-700 leading-relaxed mb-3">{q.text}</p>
        {q.options && (
          <div className="space-y-1.5">
            {q.options.map((opt, j) => (
              <div key={j} className={cn('text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2',
                String(j) === q.answer ? 'bg-green-50 text-green-700 font-bold border border-green-100' : 'bg-slate-50 text-slate-500')}>
                <span className={cn('w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0',
                  String(j) === q.answer ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500')}>
                  {LETTERS[j]}
                </span>
                {opt}
              </div>
            ))}
          </div>
        )}
        {q.type === 'dissertativa' && q.answer && (
          <div className="mt-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
            <span className="text-[10px] font-black text-violet-500 uppercase tracking-wider">Gabarito: </span>
            <span className="text-xs text-violet-700 font-medium">{q.answer}</span>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">✏️ Editando Q{idx + 1}</span>
        <button onClick={onToggleEdit} className="p-1.5 text-slate-400 hover:bg-white rounded-lg transition-colors"><X size={14} /></button>
      </div>

      {/* Enunciado */}
      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Enunciado</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 resize-none transition-all" />
      </div>

      {/* Objetiva: editar alternativas + resposta correta */}
      {q.type === 'objetiva' && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alternativas</label>
          {options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <button onClick={() => setAnswer(String(j))}
                className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-all',
                  String(j) === answer ? 'bg-green-500 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-green-400')}>
                {LETTERS[j]}
              </button>
              <input value={opt} onChange={e => updateOption(j, e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                placeholder={`Alternativa ${LETTERS[j]}`} />
            </div>
          ))}
          <p className="text-[10px] text-slate-400 font-medium">Clique na letra para marcar como correta</p>
        </div>
      )}

      {/* Dissertativa: gabarito */}
      {q.type === 'dissertativa' && (
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Gabarito / Resposta Esperada</label>
          <textarea value={dissAnswer} onChange={e => setDissAnswer(e.target.value)} rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Descreva o que se espera na resposta..." />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onToggleEdit} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all">
          Cancelar
        </button>
        <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
          <Check size={15} /> Salvar Questão
        </button>
      </div>
    </motion.div>
  );
};

// ─── Add New Question Panel ───────────────────────────────────────────────────
const AddQuestionPanel: React.FC<{
  defaultType: 'objetiva' | 'dissertativa';
  onAdd: (q: Question) => void;
  onCancel: () => void;
}> = ({ defaultType, onAdd, onCancel }) => {
  const [type, setType] = useState<'objetiva' | 'dissertativa'>(defaultType);
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('0');
  const [dissAnswer, setDissAnswer] = useState('');
  const LETTERS = ['A', 'B', 'C', 'D'];

  const handleAdd = () => {
    if (!text.trim()) { toast.error('Escreva o enunciado.'); return; }
    if (type === 'objetiva' && options.some(o => !o.trim())) { toast.error('Preencha todas as alternativas.'); return; }
    const q: Question = {
      id: crypto.randomUUID(), type, text: text.trim(),
      options: type === 'objetiva' ? options.map(o => o.trim()) : undefined,
      answer: type === 'objetiva' ? answer : dissAnswer.trim(),
    };
    onAdd(q);
    toast.success('Questão adicionada!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border-2 border-primary-500/30 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-primary-400 uppercase tracking-widest">➕ Nova Questão</span>
        <button onClick={onCancel} className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors"><X size={14} /></button>
      </div>

      {/* Type toggle */}
      <div className="flex bg-white/5 p-1 rounded-xl">
        {(['objetiva', 'dissertativa'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={cn('flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
              type === t ? 'bg-primary-500 text-white shadow-md' : 'text-slate-400 hover:text-white')}>
            {t === 'objetiva' ? '📝 Objetiva' : '✍️ Dissertativa'}
          </button>
        ))}
      </div>

      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Enunciado</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-slate-500"
          placeholder="Escreva a pergunta..." />
      </div>

      {type === 'objetiva' && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alternativas</label>
          {options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <button onClick={() => setAnswer(String(j))}
                className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-all',
                  String(j) === answer ? 'bg-green-500 text-white shadow-md' : 'bg-white/10 text-slate-400 hover:bg-green-500/20 hover:text-green-300')}>
                {LETTERS[j]}
              </button>
              <input value={opt} onChange={e => { const n = [...options]; n[j] = e.target.value; setOptions(n); }}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-slate-500"
                placeholder={`Alternativa ${LETTERS[j]}`} />
            </div>
          ))}
        </div>
      )}

      {type === 'dissertativa' && (
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Gabarito (opcional)</label>
          <textarea value={dissAnswer} onChange={e => setDissAnswer(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-slate-500"
            placeholder="Resposta esperada..." />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 transition-all">Cancelar</button>
        <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-black text-sm hover:bg-primary-400 transition-all flex items-center justify-center gap-2">
          <Plus size={15} /> Adicionar
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const CreateActivity: React.FC = () => {
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [difficulty, setDifficulty] = useState('Médio');
  const [quantity, setQuantity] = useState(5);
  const [duration, setDuration] = useState('45');
  const [activityType, setActivityType] = useState<ActivityTypeId>('objetiva');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [generated, setGenerated] = useState(false);
  const [savedActivity, setSavedActivity] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(true);

  const teacherUser = useLiveQuery(async () => user ? db.users.get(user.id) : null, [user?.id]);
  const teacherClassIds: string[] = (teacherUser as any)?.classIds || [];
  const myClasses = useLiveQuery(async () => {
    const all = await db.classes.toArray();
    return all.filter(c => teacherClassIds.includes(c.id));
  }, [teacherClassIds.join(',')]) || [];

  const generationSteps = [
    { label: 'Analisando Tópico e Série', icon: Brain },
    { label: 'Consultando Currículo BNCC', icon: BookOpen },
    { label: 'Estruturando Questões', icon: Cpu },
    { label: 'Adicionando Elementos Pedagógicos', icon: Sparkles },
  ];

  const handleGenerate = () => {
    if (!subject) { toast.error('Selecione a disciplina.'); return; }
    if (!topic) { toast.error('Informe o tópico.'); return; }
    if (!grade) { toast.error('Selecione o ano escolar.'); return; }
    setIsGenerating(true); setGenerated(false); setGeneratedQuestions([]); setStep(0); setSavedActivity(false); setEditingIdx(null); setShowAddPanel(false);
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev >= 3) {
          clearInterval(interval);
          setIsGenerating(false);
          const genType = ['simulado','prova_bimestral','prova_mensal'].includes(activityType) ? 'objetiva' : activityType;
          setGeneratedQuestions(generateQuestions(topic, subject, grade, genType, quantity));
          setGenerated(true);
          setShowQuestionsPanel(true);
          toast.success('Atividade gerada! Edite as questões antes de salvar. 🚀');
          return 3;
        }
        return prev + 1;
      });
    }, 1200);
  };

  const handleSave = async () => {
    const selectedClass = myClasses.find(c => c.id === classId);
    const subjectLabel = SUBJECTS.find(s => s.value === subject)?.label?.split(' ').slice(1).join(' ') || subject;
    const typeLabel = ACTIVITY_TYPES.find(t => t.id === activityType)?.label || activityType;
    const durationLabel = !duration ? 'Sem limite' : `${duration} min`;
    
    // Save to storage (now in Dexie)
    await saveActivityToStorage({
      id: crypto.randomUUID(),
      title: `${subjectLabel} — ${topic}`,
      subject: subjectLabel, grade, type: activityType, difficulty,
      duration: durationLabel,
      description: `${typeLabel} sobre ${topic}. Turma: ${selectedClass?.name || 'Todas'}. Gerado por IA.`,
      classId: classId || undefined, 
      questions: generatedQuestions, 
      aiAssisted: true,
      teacherId: user?.id || '', 
      createdAt: new Date().toISOString(),
    });

    // Send notifications to students
    const studentIds: string[] = [];
    
    // Fetch fresh class data to ensure we have all student IDs
    if (classId) {
      const freshClass = await db.classes.get(classId);
      if (freshClass?.studentIds) {
        studentIds.push(...freshClass.studentIds);
      }
    } else {
      // Send to all my classes - fetch fresh data for each
      for (const c of myClasses) {
        const freshClass = await db.classes.get(c.id);
        if (freshClass?.studentIds) {
          studentIds.push(...freshClass.studentIds);
        }
      }
    }

    if (studentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(studentIds));
      
      // Notify Students (and Guardians automatically via mirroring)
      await createBulkNotifications(
        uniqueStudentIds,
        'student',
        'Nova Atividade! 📝',
        `O professor ${user?.name} salvou uma nova atividade de ${subjectLabel}: "${topic}".`,
        'info',
        'normal',
        '/student/activities'
      );
    }

    setSavedActivity(true);
    toast.success('Atividade salva! Aparecerá em "Banco de Atividades".');
  };

  const updateQuestion = (idx: number, q: Question) => {
    setGeneratedQuestions(prev => prev.map((old, i) => i === idx ? q : old));
  };

  const deleteQuestion = (idx: number) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
    toast.success('Questão removida.');
  };

  const addQuestion = (q: Question) => {
    setGeneratedQuestions(prev => [...prev, q]);
    setShowAddPanel(false);
  };

  const defaultQType = activityType === 'dissertativa' ? 'dissertativa' : 'objetiva';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-primary-400 shadow-2xl ring-8 ring-slate-50">
            <Wand2 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Criar com IA</h1>
            <p className="text-slate-500 font-medium">Gere e edite questões pedagógicas em segundos.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-2 rounded-2xl shadow-sm">
          <div className="bg-primary-50 text-primary-600 p-3 rounded-xl"><Zap size={20} fill="currentColor" /></div>
          <div className="pr-4">
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Créditos de IA</div>
            <div className="text-sm font-black text-slate-800">Ilimitados Premium</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Config Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-xl space-y-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 relative z-10">
              <BookOpen size={22} className="text-primary-500" /> Configuração Pedagógica
            </h2>

            {/* Activity Type */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo de Atividade</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACTIVITY_TYPES.map(t => {
                  const Icon = t.icon;
                  const isSelected = activityType === t.id;
                  return (
                    <button key={t.id} onClick={() => setActivityType(t.id)}
                      className={cn('p-4 rounded-2xl border-2 flex flex-col items-center gap-2.5 transition-all text-center relative overflow-hidden',
                        isSelected ? 'border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white')}>
                      {isSelected && <div className={`absolute inset-0 bg-gradient-to-br ${t.color} opacity-5`} />}
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                        isSelected ? `bg-gradient-to-br ${t.color} text-white shadow-md` : 'bg-slate-100 text-slate-400')}>
                        <Icon size={18} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider leading-tight">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 font-medium bg-slate-50 px-4 py-2.5 rounded-xl">
                💡 {ACTIVITY_TYPES.find(t => t.id === activityType)?.desc}
              </p>
            </div>

            {/* Subject + Grade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Disciplina Principal</label>
                <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner appearance-none"
                  value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="" disabled>Escolha a matéria...</option>
                  {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ano Escolar</label>
                <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner appearance-none"
                  value={grade} onChange={e => setGrade(e.target.value)}>
                  <option value="" disabled>Selecione o ano...</option>
                  {SCHOOL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Turma */}
            <div className="space-y-2 relative z-10">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                <GraduationCap size={12} /> Turma Destinatária
              </label>
              {myClasses.length === 0 ? (
                <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl px-5 py-3 text-sm font-bold">
                  Nenhuma turma vinculada. Solicite ao administrador.
                </div>
              ) : (
                <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner appearance-none"
                  value={classId} onChange={e => setClassId(e.target.value)}>
                  <option value="">— Todas as minhas turmas —</option>
                  {myClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade}) · {c.studentIds?.length || 0} alunos</option>)}
                </select>
              )}
            </div>

            {/* Topic */}
            <div className="space-y-2 relative z-10">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tópico Específico</label>
              <div className="relative">
                <MessageSquare size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input type="text" placeholder="Ex: Frações equivalentes, Sistemas do corpo humano..."
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-14 pr-6 py-4 text-slate-700 font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner"
                  value={topic} onChange={e => setTopic(e.target.value)} />
              </div>
            </div>

            {/* Duration + Difficulty + Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
              {/* Duration */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  <Clock size={11} /> Duração (minutos)
                </label>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={e => setDuration(e.target.value)}
                  placeholder="Ex: 45"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner text-sm" 
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nível de Desafio</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-transparent shadow-inner h-[56px]">
                  {['Fácil','Médio','Difícil'].map(lvl => (
                    <button key={lvl} onClick={() => setDifficulty(lvl)}
                      className={cn('flex-1 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all',
                        difficulty === lvl ? 'bg-white text-primary-600 shadow-md scale-[1.05]' : 'text-slate-400 hover:text-slate-600')}>
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                  Questões: <span className="text-slate-700">{quantity}</span>
                </label>
                <div className="flex items-center gap-4 bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3.5 shadow-inner h-[56px]">
                  <input type="range" min="3" max="30" step="1"
                    style={{ accentColor: 'var(--color-primary-500, #6366f1)' }}
                    className="flex-1 h-2 rounded-lg cursor-pointer bg-slate-200"
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                  <span className="w-8 text-center font-black text-slate-700 text-lg leading-none">{quantity}</span>
                </div>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!subject || !topic || !grade || isGenerating}
              className="w-full bg-slate-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-6 rounded-[1.5rem] transition-all shadow-2xl hover:shadow-primary-500/20 flex items-center justify-center gap-3 mt-2 text-lg relative overflow-hidden group">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div key="gen" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-20 }} className="flex items-center gap-3">
                    <div className="w-6 h-6 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" /> Criando Mágica...
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-20 }} className="flex items-center gap-3">
                    <Wand2 size={24} className="text-primary-400 group-hover:rotate-12 transition-transform" /> Gerar Atividade Inteligente
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* RIGHT: Preview + Questions Editor */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tip card */}
          <div className="bg-gradient-to-br from-primary-600 to-special-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <Sparkles className="absolute top-0 right-0 text-white/5 -mr-8 -mt-8" size={100} />
            <div className="relative z-10 space-y-4">
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center"><Zap size={22} className="text-warning-300" /></div>
              <h3 className="text-xl font-black">Dica do Mestre Capy</h3>
              <p className="text-white/80 font-medium leading-relaxed text-sm">
                Após gerar, você pode <span className="font-black bg-white/10 px-1 rounded">editar cada questão</span>, <span className="font-black bg-white/10 px-1 rounded">trocar alternativas</span> e <span className="font-black bg-white/10 px-1 rounded">adicionar novas</span> antes de salvar!
              </p>
              <div className="space-y-2 pt-2 border-t border-white/20">
                {[
                  { e: '✏️', t: 'Clique no lápis para editar qualquer questão' },
                  { e: '➕', t: 'Adicione questões manualmente após gerar' },
                  { e: '🗑️', t: 'Remova questões desnecessárias' },
                  { e: '🟢', t: 'Clique na letra para marcar a correta' },
                ].map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 text-white/70 text-xs font-medium">
                    <span>{tip.e}</span><span>{tip.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Generation progress */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,scale:0.9 }}
                className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-xl space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Cpu size={20} className="text-primary-500" /> Processando...
                </h3>
                <div className="space-y-5">
                  {generationSteps.map((s, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500',
                        i < step ? 'bg-success-50 text-success-600' : i === step ? 'bg-primary-50 text-primary-600 animate-pulse' : 'bg-slate-50 text-slate-300')}>
                        <s.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <div className={cn('text-xs font-black uppercase tracking-widest', i <= step ? 'text-slate-700' : 'text-slate-300')}>{s.label}</div>
                        {i === step && <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary-500 animate-pulse" style={{ width:'60%' }} /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* GENERATED: Summary + Save */}
            {generated && !isGenerating && (
              <motion.div initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }} className="space-y-4">
                <div className="bg-success-50 border-2 border-success-100 p-6 rounded-[2rem] shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-success-100 rounded-2xl flex items-center justify-center text-success-600"><Target size={24} /></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Pronto! 🎉</h3>
                      <p className="text-xs font-bold text-success-600 uppercase tracking-widest">
                        {generatedQuestions.length} questões · {ACTIVITY_TYPES.find(t => t.id === activityType)?.label}
                        {duration && ` · ${duration} min`}
                        {!duration && ' · Sem limite de tempo'}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-600 font-medium text-sm">
                    Atividade sobre <strong>{topic}</strong> para o <strong>{grade}</strong>, {difficulty.toLowerCase()} dificuldade.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSave} disabled={savedActivity}
                      className={cn('flex-1 font-black py-3 rounded-2xl transition-all shadow flex items-center justify-center gap-2 text-sm',
                        savedActivity ? 'bg-success-100 text-success-600 cursor-default' : 'bg-slate-900 text-white hover:bg-black')}>
                      {savedActivity ? <><Check size={16}/> Salvo!</> : <><Save size={16}/> Salvar Atividade</>}
                    </button>
                    <button onClick={() => { const text = generatedQuestions.map(q => `${q.text}\n${q.options?.join('\n') || ''}\nResposta: ${q.answer||''}`).join('\n\n---\n\n'); navigator.clipboard.writeText(text); toast.success('Atividade copiada!'); }}
                      className="p-3 border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 hover:border-slate-200 transition-all" title="Copiar tudo">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                {/* Questions Editor */}
                <div className="bg-white border-2 border-slate-50 rounded-[2rem] overflow-hidden shadow-md">
                  <button
                    onClick={() => setShowQuestionsPanel(v => !v)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                        <Edit2 size={16} />
                      </div>
                      <span className="font-black text-slate-800 text-sm">
                        Questões Geradas
                        <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {generatedQuestions.length} questão{generatedQuestions.length !== 1 ? 'ões' : ''}
                        </span>
                      </span>
                    </div>
                    {showQuestionsPanel ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </button>

                  <AnimatePresence>
                    {showQuestionsPanel && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden">
                        <div className="px-5 pb-5 space-y-3 max-h-[500px] overflow-y-auto">
                          {generatedQuestions.map((q, i) => (
                            <QuestionEditor
                              key={q.id}
                              q={q}
                              idx={i}
                              onUpdate={updated => updateQuestion(i, updated)}
                              onDelete={() => deleteQuestion(i)}
                              isEditing={editingIdx === i}
                              onToggleEdit={() => { setEditingIdx(editingIdx === i ? null : i); setShowAddPanel(false); }}
                            />
                          ))}

                          {generatedQuestions.length === 0 && (
                            <div className="text-center py-6 text-slate-400 font-medium text-sm">
                              Todas as questões foram removidas. Adicione novas abaixo.
                            </div>
                          )}

                          {/* Add question */}
                          <AnimatePresence>
                            {showAddPanel && (
                              <AddQuestionPanel
                                defaultType={defaultQType}
                                onAdd={addQuestion}
                                onCancel={() => setShowAddPanel(false)}
                              />
                            )}
                          </AnimatePresence>

                          {!showAddPanel && (
                            <button
                              onClick={() => { setShowAddPanel(true); setEditingIdx(null); }}
                              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-primary-400 text-slate-400 hover:text-primary-500 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                              <Plus size={16} /> Adicionar Questão
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
