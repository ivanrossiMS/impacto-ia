import React, { useState } from 'react';
import { 
  Zap, Search, BookOpen, Target, 
  ChevronRight, Trash2, Edit3, 
  Sparkles, Layers, GraduationCap, Calendar,
  AlertCircle, Trophy, X, CheckCircle2, History,
  BrainCircuit, Upload, FileSpreadsheet, ArrowRight, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { createBulkNotifications } from '../../lib/notificationUtils';
import { callAI, callGenerateTrailStep } from '../../ai/client';
import { useAuthStore } from '../../store/auth.store';
import { read, utils } from 'xlsx';

// ── Grade normalization ────────────────────────────────────────────────────────
// Returns canonical: "1º Ano"..."9º Ano" (EF) or "1º EM"..."3º EM" (EM).
// Key rule: presence of "EM" in the string → Ensino Médio.
const normalizeGrade = (g: string): string => {
  if (!g) return '';
  const s = g.trim().toUpperCase();
  // Ensino Médio: string contains the letters E-M together
  if (s.includes('EM')) {
    const m = s.match(/[123]/);
    return (m ? m[0] : '1') + 'º EM';
  }
  // Ensino Fundamental: extract first digit 1-9
  const m = s.match(/([1-9])/);
  if (m) return m[1] + 'º Ano';
  return g.trim();
};

// ── Constants ──────────────────────────────────────────────────────────────────
const PHASE_TYPES = [
  { type: 'intro',    label: 'Explicação' },
  { type: 'video',    label: 'Conteúdo' },
  { type: 'quiz',     label: 'Quiz' },
  { type: 'practice', label: 'Prática' },
  { type: 'boss',     label: 'Desafio Final' },
];

const SUBJECTS = [
  'Português', 'Matemática', 'História', 'Geografia', 'Ciências',
  'Ed. Física', 'Artes', 'Inglês', 'Filosofia', 'Sociologia',
];

const GRADES = [
  '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
  '1º EM', '2º EM', '3º EM',
];

// ── CurricularImportModal: XLSX → AI Trail Generator ─────────────────────────
const CurricularImportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: { grade: string; subject: string; topic: string }[]) => void;
}> = ({ isOpen, onClose, onImport }) => {
  const [rows, setRows] = useState<{ grade: string; subject: string; topic: string }[]>([]);
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: string[][] = utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
      // Auto-detect header row vs data (skip rows where first col looks like a header)
      const data = json.filter(r => r.length >= 3 && r[0] && typeof r[0] === 'string' && !r[0].toLowerCase().includes('série') && !r[0].toLowerCase().includes('serie'));
      const parsed = data.map(r => ({
        grade: String(r[0] || '').trim(),
        subject: String(r[1] || '').trim(),
        topic: String(r[2] || '').trim(),
      })).filter(r => r.grade && r.subject && r.topic);
      setRows(parsed);
      if (parsed.length === 0) toast.error('Nenhuma linha válida encontrada. Use colunas: Série | Disciplina | Tópico');
      else toast.success(`${parsed.length} linha(s) importadas!`);
    } catch {
      toast.error('Erro ao processar o arquivo. Certifique-se de que é um arquivo .xlsx ou .xls válido.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) parseFile(file);
    else toast.error('Use um arquivo .xlsx ou .xls');
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><FileSpreadsheet size={28} /></div>
            <div>
              <h2 className="text-2xl font-black">Importar Grade Curricular</h2>
              <p className="text-white/70 text-sm mt-0.5">Carregue um .xlsx e a IA gera as trilhas automaticamente</p>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn('border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer', isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30')}
            onClick={() => document.getElementById('xls-file-input')?.click()}
          >
            <input id="xls-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            <Upload size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-black text-slate-600">Arraste o arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-slate-400 mt-1">Formato: Coluna A = Série &bull; Coluna B = Disciplina &bull; Coluna C = Tópico/Tema</p>
            {fileName && <p className="text-emerald-600 font-bold text-sm mt-3 flex items-center justify-center gap-1"><CheckCircle size={14} /> {fileName}</p>}
          </div>

          {/* Template download hint */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-500">
            <span className="font-black text-slate-700">Formato esperado: </span>Série (1º Ano, 2º EM...) │ Disciplina (Matemática...) │ Tópico (Frações...)
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>{['Série', 'Disciplina', 'Tópico'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400 tracking-widest">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-2 font-bold text-slate-700 text-xs">{r.grade}</td>
                      <td className="px-4 py-2 text-slate-600 text-xs">{r.subject}</td>
                      <td className="px-4 py-2 text-slate-600 text-xs">{r.topic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              className="flex-[2] rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 border-0"
              disabled={rows.length === 0 || isParsing}
              onClick={() => { onImport(rows); onClose(); }}
            >
              {isParsing ? 'Processando...' : <><ArrowRight size={16} className="mr-2" />Gerar {rows.length} Trilha{rows.length !== 1 ? 's' : ''} com IA</>}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AIGeneratorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: any) => void;
  classes: any[];
  schools: any[];
  isAdminMaster?: boolean;
}> = ({ isOpen, onClose, onGenerate, classes, schools, isAdminMaster }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPhases, setGeneratedPhases] = useState(0);
  const [formData, setFormData] = useState({
    subject: '',
    topic: '',
    grade: '',
    difficulty: 'medium'
  });
  const [selectedClassId, setSelectedClassId] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Unique school years from the classes list
  const yearOptionsAI = Array.from(new Set(classes.map(c => c.year || c.schoolYear).filter(Boolean))).sort().reverse();

  // Filter classes by grade match + school filter + year filter
  const filteredClassesAI = classes.filter(c => {
    const matchGrade = !formData.grade || normalizeGrade(c.grade || '') === normalizeGrade(formData.grade);
    const matchSchool = !schoolFilter || c.schoolId === schoolFilter;
    const matchYear = !yearFilter || (c.year || c.schoolYear || '') === yearFilter;
    return matchGrade && matchSchool && matchYear;
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
        classId: selectedClassId || null,
        isAIGenerated: true,
        createdAt: new Date().toISOString()
      };

      onGenerate(newTrail);
      setSelectedClassId('');
      setSchoolFilter('');
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
                    {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º EM', '2º EM', '3º EM'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              {/* ── Vincular Turma (Opcional) ─────────── */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Vincular Turma (Opcional)</label>
                  {selectedClassId && (
                    <button onClick={() => setSelectedClassId('')} className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 transition-colors">✕ Remover</button>
                  )}
                </div>
                {isAdminMaster && schools.length > 0 && (
                  <select
                    value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setSelectedClassId(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-primary-400 transition-colors"
                  >
                    <option value="">Todas as escolas</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                {/* Ano letivo filter */}
                {yearOptionsAI.length > 0 && (
                  <select
                    value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSelectedClassId(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-primary-400 transition-colors"
                  >
                    <option value="">📅 Todos os anos letivos</option>
                    {yearOptionsAI.map(y => <option key={y} value={y}>📅 Ano Letivo: {y}</option>)}
                  </select>
                )}
                <select
                  value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-primary-400 transition-colors"
                >
                  <option value="">Sem turma (livremente acessível)</option>
                  {filteredClassesAI.length === 0 && formData.grade && (
                    <option disabled>Nenhuma turma com essa série</option>
                  )}
                  {filteredClassesAI.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.grade}</option>
                  ))}
                </select>
                {selectedClassId && (
                  <p className="text-[10px] text-emerald-600 font-black ml-1 uppercase tracking-wide flex items-center gap-1">
                    <GraduationCap size={11} /> Alunos serão notificados automaticamente
                  </p>
                )}
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

const BulkAIGeneratorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onBulkGenerate: (trails: any[]) => void;
  classes: any[];
  schools: any[];
  isAdminMaster?: boolean;
}> = ({ isOpen, onClose, onBulkGenerate, classes, schools, isAdminMaster }) => {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTrail, setCurrentTrail] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [status, setStatus] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Unique school years for the year filter
  const yearOptionsBulk = Array.from(new Set(classes.map(c => c.year || c.schoolYear).filter(Boolean))).sort().reverse();

  // Filter classes by grade match + school filter + year filter
  const filteredClassesBulk = classes.filter(c => {
    const matchGrade = !grade || normalizeGrade(c.grade || '') === normalizeGrade(grade);
    const matchSchool = !schoolFilter || c.schoolId === schoolFilter;
    const matchYear = !yearFilter || (c.year || c.schoolYear || '') === yearFilter;
    return matchGrade && matchSchool && matchYear;
  });

  // Derived: when "all" is selected, cap slider at 3, show real total
  const isAllSubjects = subject === 'all';
  const activeSubjects = isAllSubjects ? SUBJECTS : (subject ? [subject] : []);
  const maxQty = isAllSubjects ? 3 : 10;
  const totalTrails = activeSubjects.length * quantity;

  // ── Retry helper: retries fn up to maxAttempts times on failure ─────────────
  const withRetry = async (fn: () => Promise<any>, maxAttempts = 3, delayMs = 2000): Promise<any> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (attempt < maxAttempts) {
          const wait = delayMs * attempt; // 2s, 4s, 6s
          setStatus(prev => prev + ` (retry ${attempt}/${maxAttempts - 1}, aguardando ${wait / 1000}s...)`);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    throw lastErr;
  };

  // ── Core function to generate N trails for a SINGLE subject ──────────────
  const generateForSubject = async (
    subj: string,
    qty: number,
    existingTitles: string[],
    accumulatedTitles: string[],
    subjectIndex: number,
    subjectTotal: number,
  ): Promise<any[]> => {
    const forbiddenBase = [...existingTitles, ...accumulatedTitles];
    const forbiddenNote = forbiddenBase.length > 0
      ? `\n\nATENÇÃO CRÍTICO: As trilhas abaixo JÁ EXISTEM no sistema. É PROIBIDO gerar conteúdo igual, similar ou que sobreponha qualquer um desses tópicos:\n${forbiddenBase.map(t => `- "${t}"`).join('\n')}`
      : '';

    const topicsPrompt = `Você é um especialista em currículo escolar brasileiro (BNCC).
Gere exatamente ${qty} tópicos/temas distintos e progressivos para trilhas de aprendizagem da disciplina "${subj}" para a série "${grade}" do Ensino Básico/Médio.
Regras obrigatórias:
- Cada tópico deve ser diferente e não repetitivo
- Respeitar rigorosamente o currículo da BNCC para ${grade}
- Progressividade: do mais simples ao mais complexo
- Cada tópico deve ser uma string curta e descritiva (ex: "Frações Equivalentes")${forbiddenNote}
Retorne APENAS um array JSON com ${qty} strings. Exemplo: ["Tópico 1", "Tópico 2", ...]`;

    let topics: string[] = [];
    try {
      setStatus(`[${subjectIndex}/${subjectTotal}] Analisando currículo BNCC: ${subj}...`);
      const raw = await withRetry(async () => {
        const res = await fetch('/.netlify/functions/ai-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: 'generate-topics', prompt: topicsPrompt }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      });
      const match = raw.match(/\[.*\]/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) topics = parsed.slice(0, qty);
      }
    } catch (_) { /* fallback below */ }

    while (topics.length < qty) {
      topics.push(`${subj} - Tópico ${topics.length + 1} (${grade})`);
    }

    const generated: any[] = [];

    for (let i = 0; i < qty; i++) {
      const topic = topics[i];
      const allForbidden = [...forbiddenBase, ...accumulatedTitles, ...generated.map(g => g.title)];
      const batchForbiddenNote = allForbidden.length > 0
        ? `\n\nATENÇÃO CRÍTICO: NÃO gere conteúdo igual ou similar a:\n${allForbidden.map(t => `- "${t}"`).join('\n')}`
        : '';
      const topicWithContext = topic + batchForbiddenNote;

      setCurrentTrail(i + 1);
      setCurrentPhase(0);
      setStatus(`[${subjectIndex}/${subjectTotal}] ${subj} — Trilha ${i + 1}/${qty}: "${topic}"...`);

      try {
        // Generate meta with retry
        const metaRes = await withRetry(() => callAI({
          feature: 'generate-trail-meta',
          topic: topicWithContext,
          subject: subj,
          grade,
        }));
        const meta = (metaRes as any).result || metaRes;

        // Generate each step sequentially with retry to avoid overwhelming the API
        const steps: any[] = [];
        for (let phaseIdx = 0; phaseIdx < PHASE_TYPES.length; phaseIdx++) {
          const phase = PHASE_TYPES[phaseIdx];
          const step = await withRetry(() => callGenerateTrailStep({
            topic: topicWithContext,
            subject: subj,
            grade,
            difficulty: 'medium',
            phaseIndex: phaseIdx,
            phaseType: phase.type,
          }));
          setCurrentPhase(prev => prev + 1);
          steps.push(step);
        }

        generated.push({
          id: crypto.randomUUID(),
          title: (meta as any).title || topic,
          description: (meta as any).description || '',
          rewardXp: (meta as any).rewardXp || 600,
          rewardCoins: (meta as any).rewardCoins || 250,
          steps: steps.map((s, si) => ({ ...s, id: String(si + 1) })),
          subject: subj,
          grade,
          difficulty: 'medium',
          classId: selectedClassId || null,
          isAIGenerated: true,
          createdAt: new Date().toISOString(),
        });
        setTotalGenerated(prev => prev + 1);
      } catch (err: any) {
        toast.error(`Erro na trilha "${topic}" após 3 tentativas: ${err.message || 'timeout'}`);
      }
    }

    return generated;
  };

  const handleGenerate = async () => {
    if (!grade || !subject) {
      toast.error('Selecione a série e a disciplina.');
      return;
    }

    setIsGenerating(true);
    setCurrentTrail(0);
    setCurrentPhase(0);
    setCurrentSubjectIdx(0);
    setTotalGenerated(0);

    // Fetch existing trails once for the whole batch
    const { data: existingTrailsData } = await supabase.from('learning_paths').select('title');
    const existingTitles = (existingTrailsData || []).map((t: any) => t.title).filter(Boolean);

    const subjectsToProcess = isAllSubjects ? SUBJECTS : [subject];
    const allGenerated: any[] = [];

    for (let si = 0; si < subjectsToProcess.length; si++) {
      const subj = subjectsToProcess[si];
      setCurrentSubjectIdx(si + 1);
      setCurrentTrail(0);
      setCurrentPhase(0);

      const results = await generateForSubject(
        subj,
        quantity,
        existingTitles,
        allGenerated.map(g => g.title),
        si + 1,
        subjectsToProcess.length,
      );
      allGenerated.push(...results);
    }

    onBulkGenerate(allGenerated);
    onClose();
    toast.success(`${allGenerated.length} trilha(s) gerada(s) com sucesso! ✨`);
    setIsGenerating(false);
    setCurrentTrail(0);
    setCurrentPhase(0);
    setCurrentSubjectIdx(0);
    setTotalGenerated(0);
    setStatus('');
    setGrade('');
    setSubject('');
    setQuantity(1);
    setSelectedClassId('');
    setSchoolFilter('');
    setYearFilter('');
  };

  if (!isOpen) return null;

  // Progress calculation accounts for multi-subject mode
  // subjectsToProcess drives the progress bar (derived from isAllSubjects)
  const totalPhasesOverall = totalTrails * 5;
  const donePhasesOverall =
    (currentSubjectIdx > 1 ? (currentSubjectIdx - 1) * quantity * 5 : 0) +
    (currentTrail > 0 ? (currentTrail - 1) * 5 : 0) +
    currentPhase;
  const overallPct = totalPhasesOverall > 0 ? Math.round((donePhasesOverall / totalPhasesOverall) * 100) : 0;

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
                  <span>{isAllSubjects ? `Disciplina ${currentSubjectIdx}/${SUBJECTS.length} · Trilha ${currentTrail}/${quantity}` : `Trilha ${currentTrail}/${quantity}`}</span>
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
                <p className="text-center text-[10px] text-slate-400 font-bold">{currentPhase}/5 fases da trilha atual · {totalGenerated}/{totalTrails} trilhas concluídas</p>
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
                  value={subject} onChange={e => { setSubject(e.target.value); if (e.target.value === 'all' && quantity > 3) setQuantity(3); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-400 transition-colors"
                >
                  <option value="">Selecione a disciplina...</option>
                  <option value="all">✨ TODAS AS DISCIPLINAS ({SUBJECTS.length} matérias)</option>
                  <option disabled>──────────────</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {isAllSubjects && (
                  <p className="text-[10px] font-black text-indigo-600 ml-1 mt-1 uppercase tracking-wide">
                    IA gerará trilhas para todas as {SUBJECTS.length} disciplinas automaticamente
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">
                  {isAllSubjects ? 'Trilhas por Disciplina' : 'Quantidade de Trilhas'}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min={1} max={maxQty} value={Math.min(quantity, maxQty)}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <div className="w-14 h-14 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-700">
                    {quantity}
                  </div>
                </div>
                {isAllSubjects ? (
                  <p className="text-[10px] text-indigo-600 font-black ml-1">
                    {SUBJECTS.length} disciplinas × {quantity} trilha{quantity > 1 ? 's' : ''} = <strong>{totalTrails} trilhas no total</strong> &bull; ~{Math.ceil(totalTrails * 0.5)} min
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-bold ml-1">≈ {quantity * 5} fases no total &bull; Tempo estimado: ~{Math.ceil(quantity * 0.5)} min</p>
                )}
              </div>

              {/* Info box */}
              {grade && subject && (
                <div className={cn("border rounded-2xl p-4 flex items-start gap-3", isAllSubjects ? "bg-purple-50 border-purple-100" : "bg-indigo-50 border-indigo-100")}>
                  <BrainCircuit size={18} className={cn("mt-0.5 flex-shrink-0", isAllSubjects ? "text-purple-500" : "text-indigo-500")} />
                  <p className={cn("text-xs font-bold leading-relaxed", isAllSubjects ? "text-purple-700" : "text-indigo-700")}>
                    {isAllSubjects
                      ? <>A IA irá analisar o currículo BNCC para <strong>{grade}</strong> em <strong>todas as {SUBJECTS.length} disciplinas</strong>, gerando {quantity} trilha{quantity > 1 ? 's' : ''} pedagógica{quantity > 1 ? 's' : ''} distinta{quantity > 1 ? 's' : ''} por matéria — <strong>{totalTrails} trilhas completas no total</strong>.</>
                      : <>A IA irá analisar o currículo BNCC para <strong>{grade}</strong> em <strong>{subject}</strong>, gerar {quantity} tópico{quantity > 1 ? 's' : ''} progressivo{quantity > 1 ? 's' : ''} distinto{quantity > 1 ? 's' : ''} e criar trilhas pedagógicas completas com teoria, prática e quiz para cada fase.</>
                    }
                  </p>
                </div>
              )}

              {/* ── Vincular Turma (Opcional) ─────────── */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Vincular Turma (Opcional)</label>
                  {selectedClassId && (
                    <button onClick={() => setSelectedClassId('')} className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 transition-colors">✕ Remover</button>
                  )}
                </div>
                {isAdminMaster && schools.length > 0 && (
                  <select
                    value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setSelectedClassId(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-indigo-400 transition-colors"
                  >
                    <option value="">Todas as escolas</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                {/* Ano letivo filter */}
                {yearOptionsBulk.length > 0 && (
                  <select
                    value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSelectedClassId(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-indigo-400 transition-colors"
                  >
                    <option value="">📅 Todos os anos letivos</option>
                    {yearOptionsBulk.map(y => <option key={y} value={y}>📅 Ano Letivo: {y}</option>)}
                  </select>
                )}
                <select
                  value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none text-sm focus:border-indigo-400 transition-colors"
                >
                  <option value="">Sem turma (livremente acessível)</option>
                  {filteredClassesBulk.length === 0 && grade && (
                    <option disabled>Nenhuma turma com essa série</option>
                  )}
                  {filteredClassesBulk.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.grade}</option>
                  ))}
                </select>
                {selectedClassId && (
                  <p className="text-[10px] text-emerald-600 font-black ml-1 uppercase tracking-wide flex items-center gap-1">
                    <GraduationCap size={11} /> Alunos serão notificados ao concluir a geração
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
                <Button
                  disabled={!grade || !subject}
                  variant="primary"
                  className="flex-[2] rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 border-0"
                  onClick={handleGenerate}
                >
                  <Sparkles size={16} className="mr-2" />
                  {isAllSubjects
                    ? `Gerar ${totalTrails} Trilhas (Todas as Matérias)`
                    : `Gerar ${quantity} Trilha${quantity > 1 ? 's' : ''} com IA`
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ── TrailDetailModal ───────────────────────────────────────────────────────────
const TrailDetailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void }> = ({ trail, isOpen, onClose }) => {
  if (!isOpen || !trail) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white rounded-t-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><X size={18} /></button>
          <div className="relative z-10">
            <Badge variant="ai" className="mb-3 bg-primary-500/20 border-primary-400/30 text-primary-300 text-[9px] uppercase tracking-widest">{trail.subject || 'Trilha IA'}</Badge>
            <h2 className="text-2xl font-black tracking-tight mb-2">{trail.title}</h2>
            <p className="text-slate-400 text-sm">{trail.description}</p>
            <div className="flex items-center gap-4 mt-4 text-xs font-bold text-slate-400">
              {trail.grade && <span className="flex items-center gap-1"><GraduationCap size={12} />{normalizeGrade(trail.grade)}</span>}
              {trail.difficulty && <span className="flex items-center gap-1"><Target size={12} />{trail.difficulty}</span>}
              <span className="flex items-center gap-1"><Trophy size={12} />{trail.rewardXp || 0} XP</span>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Etapas da Trilha</h3>
          {(trail.steps || []).map((step: any, i: number) => (
            <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 bg-primary-500 text-white rounded-xl flex items-center justify-center font-black text-xs shrink-0">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-800 text-sm">{step.title}</p>
                {step.content && <p className="text-slate-500 text-xs mt-1 line-clamp-3">{step.content}</p>}
                {step.question && <p className="text-primary-600 text-xs mt-1 font-bold italic">❓ {step.question}</p>}
              </div>
            </div>
          ))}
          {(!trail.steps || trail.steps.length === 0) && (
            <p className="text-center text-slate-400 py-8">Nenhuma etapa disponível.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ── EditTrailModal ─────────────────────────────────────────────────────────────
const EditTrailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onSave: (data: any) => void }> = ({ trail, isOpen, onClose, onSave }) => {
  const [form, setForm] = React.useState({ title: '', description: '', subject: '', grade: '', difficulty: 'medium' });
  React.useEffect(() => {
    if (trail) setForm({ title: trail.title || '', description: trail.description || '', subject: trail.subject || '', grade: trail.grade || '', difficulty: trail.difficulty || 'medium' });
  }, [trail]);
  if (!isOpen || !trail) return null;
  const GRADES_EDIT = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º EM', '2º EM', '3º EM'];
  const SUBJECTS_EDIT = ['Português', 'Matemática', 'História', 'Geografia', 'Ciências', 'Ed. Física', 'Artes', 'Inglês', 'Filosofia', 'Sociologia'];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white">
          <Edit3 className="mb-3 text-indigo-200" size={28} />
          <h2 className="text-xl font-black">Editar Trilha</h2>
        </div>
        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400">Título</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none focus:border-primary-300" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400">Descrição</label>
            <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none focus:border-primary-300 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Disciplina</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none appearance-none" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>
                <option value="">Selecione</option>
                {SUBJECTS_EDIT.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Série</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none appearance-none" value={form.grade} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}>
                <option value="">Selecione</option>
                {GRADES_EDIT.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" className="flex-1 rounded-2xl" onClick={() => { onSave({ id: trail.id, ...form }); onClose(); }}>
              <CheckCircle2 size={16} className="mr-2" /> Salvar
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── LinkClassModal ─────────────────────────────────────────────────────────────
const LinkClassModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onLink: (classId: string, year: string) => void }> = ({ trail, isOpen, onClose, onLink }) => {
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [yearFilter, setYearFilter] = React.useState('');
  const [classes, setClasses] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (isOpen) {
      supabase.from('classes').select('*').then(({ data }) => { if (data) setClasses(data); });
      setSelectedClassId(trail?.classId || '');
      setYearFilter('');
    }
  }, [isOpen, trail]);
  if (!isOpen || !trail) return null;

  // Unique school years from loaded classes
  const yearOptionsLink = Array.from(new Set(classes.map(c => c.year || c.schoolYear).filter(Boolean))).sort().reverse();

  // Filter classes by year if selected
  const filteredClassesLink = classes.filter(c => {
    const matchYear = !yearFilter || (c.year || c.schoolYear || '') === yearFilter;
    return matchYear;
  });

  const selectedClass = filteredClassesLink.find(c => c.id === selectedClassId)
    || classes.find(c => c.id === selectedClassId); // fallback: find in all

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white">
          <Target className="mb-3 text-emerald-200" size={28} />
          <h2 className="text-xl font-black">Vincular Turma</h2>
          <p className="text-emerald-100/80 text-sm mt-1 font-medium">"{trail.title}"</p>
        </div>
        <div className="p-8 space-y-3">
          {/* Ano letivo filter */}
          {yearOptionsLink.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">📅 Ano Letivo</label>
              <select
                value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSelectedClassId(''); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none appearance-none focus:border-emerald-300 transition-colors text-sm"
              >
                <option value="">Todos os anos letivos</option>
                {yearOptionsLink.map(y => <option key={y} value={y}>📅 {y}</option>)}
              </select>
            </div>
          )}

          {/* Class selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">
              🎓 Turma {yearFilter ? `— ${yearFilter}` : ''}
              <span className="ml-2 text-slate-300 normal-case font-medium">({filteredClassesLink.length} disponíve{filteredClassesLink.length !== 1 ? 'is' : 'l'})</span>
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none appearance-none focus:border-emerald-300 transition-colors text-sm"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              <option value="">Nenhuma (desvincular)</option>
              {filteredClassesLink.length === 0 && yearFilter && (
                <option disabled>Nenhuma turma neste ano letivo</option>
              )}
              {filteredClassesLink.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.grade ? `— ${normalizeGrade(c.grade)}` : ''} {c.year ? `(${c.year})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected class preview */}
          {selectedClass && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
              <div>
                <p className="font-black text-emerald-800 text-sm">{selectedClass.name}</p>
                <p className="text-emerald-600 text-[10px] font-bold uppercase">
                  {normalizeGrade(selectedClass.grade || '')} · {selectedClass.year || 'Ano não informado'} · {(selectedClass.studentIds || []).length} aluno(s)
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border-0" onClick={() => { onLink(selectedClassId, selectedClass?.year || ''); onClose(); }}>
              <Target size={16} className="mr-2" /> Vincular
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Page ---

export const AdminLearningTrails: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = !!(user as any)?.isMaster;

  const [showAIModal, setShowAIModal] = useState(false);
  const [showBulkAIModal, setShowBulkAIModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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
  const [schools, setSchools] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // ── Fetch helpers (called on mount + by realtime) ──────────────────────────
  const fetchTrails = React.useCallback(async () => {
    const { data } = await supabase.from('learning_paths').select('*');
    if (data) setTrails(data);
  }, []);

  const fetchClasses = React.useCallback(async () => {
    const { data } = await supabase.from('classes').select('*');
    if (data) setClasses(data);
  }, []);

  const fetchSchools = React.useCallback(async () => {
    const { data } = await supabase.from('schools').select('*');
    if (data) setSchools(data);
  }, []);

  const fetchStudents = React.useCallback(async () => {
    const { data } = await supabase.from('users').select('id, classId').eq('role', 'student');
    if (data) setStudents(data);
  }, []);

  React.useEffect(() => {
    fetchTrails();
    fetchClasses();
    fetchSchools();
    fetchStudents();

    // Realtime: learning_paths changes → always refetch for accuracy
    const trailsCh = supabase
      .channel('admin_trails_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learning_paths' }, fetchTrails)
      .subscribe();

    // Realtime: classes changes (vinculo de turmas) → refetch classes
    const classesCh = supabase
      .channel('admin_classes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, fetchClasses)
      .subscribe();

    // Realtime: users changes → refetch students for engagement
    const usersCh = supabase
      .channel('admin_users_trails_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchStudents)
      .subscribe();

    return () => {
      supabase.removeChannel(trailsCh);
      supabase.removeChannel(classesCh);
      supabase.removeChannel(usersCh);
    };
  }, [fetchTrails, fetchClasses, fetchSchools, fetchStudents]);

  const filteredTrails = trails.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
    const matchYear = !filterYear || (t.schoolYear || '') === filterYear;
    const matchSubject = !filterSubject || (t.subject || '') === filterSubject;
    const matchGrade = !filterGrade || normalizeGrade(t.grade || '') === normalizeGrade(filterGrade);
    return matchSearch && matchYear && matchSubject && matchGrade;
  });

  // Dynamic options derived from loaded data
  const yearOptions = Array.from(new Set(trails.map(t => t.schoolYear).filter(Boolean))).sort();
  const subjectOptions = Array.from(new Set(trails.map(t => t.subject).filter(Boolean))).sort();
  const gradeOptions = Array.from(new Set(trails.map(t => normalizeGrade(t.grade || '')).filter(Boolean))).sort((a, b) => {
    const emA = a.includes('EM'), emB = b.includes('EM');
    if (emA !== emB) return emA ? 1 : -1;
    return a.localeCompare(b, 'pt-BR');
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Excluir esta trilha permanentemente?')) {
      // Optimistic: remove from UI immediately
      setTrails(prev => prev.filter(t => t.id !== id));
      const { error } = await supabase.from('learning_paths').delete().eq('id', id);
      if (error) {
        toast.error('Erro ao excluir trilha.');
        fetchTrails(); // rollback
      } else {
        toast.success('Trilha removida');
      }
    }
  };

  const handleUpdateTrail = async (data: any) => {
    if (!data.id) return;
    // Optimistic: update UI immediately
    setTrails(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
    const { error } = await supabase.from('learning_paths').update(data).eq('id', data.id);
    if (error) {
      toast.error('Erro ao atualizar trilha.');
      fetchTrails(); // rollback
    } else {
      toast.success('Trilha atualizada com sucesso!');
    }
  };

  const handleLinkTrail = async (classId: string, year: string) => {
    if (!trailToLink) return;
    // Optimistic: reflect link immediately
    setTrails(prev => prev.map(t => t.id === trailToLink.id ? { ...t, classId, schoolYear: year } : t));
    const { error: linkError } = await supabase.from('learning_paths').update({ classId, schoolYear: year }).eq('id', trailToLink.id);
    if (linkError) { toast.error('Erro ao vincular turma.'); fetchTrails(); return; }
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
           <Button variant="outline" className="rounded-2xl border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setShowImportModal(true)}><FileSpreadsheet className="mr-2" size={18} />Importar Grade XLSX</Button>
           <Button variant="outline" className="rounded-2xl border-2 border-slate-200" onClick={() => setShowAIModal(true)}><Zap className="mr-2 text-amber-500" size={18} />Gerar individual com IA</Button>
           <Button variant="primary" className="rounded-2xl px-8 bg-gradient-to-r from-indigo-600 to-purple-600 border-0" onClick={() => setShowBulkAIModal(true)}><Layers size={18} className="mr-2" /> Criar em lote com IA</Button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total de Trilhas', val: filteredTrails.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Classes Atendidas', val: Array.from(new Set(filteredTrails.map(t => t.classId).filter(Boolean))).length, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'IA Generated', val: filteredTrails.filter(t => t.isAIGenerated).length, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
          (() => {
            // Engajamento real: alunos que pertencem a uma turma que tem trilha vinculada
            const classIdsWithTrail = new Set(trails.filter(t => t.classId).map(t => t.classId));
            const totalStudents = students.length;
            const engagedStudents = students.filter((s: any) => s.classId && classIdsWithTrail.has(s.classId)).length;
            const pct = totalStudents > 0 ? Math.round((engagedStudents / totalStudents) * 100) : 0;
            return { label: 'Engajamento', val: `${pct}%`, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' };
          })(),
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
      <AIGeneratorModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        classes={classes}
        schools={schools}
        isAdminMaster={isAdminMaster}
        onGenerate={async (t) => {
          // Optimistic: add to UI immediately
          setTrails(prev => [t, ...prev]);
          const { error } = await supabase.from('learning_paths').insert(t);
          if (error) { toast.error('Erro ao salvar trilha.'); fetchTrails(); return; }
          toast.success('Trilha gerada com sucesso! ✨');
          // If linked to a class, notify students
          if (t.classId) {
            const cls = classes.find(c => c.id === t.classId);
            if (cls?.studentIds?.length > 0) {
              await createBulkNotifications(
                cls.studentIds, 'student',
                'Nova Trilha de Aprendizagem! 🚀',
                `Uma nova trilha foi liberada para sua turma: "${t.title}".`,
                'success', 'high', '/student/learning'
              );
            }
          }
        }}
      />
      <BulkAIGeneratorModal
        isOpen={showBulkAIModal}
        onClose={() => setShowBulkAIModal(false)}
        classes={classes}
        schools={schools}
        isAdminMaster={isAdminMaster}
        onBulkGenerate={async (newTrails) => {
          if (newTrails.length === 0) return;
          // Optimistic: add all to UI immediately
          setTrails(prev => [...newTrails, ...prev]);
          // Chunk inserts (Supabase limit)
          const chunkSize = 50;
          let saveError = false;
          for (let i = 0; i < newTrails.length; i += chunkSize) {
            const chunk = newTrails.slice(i, i + chunkSize);
            const { error } = await supabase.from('learning_paths').insert(chunk);
            if (error) {
              toast.error('Erro ao salvar trilhas: ' + error.message);
              fetchTrails();
              saveError = true;
              break;
            }
          }
          if (saveError) return;
          toast.success(`${newTrails.length} trilha(s) salva(s) com sucesso! ✨`);
          // Notify students if a class was linked (send one notification per class)
          const linkedClassId = newTrails[0]?.classId;
          if (linkedClassId) {
            const cls = classes.find(c => c.id === linkedClassId);
            if (cls?.studentIds?.length > 0) {
              await createBulkNotifications(
                cls.studentIds, 'student',
                'Novas Trilhas de Aprendizagem! 🚀',
                `${newTrails.length} novas trilhas foram liberadas para sua turma!`,
                'success', 'high', '/student/learning'
              );
            }
          }
        }}
      />
      <CurricularImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={async (rows) => {
          if (rows.length === 0) return;
          toast('🤖 Gerando trilhas a partir da grade...', { description: `${rows.length} linha(s) encontradas. Isso pode levar alguns minutos.`, duration: 5000 });
          const generated: any[] = [];
          for (const row of rows) {
            try {
              const [metaRes, ...steps] = await Promise.all([
                callAI({ feature: 'generate-trail-meta', topic: row.topic, subject: row.subject, grade: row.grade }),
                ...(['intro','video','quiz','practice','boss'] as const).map((type, idx) =>
                  callGenerateTrailStep({ topic: row.topic, subject: row.subject, grade: row.grade, difficulty: 'medium', phaseIndex: idx, phaseType: type })
                ),
              ]);
              const meta = (metaRes as any).result || metaRes;
              generated.push({
                id: crypto.randomUUID(),
                title: (meta as any).title || row.topic,
                description: (meta as any).description || '',
                rewardXp: (meta as any).rewardXp || 600,
                rewardCoins: (meta as any).rewardCoins || 250,
                steps: steps.map((s, i) => ({ ...s, id: String(i + 1) })),
                subject: row.subject,
                grade: row.grade,
                difficulty: 'medium',
                classId: null,
                isAIGenerated: true,
                createdAt: new Date().toISOString(),
              });
            } catch (err: any) {
              toast.error(`Erro na trilha "${row.topic}": ${err.message || 'timeout'}`);
            }
          }
          if (generated.length === 0) return;
          setTrails(prev => [...generated, ...prev]);
          for (let i = 0; i < generated.length; i += 50) {
            const { error } = await supabase.from('learning_paths').insert(generated.slice(i, i + 50));
            if (error) { toast.error('Erro ao salvar trilhas: ' + error.message); fetchTrails(); return; }
          }
          toast.success(`${generated.length} trilha(s) gerada(s) e salvas com sucesso! ✨`);
        }}
      />
    </div>

  );
};
