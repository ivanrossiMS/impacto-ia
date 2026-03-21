import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, Upload, Table, AlertCircle, CheckCircle2, 
  ChevronRight, ChevronLeft, Info, UserPlus, School
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

// --- Types ---
type ImportStep = 'upload' | 'mapping' | 'validation' | 'duplicates' | 'confirm';

interface ColumnMapping {
  spreadsheet: string;
  systemField: 'name' | 'code' | 'email' | 'class' | 'guardian1Name' | 'guardian1Email' | 'guardian2Name' | 'guardian2Email' | 'guardian3Name' | 'guardian3Email' | 'none';
}

interface ImportRow {
  rawData: Record<string, string>;
  mappedData: {
    name?: string;
    code?: string;
    email?: string;
    class?: string;
    guardian1Name?: string;
    guardian1Email?: string;
    guardian2Name?: string;
    guardian2Email?: string;
    guardian3Name?: string;
    guardian3Email?: string;
  };
  errors: string[];
  isDuplicate: boolean;
  existingUser?: any;
}

interface UserImportModalProps {
  onClose: () => void;
  schools: any[];
  isAdminMaster: boolean;
  userSchoolId?: string;
}

export const UserImportModal: React.FC<UserImportModalProps> = ({ 
  onClose, schools, isAdminMaster, userSchoolId 
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importStrategy, setImportStrategy] = useState<'keep' | 'replace'>('keep');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState(userSchoolId || (schools[0]?.id || ''));

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const downloadTemplate = () => {
    const data = [{
      'Código Aluno': 'AL001',
      'Nome Aluno': 'Exemplo Aluno 1',
      'Turma': '6º Ano A',
      'Nome responsável1': 'João Silva',
      'Email Responsável1': 'joao@exemplo.com',
      'Nome responsável2': '',
      'Email Responsável2': '',
      'Nome responsável3': '',
      'Email Responsável3': ''
    }, {
      'Código Aluno': 'AL002',
      'Nome Aluno': 'Exemplo Aluno 2',
      'Turma': '7º Ano B',
      'Nome responsável1': 'Maria Oliveira',
      'Email Responsável1': 'maria@exemplo.com',
      'Nome responsável2': 'Pedro Oliveira',
      'Email Responsável2': 'pedro@exemplo.com',
      'Nome responsável3': '',
      'Email Responsável3': ''
    }];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alunos");
    XLSX.writeFile(wb, "modelo_importacao_impacto_ia.xlsx");
    toast.success('Modelo baixado com sucesso!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = (file: File) => {
    setFile(file);
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: isExcel ? 'array' : 'string' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with headers (header: 1 returns array of arrays)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          toast.error('O arquivo parece estar vazio ou sem dados.');
          return;
        }

        const parsedHeaders = jsonData[0].map(h => String(h || '').trim()).filter(h => h !== '');
        const dataRows = jsonData.slice(1);

        const parsedRows = dataRows.map(row => {
          const rowData: Record<string, string> = {};
          parsedHeaders.forEach((header, i) => {
            rowData[header] = String(row[i] || '').trim();
          });
          return {
            rawData: rowData,
            mappedData: {},
            errors: [],
            isDuplicate: false
          };
        }).filter(r => Object.values(r.rawData).some(v => v !== '')); // Filter empty lines

        setHeaders(parsedHeaders);
        setRows(parsedRows);
        
        // Initial mapping attempt
        const initialMappings: ColumnMapping[] = parsedHeaders.map(h => {
          const lowerH = h.toLowerCase();
          let field: ColumnMapping['systemField'] = 'none';
          
          if (lowerH.includes('nome aluno') || (lowerH.includes('nome') && !lowerH.includes('resp'))) field = 'name';
          else if (lowerH.includes('código aluno') || lowerH.includes('codigo aluno') || lowerH.includes('código') || lowerH.includes('login') || lowerH.includes('id')) field = 'code';
          else if (lowerH.includes('turma') || lowerH.includes('class')) field = 'class';
          else if (lowerH.includes('nome') && lowerH.includes('1')) field = 'guardian1Name';
          else if (lowerH.includes('email') && lowerH.includes('1')) field = 'guardian1Email';
          else if (lowerH.includes('nome') && lowerH.includes('2')) field = 'guardian2Name';
          else if (lowerH.includes('email') && lowerH.includes('2')) field = 'guardian2Email';
          else if (lowerH.includes('nome') && lowerH.includes('3')) field = 'guardian3Name';
          else if (lowerH.includes('email') && lowerH.includes('3')) field = 'guardian3Email';
          
          return { spreadsheet: h, systemField: field };
        });
        
        setMappings(initialMappings);
        setStep('mapping');
      } catch (err) {
        console.error(err);
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleMappingChange = (spreadsheetHeader: string, field: ColumnMapping['systemField']) => {
    setMappings(prev => prev.map(m => 
      m.spreadsheet === spreadsheetHeader ? { ...m, systemField: field } : m
    ));
  };

  const runValidation = async () => {
    setIsLoading(true);
    const nameMap = mappings.find(m => m.systemField === 'name')?.spreadsheet;
    const codeMap = mappings.find(m => m.systemField === 'code')?.spreadsheet;
    const classMap = mappings.find(m => m.systemField === 'class')?.spreadsheet;
    const g1NameMap = mappings.find(m => m.systemField === 'guardian1Name')?.spreadsheet;
    const g1EmailMap = mappings.find(m => m.systemField === 'guardian1Email')?.spreadsheet;
    const g2NameMap = mappings.find(m => m.systemField === 'guardian2Name')?.spreadsheet;
    const g2EmailMap = mappings.find(m => m.systemField === 'guardian2Email')?.spreadsheet;
    const g3NameMap = mappings.find(m => m.systemField === 'guardian3Name')?.spreadsheet;
    const g3EmailMap = mappings.find(m => m.systemField === 'guardian3Email')?.spreadsheet;

    if (!nameMap && !codeMap) {
      toast.error('Você deve mapear pelo menos o Nome ou o Código.');
      setIsLoading(false);
      return;
    }

    const validatedRows = await Promise.all(rows.map(async row => {
      const mapped: ImportRow['mappedData'] = {
        name: nameMap ? row.rawData[nameMap] : undefined,
        code: codeMap ? row.rawData[codeMap] : undefined,
        class: classMap ? row.rawData[classMap] : undefined,
        guardian1Name: g1NameMap ? row.rawData[g1NameMap] : undefined,
        guardian1Email: g1EmailMap ? row.rawData[g1EmailMap] : undefined,
        guardian2Name: g2NameMap ? row.rawData[g2NameMap] : undefined,
        guardian2Email: g2EmailMap ? row.rawData[g2EmailMap] : undefined,
        guardian3Name: g3NameMap ? row.rawData[g3NameMap] : undefined,
        guardian3Email: g3EmailMap ? row.rawData[g3EmailMap] : undefined,
      };

      const errors: string[] = [];
      if (!mapped.name && !mapped.code) errors.push('Nome ou Código ausentes');
      
      // Check for duplicates in DB
      let existingUser = null;
      if (mapped.code) {
        const { data } = await supabase.from('users').select('*').eq('studentCode', mapped.code).maybeSingle();
        existingUser = data;
      }

      return {
        ...row,
        mappedData: mapped,
        errors,
        isDuplicate: !!existingUser,
        existingUser
      };
    }));

    setRows(validatedRows);
    setIsLoading(false);
    
    if (validatedRows.some(r => r.errors.length > 0)) {
      setStep('validation');
    } else if (validatedRows.some(r => r.isDuplicate)) {
      setStep('duplicates');
    } else {
      setStep('confirm');
    }
  };

  const executeImport = async () => {
    setIsLoading(true);
    const now = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;

    try {
      for (const row of rows) {
        if (row.errors.length > 0) continue;

        const guardiansData = [
          { name: row.mappedData.guardian1Name, email: row.mappedData.guardian1Email },
          { name: row.mappedData.guardian2Name, email: row.mappedData.guardian2Email },
          { name: row.mappedData.guardian3Name, email: row.mappedData.guardian3Email },
        ].filter(g => g.name || g.email);

        const processedGuardianIds: string[] = [];

        for (const gData of guardiansData) {
          let guardian = null;
          const emailNormalized = gData.email?.trim().toLowerCase();
          
          if (emailNormalized) {
            const { data } = await supabase.from('users').select('*').eq('email', emailNormalized).eq('role', 'guardian').maybeSingle();
            guardian = data;
          }
          if (!guardian && gData.name) {
            const { data } = await supabase.from('users').select('*').eq('name', gData.name).eq('role', 'guardian').eq('schoolId', selectedSchoolId).maybeSingle();
            guardian = data;
          }

          if (guardian) {
            processedGuardianIds.push(guardian.id);
            // If replace strategy, update guardian email if provided
            if (importStrategy === 'replace' && emailNormalized && guardian.email !== emailNormalized) {
              await supabase.from('users').update({ email: emailNormalized, guardianCode: emailNormalized }).eq('id', guardian.id);
            }
          } else {
            // Create new guardian
            const gId = crypto.randomUUID();
            // User requested email as login/email preenchido
            const gCode = emailNormalized || `RESP${Math.floor(1000 + Math.random() * 9000)}`;
            const newG: any = {
              id: gId,
              name: gData.name || 'Responsável Importado',
              email: emailNormalized,
              role: 'guardian',
              guardianCode: gCode,
              schoolId: selectedSchoolId,
              status: 'active',
              isRegistered: false,
              createdAt: now,
              updatedAt: now,
              studentIds: []
            };
            await supabase.from('users').insert(newG);
            processedGuardianIds.push(gId);
          }
        }

        if (row.isDuplicate && row.existingUser) {
          // UPDATE LOGIC
          const updates: any = { updatedAt: now };
          
          if (importStrategy === 'replace') {
            if (row.mappedData.name) updates.name = row.mappedData.name;
            updates.guardianIds = processedGuardianIds;
          } else {
            updates.guardianIds = Array.from(new Set([...(row.existingUser.guardianIds || []), ...processedGuardianIds]));
          }

          // Handle Class
          if (row.mappedData.class) {
            let { data: cls } = await supabase.from('classes').select('*').eq('schoolId', selectedSchoolId).eq('name', row.mappedData.class).maybeSingle();
            
            // Auto-create class if not exists
            if (!cls) {
               const newClsId = crypto.randomUUID();
               // Try to standardize grade
               const rawClass = row.mappedData.class;
               let standardGrade = rawClass;
               const gradeMatch = rawClass.match(/(\d+)[\sº]*[Aa]no/);
               const shortMatch = rawClass.match(/^(\d+)[A-Za-z]?$/);
               
               if (gradeMatch) standardGrade = `${gradeMatch[1]}º Ano`;
               else if (shortMatch) standardGrade = `${shortMatch[1]}º Ano`;

               const newCls: any = {
                 id: newClsId,
                 name: rawClass,
                 grade: standardGrade,
                 schoolId: selectedSchoolId,
                 year: new Date().getFullYear().toString(),
                 studentIds: [],
                 createdAt: now,
                 updatedAt: now
               };
               await supabase.from('classes').insert(newCls);
               cls = newCls;
            }

            if (cls) {
              if (importStrategy === 'replace') {
                updates.classId = cls.id;
                updates.classIds = [cls.id];
              } else {
                const currentClassIds = row.existingUser.classIds || (row.existingUser.classId ? [row.existingUser.classId] : []);
                if (!currentClassIds.includes(cls.id)) {
                  updates.classIds = [...currentClassIds, cls.id];
                  if (!updates.classId) updates.classId = cls.id;
                }
              }
              
              // Update class.studentIds
              const sIds = Array.from(new Set([...(cls.studentIds || []), row.existingUser.id]));
              await supabase.from('classes').update({ studentIds: sIds }).eq('id', cls.id);
            }
          }

          // Link Guardians back to Student
          for (const gId of processedGuardianIds) {
            const { data: g } = await supabase.from('users').select('*').eq('id', gId).maybeSingle();
            if (g && g.role === 'guardian') {
              const sIds = Array.from(new Set([...(g.studentIds || []), row.existingUser.id]));
              await supabase.from('users').update({ studentIds: sIds }).eq('id', gId);
            }
          }

          await supabase.from('users').update(updates).eq('id', row.existingUser.id);
          updatedCount++;
        } else {
          // CREATE LOGIC
          const userId = crypto.randomUUID();
          const newUser: any = {
            id: userId,
            name: row.mappedData.name || 'Aluno Importado',
            studentCode: row.mappedData.code,
            role: 'student',
            schoolId: selectedSchoolId,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            isRegistered: false,
            avatar: '/avatars/default-impacto.png',
            classIds: [],
            guardianIds: processedGuardianIds
          };

          if (row.mappedData.class) {
            let { data: cls } = await supabase.from('classes').select('*').eq('schoolId', selectedSchoolId).eq('name', row.mappedData.class).maybeSingle();
            
            // Auto-create class on create too
            if (!cls) {
               const newClsId = crypto.randomUUID();
               // Try to standardize grade
               const rawClass = row.mappedData.class;
               let standardGrade = rawClass;
               const gradeMatch = rawClass.match(/(\d+)[\sº]*[Aa]no/);
               const shortMatch = rawClass.match(/^(\d+)[A-Za-z]?$/);
               
               if (gradeMatch) standardGrade = `${gradeMatch[1]}º Ano`;
               else if (shortMatch) standardGrade = `${shortMatch[1]}º Ano`;

               const newCls: any = {
                 id: newClsId,
                 name: rawClass,
                 grade: standardGrade,
                 schoolId: selectedSchoolId,
                 year: new Date().getFullYear().toString(),
                 studentIds: [],
                 createdAt: now,
                 updatedAt: now
               };
               await supabase.from('classes').insert(newCls);
               cls = newCls;
            }

            if (cls) {
              newUser.classId = cls.id;
              newUser.classIds = [cls.id];
              newUser.grade = cls.grade;
              
              const sIds = Array.from(new Set([...(cls.studentIds || []), userId]));
              await supabase.from('classes').update({ studentIds: sIds }).eq('id', cls.id);
            }
          }

          // Link Guardians to NEW Student
          for (const gId of processedGuardianIds) {
             const { data: g } = await supabase.from('users').select('*').eq('id', gId).maybeSingle();
             if (g && g.role === 'guardian') {
               const sIds = Array.from(new Set([...(g.studentIds || []), userId]));
               await supabase.from('users').update({ studentIds: sIds }).eq('id', gId);
             }
          }

          await supabase.from('users').insert(newUser);
          await supabase.from('gamification_stats').insert({
             id: userId,
             level: 1,
             xp: 0,
             coins: 100,
             streak: 0,
             lastStudyDate: now
          });
          createdCount++;
        }
      }

      // Update School Stats
      const { data: schoolUsers } = await supabase.from('users').select('*').eq('schoolId', selectedSchoolId);
      if (schoolUsers) {
        const students = schoolUsers.filter((u: any) => u.role === 'student');
        const studentIds = students.map((s: any) => s.id);
        const { data: studentStats } = await supabase.from('gamification_stats').select('*').in('id', studentIds);
        const totalXp = studentStats ? studentStats.reduce((sum: number, s: any) => sum + (s.xp || 0), 0) : 0;
        
        // Calculate a rough global score based on XP and activity
        const globalScore = Math.floor(totalXp / 10) + (students.length * 5);

        await supabase.from('schools').update({
          usersCount: schoolUsers.length,
          globalScore: globalScore
        }).eq('id', selectedSchoolId);
      }

      toast.success(`Importação concluída! ${createdCount} criados, ${updatedCount} atualizados.`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro durante a importação.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Steps ---

  const renderStepper = () => (
    <div className="flex items-center justify-between mb-10 px-4">
      {[
        { id: 'upload', icon: Upload, label: 'Carregar' },
        { id: 'mapping', icon: Table, label: 'Colunas' },
        { id: 'validation', icon: AlertCircle, label: 'Erros' },
        { id: 'duplicates', icon: Info, label: 'Duplicados' },
        { id: 'confirm', icon: CheckCircle2, label: 'Confirmar' }
      ].map((s, i) => {
        const isActive = step === s.id;
        const isDone = ['upload', 'mapping', 'validation', 'duplicates', 'confirm'].indexOf(step) > i;
        
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2 relative">
               <div className={cn(
                 "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                 isActive ? "bg-primary-600 text-white ring-4 ring-primary-100" : 
                 isDone ? "bg-success-500 text-white" : "bg-slate-100 text-slate-400"
               )}>
                  <s.icon size={18} />
               </div>
               <span className={cn(
                 "text-[10px] font-black uppercase tracking-widest",
                 isActive ? "text-primary-600" : "text-slate-400"
               )}>{s.label}</span>
            </div>
            {i < 4 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 bg-slate-100 transition-colors duration-500",
                isDone && "bg-success-500"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <header className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight italic">Importar/atualizar alunos</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Dados em Lote</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderStepper()}

          {/* STEP: UPLOAD */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in slide-in-from-bottom-4">
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full max-w-2xl border-4 border-dashed border-slate-100 hover:border-primary-300 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-6 cursor-pointer bg-slate-50/50 hover:bg-primary-50/30 transition-all group"
               >
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 group-hover:text-primary-500 group-hover:scale-110 transition-all shadow-xl">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800">Clique para selecionar ou arraste o arquivo</h3>
                    <p className="text-slate-400 font-medium mt-2">Suporte para arquivos CSV com e-mails ou códigos de alunos.</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
               </div>
               
               <div className="flex flex-col md:flex-row items-center gap-6 w-full max-w-2xl">
                  <div className="flex items-center gap-4 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex-1 text-indigo-700">
                    <Info size={24} className="shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">
                      Suporte a CSV e Excel (XLSX/XLS). 
                      Recomendamos preencher o modelo oficial.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={downloadTemplate}
                    className="rounded-2xl px-6 py-6 font-black uppercase tracking-widest text-[10px] gap-2 shrink-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                     <Table size={16} /> Baixar Modelo
                  </Button>
               </div>
            </div>
          )}

          {/* STEP: MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
               <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-2">
                       <h3 className="text-xl font-black italic">Configurações de Importação</h3>
                       <p className="text-slate-400 text-sm font-medium">Escolha como tratar dados que já existem no sistema.</p>
                    </div>
                    <div className="flex flex-col gap-3 shrink-0">
                       <label className={cn(
                         "flex items-center gap-3 px-6 py-3 rounded-2xl cursor-pointer transition-all border border-white/5",
                         importStrategy === 'keep' ? "bg-primary-600 border-primary-500 shadow-lg" : "bg-white/5 hover:bg-white/10"
                       )}>
                          <input type="radio" checked={importStrategy === 'keep'} onChange={() => setImportStrategy('keep')} className="hidden" />
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", importStrategy === 'keep' ? "border-white" : "border-slate-500")}>
                             {importStrategy === 'keep' && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span className="text-xs font-bold font-outfit uppercase tracking-tight">Manter dados antigos</span>
                       </label>
                       <label className={cn(
                         "flex items-center gap-3 px-6 py-3 rounded-2xl cursor-pointer transition-all border border-white/5",
                         importStrategy === 'replace' ? "bg-primary-600 border-primary-500 shadow-lg" : "bg-white/5 hover:bg-white/10"
                       )}>
                          <input type="radio" checked={importStrategy === 'replace'} onChange={() => setImportStrategy('replace')} className="hidden" />
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", importStrategy === 'replace' ? "border-white" : "border-slate-500")}>
                             {importStrategy === 'replace' && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span className="text-xs font-bold font-outfit uppercase tracking-tight">Substituir dados antigos</span>
                       </label>
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <h3 className="text-lg font-black text-slate-800">Escolha as colunas para cada linha</h3>
                     <div className="flex items-center gap-4">
                        {isAdminMaster && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade:</span>
                            <select 
                              value={selectedSchoolId} 
                              onChange={(e) => setSelectedSchoolId(e.target.value)}
                              className="bg-slate-100 border-0 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none"
                            >
                               {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}
                        {!isAdminMaster && <Badge variant="primary">Unidade: {schools.find(s => s.id === selectedSchoolId)?.name || 'Global'}</Badge>}
                        <div className="text-[9px] font-black text-primary-500 uppercase px-3 py-1 bg-primary-50 rounded-lg">
                          {headers.length} colunas detectadas
                        </div>
                     </div>
                  </div>
                  
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar whitespace-nowrap pb-4">
                      <table className="w-full text-left border-collapse min-w-max">
                         <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                               {mappings.map((m) => (
                                  <th key={m.spreadsheet} className="p-6 border-r border-slate-100 last:border-0 min-w-[240px]">
                                     <div className="space-y-4">
                                        <select 
                                          value={m.systemField} 
                                          onChange={(e) => handleMappingChange(m.spreadsheet, e.target.value as any)}
                                          className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black focus:border-primary-400 outline-none w-full shadow-sm hover:border-slate-300 transition-all cursor-pointer"
                                        >
                                           <option value="none">Ignorar Coluna</option>
                                           <option value="name">Nome do Aluno</option>
                                           <option value="code">Código do Aluno</option>
                                           <option value="class">Turma/Classe</option>
                                           <option value="guardian1Name">Nome Responsável 1</option>
                                           <option value="guardian1Email">Email Responsável 1</option>
                                           <option value="guardian2Name">Nome Responsável 2</option>
                                           <option value="guardian2Email">Email Responsável 2</option>
                                           <option value="guardian3Name">Nome Responsável 3</option>
                                           <option value="guardian3Email">Email Responsável 3</option>
                                        </select>
                                        <div className="flex items-center gap-2 px-1">
                                           <div className="w-2 h-2 rounded-full bg-primary-400" />
                                           <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate max-w-[180px]" title={m.spreadsheet}>
                                              {m.spreadsheet}
                                           </span>
                                        </div>
                                     </div>
                                  </th>
                               ))}
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {rows.slice(0, 3).map((row, rowIndex) => (
                               <tr key={rowIndex} className="hover:bg-slate-50/30 transition-colors">
                                  {mappings.map((m) => (
                                     <td key={m.spreadsheet} className="p-6 border-r border-slate-50 last:border-0">
                                        <span className="text-xs font-medium text-slate-600">
                                           {row.rawData[m.spreadsheet] || <i className="text-slate-300">Vazio</i>}
                                        </span>
                                     </td>
                                  ))}
                               </tr>
                            ))}
                            {rows.length > 3 && (
                               <tr className="bg-slate-50/20">
                                  {mappings.map((m) => (
                                     <td key={m.spreadsheet} className="px-6 py-4 border-r border-slate-50 last:border-0 text-center opacity-30">
                                        <div className="w-1 h-1 bg-slate-400 rounded-full inline-block mx-0.5 animate-pulse" />
                                        <div className="w-1 h-1 bg-slate-400 rounded-full inline-block mx-0.5 animate-pulse delay-75" />
                                        <div className="w-1 h-1 bg-slate-400 rounded-full inline-block mx-0.5 animate-pulse delay-150" />
                                     </td>
                                  ))}
                               </tr>
                            )}
                         </tbody>
                      </table>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* STEP: VALIDATION & DUPLICATES */}
          {(step === 'validation' || step === 'duplicates') && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 h-full flex flex-col">
               <div className={cn(
                 "p-6 rounded-[2rem] flex items-center gap-4",
                 step === 'validation' ? "bg-red-50 text-red-700 border border-red-100" : "bg-warning-50 text-warning-700 border border-warning-100"
               )}>
                  <AlertCircle size={24} />
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight">
                      {step === 'validation' ? 'Linhas com erros de validação' : 'Registros existentes encontrados'}
                    </h4>
                    <p className="text-xs font-medium opacity-80">
                      {step === 'validation' 
                        ? 'Algumas linhas não possuem os campos obrigatórios e serão ignoradas.' 
                        : 'Identificamos que alguns alunos já estão no banco de dados. Eles serão atualizados conforme a estratégia escolhida.'}
                    </p>
                  </div>
               </div>

               <div className="flex-1 min-h-0 border border-slate-100 rounded-[2.5rem] overflow-hidden flex flex-col shadow-inner">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                       <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             <th className="p-6">Status</th>
                             <th className="p-6">Nome</th>
                             <th className="p-6">Código/Email</th>
                             <th className="p-6">Observação</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 bg-white">
                          {(step === 'validation' ? rows.filter(r => r.errors.length > 0) : rows.filter(r => r.isDuplicate)).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                               <td className="p-6 text-center">
                                  {row.errors.length > 0 ? (
                                    <Badge variant="danger" className="bg-red-500">Erro</Badge>
                                  ) : (
                                    <Badge variant="energy" className="bg-amber-500">Duplicado</Badge>
                                  )}
                               </td>
                               <td className="p-6 text-sm font-bold text-slate-800">{row.mappedData.name || '-'}</td>
                               <td className="p-6 text-[11px] font-bold text-slate-500 uppercase">{row.mappedData.code || row.mappedData.email || '-'}</td>
                               <td className="p-6 text-[10px] font-medium text-slate-400">
                                  {row.errors.length > 0 ? row.errors.join(', ') : 'Usuário já existe, será atualizado.'}
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {/* STEP: CONFIRM */}
          {step === 'confirm' && (
            <div className="flex flex-col items-center justify-center space-y-10 animate-in zoom-in duration-500 h-full py-10">
               <div className="w-32 h-32 bg-primary-50 rounded-[3rem] flex items-center justify-center text-primary-500 shadow-2xl relative">
                  <UserPlus size={54} />
                  <div className="absolute -bottom-2 -right-2 bg-success-500 text-white p-2 rounded-full ring-4 ring-white shadow-lg">
                    <CheckCircle2 size={24} />
                  </div>
               </div>
               
               <div className="text-center space-y-3">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none italic">Tudo pronto para importar!</h3>
                  <p className="text-slate-400 font-medium text-lg max-w-sm font-outfit">Validamos seu arquivo. Aqui está o resumo final antes de começarmos:</p>
               </div>

               <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                  <Card className="p-6 text-center border-slate-100 bg-slate-50/50 rounded-3xl shadow-sm">
                     <div className="text-3xl font-black text-slate-800 tracking-tight">{rows.filter(r => r.errors.length === 0 && !r.isDuplicate).length}</div>
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Novos Alunos</div>
                  </Card>
                  <Card className="p-6 text-center border-slate-100 bg-slate-50/50 rounded-3xl shadow-sm">
                     <div className="text-3xl font-black text-primary-600 tracking-tight">{rows.filter(r => r.isDuplicate).length}</div>
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Atualizações</div>
                  </Card>
               </div>

               <div className="w-full max-w-md p-6 bg-slate-900 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-primary-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center"><School size={20} className="text-primary-400" /></div>
                    <div className="text-xs font-bold">{schools.find(s => s.id === selectedSchoolId)?.name}</div>
                  </div>
                  <Badge className="bg-white/10 text-white border-0 py-1.5 px-4 uppercase tracking-tighter">
                    {importStrategy === 'keep' ? 'Preservar Existentes' : 'Substituir Existentes'}
                  </Badge>
               </div>
            </div>
          )}
        </main>

        <footer className="px-10 py-8 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
           <Button 
             variant="ghost" 
             onClick={onClose}
             className="rounded-2xl px-6 py-4 font-black uppercase tracking-widest text-[11px] text-slate-400 hover:text-red-500"
           >
              Cancelar Importação
           </Button>
           
           <div className="flex gap-4">
              {step !== 'upload' && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (step === 'mapping') setStep('upload');
                    else if (step === 'duplicates') {
                      setRows(r => r.map(x => ({ ...x, isDuplicate: false })));
                      setStep('mapping');
                    }
                  }}
                  className="rounded-2xl px-6 py-4 font-black uppercase tracking-widest text-[11px] gap-2"
                >
                   <ChevronLeft size={16} /> Voltar
                </Button>
              )}
              
              <Button 
                onClick={() => {
                  if (step === 'mapping') runValidation();
                  else if (step === 'validation' || step === 'duplicates') setStep('confirm');
                  else if (step === 'confirm') executeImport();
                }}
                disabled={isLoading || (step === 'upload' && !file)}
                variant="primary" 
                className="rounded-2xl px-12 py-4 font-black uppercase tracking-widest text-[11px] min-w-[160px] shadow-xl shadow-primary-500/20 gap-2"
              >
                 {isLoading ? 'Relizando...' : (step === 'confirm' ? 'Finalizar e Importar' : 'Próximo')}
                 {!isLoading && step !== 'confirm' && <ChevronRight size={16} />}
              </Button>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default UserImportModal;
