import React, { useState } from 'react';
import { X, Trash2, RefreshCw, Users, BookOpen, AlertCircle, ShieldAlert } from 'lucide-react';
import { db } from '../../lib/dexie';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkActionsModalProps {
  onClose: () => void;
  schools: any[];
  isAdminMaster: boolean;
  userSchoolId?: string;
}

type ActionType = 
  | 'delete_students' 
  | 'delete_classes' 
  | 'clear_student_classes' 
  | 'delete_guardians' 
  | 'reset_student_access' 
  | 'reset_guardian_access';

export const BulkActionsModal: React.FC<BulkActionsModalProps> = ({ onClose, schools, isAdminMaster, userSchoolId }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(isAdminMaster ? 'all' : userSchoolId || 'all');
  const [confirmingAction, setConfirmingAction] = useState<ActionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [safetyPhrase, setSafetyPhrase] = useState('');

  const actions: { id: ActionType; label: string; description: string; icon: any; color: string; danger?: boolean }[] = [
    { id: 'delete_students', label: 'Excluir Todos os Alunos', description: 'Remove permanentemente todos os alunos e seu histórico de progresso e gamificação.', icon: Trash2, color: 'text-red-600 bg-red-50', danger: true },
    { id: 'delete_guardians', label: 'Excluir Todos os Responsáveis', description: 'Remove todos os responsáveis e desvincula-os dos alunos correspondentes.', icon: Users, color: 'text-rose-600 bg-rose-50', danger: true },
    { id: 'delete_classes', label: 'Excluir Todas as Turmas', description: 'Remove todas as turmas da unidade e desvincula alunos e professores.', icon: Trash2, color: 'text-orange-600 bg-orange-50', danger: true },
    { id: 'clear_student_classes', label: 'Remover Alunos de Turmas', description: 'Desvincula todos os alunos de suas turmas atuais sem excluir os registros.', icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
    { id: 'reset_student_access', label: 'Reiniciar Acesso: Alunos', description: 'Força todos os alunos a realizarem o primeiro acesso e definirem uma nova senha.', icon: RefreshCw, color: 'text-primary-600 bg-primary-50' },
    { id: 'reset_guardian_access', label: 'Reiniciar Acesso: Responsáveis', description: 'Força todos os responsáveis a realizarem o primeiro acesso novamente.', icon: RefreshCw, color: 'text-violet-600 bg-violet-50' },
  ];

  const handleAction = async (type: ActionType) => {
    setIsProcessing(true);
    const now = new Date().toISOString();

    try {
      let count = 0;
      switch (type) {
        case 'delete_students': {
          const query = db.users.where('role').equals('student');
          const students = selectedSchoolId === 'all' ? await query.toArray() : await query.filter(u => u.schoolId === selectedSchoolId).toArray();
          const ids = students.map(s => s.id);
          count = ids.length;
          await db.users.bulkDelete(ids);
          await db.gamificationStats.bulkDelete(ids);
          await db.studentOwnedAvatars.where('studentId').anyOf(ids).delete();
          await db.studentAvatarProfiles.where('studentId').anyOf(ids).delete();
          await db.studentAchievements.where('studentId').anyOf(ids).delete();
          await db.studentMissions.where('studentId').anyOf(ids).delete();
          await db.studentProgress.where('studentId').anyOf(ids).delete();
          await db.studentActivityResults.where('studentId').anyOf(ids).delete();
          await db.diaryEntries.where('studentId').anyOf(ids).delete();
          break;
        }

        case 'delete_guardians': {
          const query = db.users.where('role').equals('guardian');
          const guardians = selectedSchoolId === 'all' ? await query.toArray() : await query.filter(u => u.schoolId === selectedSchoolId).toArray();
          const ids = guardians.map(g => g.id);
          count = ids.length;
          await db.users.bulkDelete(ids);
          // Clear guardian links in students
          await db.users.where('role').equals('student').modify((s: any) => {
            if (s.guardianIds) {
              s.guardianIds = s.guardianIds.filter((id: string) => !ids.includes(id));
            }
          });
          break;
        }

        case 'delete_classes': {
          const query = db.classes;
          const targetClasses = selectedSchoolId === 'all' ? await query.toArray() : await query.where('schoolId').equals(selectedSchoolId).toArray();
          const ids = targetClasses.map(c => c.id);
          count = ids.length;
          await db.classes.bulkDelete(ids);
          // Dissociate from users
          await db.users.toCollection().modify((u: any) => {
            if (u.classId && ids.includes(u.classId)) u.classId = undefined;
            if (u.classIds) u.classIds = u.classIds.filter((id: string) => !ids.includes(id));
          });
          break;
        }

        case 'clear_student_classes': {
          const query = db.users.where('role').equals('student');
          const students = selectedSchoolId === 'all' ? await query.toArray() : await query.filter(u => u.schoolId === selectedSchoolId).toArray();
          count = students.length;
          await db.users.where('id').anyOf(students.map(s => s.id)).modify({ classId: undefined, classIds: [] } as any);
          break;
        }

        case 'reset_student_access': {
          const query = db.users.where('role').equals('student');
          const students = selectedSchoolId === 'all' ? await query.toArray() : await query.filter(u => u.schoolId === selectedSchoolId).toArray();
          count = students.length;
          await db.users.where('id').anyOf(students.map(s => s.id)).modify({ isRegistered: false, passwordHash: undefined, updatedAt: now } as any);
          break;
        }

        case 'reset_guardian_access': {
          const query = db.users.where('role').equals('guardian');
          const guardians = selectedSchoolId === 'all' ? await query.toArray() : await query.filter(u => u.schoolId === selectedSchoolId).toArray();
          count = guardians.length;
          await db.users.where('id').anyOf(guardians.map(g => g.id)).modify({ isRegistered: false, passwordHash: undefined, updatedAt: now } as any);
          break;
        }
      }

      toast.success(`${count} registros processados com sucesso!`);
      setConfirmingAction(null);
      setSafetyPhrase('');
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao processar a ação.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <header className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <ShieldAlert size={24} />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manutenção de Sistema</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ferramentas de Limpeza e Ações em Massa</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </header>

        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          {/* School Selector */}
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">
              Escopo da Ação
            </div>
            {isAdminMaster ? (
              <select 
                value={selectedSchoolId} 
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-primary-500/10 transition-all cursor-pointer"
              >
                <option value="all">Todas as Escolas (Global)</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-800 flex justify-between items-center">
                <span>{schools.find(s => s.id === userSchoolId)?.name || 'Sua Escola'}</span>
                <span className="text-[9px] font-black bg-primary-50 text-primary-600 px-3 py-1 rounded-full uppercase">Restrito</span>
              </div>
            )}
            <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tight">
              A ação selecionada abaixo será aplicada apenas aos registros vinculados a este escopo.
            </p>
          </div>

          {/* Actions List */}
          <div className="grid grid-cols-1 gap-4">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => setConfirmingAction(action.id)}
                className={cn(
                  "flex items-center gap-6 p-6 rounded-[2rem] border-2 border-transparent hover:border-slate-100 transition-all text-left group",
                  action.danger ? "bg-red-50/20 hover:bg-red-50" : "bg-slate-50/40 hover:bg-slate-50"
                )}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", action.color)}>
                  <action.icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn("font-black text-lg", action.danger ? "text-red-700" : "text-slate-800")}>{action.label}</h3>
                  <p className="text-slate-500 text-sm font-medium line-clamp-2 mt-0.5">{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <footer className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex justify-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Impacto IA Admin Panel • 2026</p>
        </footer>
      </div>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {confirmingAction && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 space-y-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              
              <div className="text-center space-y-4 relative z-10">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-red-500/10">
                  <AlertCircle size={40} />
                </div>
                <h3 className="text-3xl font-black text-slate-800">Ação Crítica!</h3>
                <p className="text-slate-500 font-bold leading-relaxed">
                  Você está prestes a realizar a ação: <br/> 
                  <strong className="text-red-600 uppercase text-lg underline decoration-2 underline-offset-4">{actions.find(a => a.id === confirmingAction)?.label}</strong>
                </p>
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                   <p className="text-xs font-black text-red-700 uppercase leading-relaxed">
                     Esta operação {actions.find(a => a.id === confirmingAction)?.danger ? 'É IRREVERSÍVEL' : 'VAI AFETAR MUITOS REGISTROS'}. Verifique o escopo selecionado ({selectedSchoolId === 'all' ? 'TODA A REDE' : schools.find(s => s.id === selectedSchoolId)?.name}) antes de prosseguir.
                   </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center block">Digite "CONFIRMAR" para autorizar</label>
                   <input 
                    type="text" 
                    value={safetyPhrase}
                    onChange={(e) => setSafetyPhrase(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-center font-black text-xl text-slate-800 outline-none focus:ring-4 focus:ring-red-500/10 focus:bg-white transition-all uppercase placeholder:text-slate-200"
                    placeholder="Mantra de Segurança"
                   />
                </div>

                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => { setConfirmingAction(null); setSafetyPhrase(''); }}
                    className="flex-1 rounded-2xl py-5 font-black uppercase tracking-widest text-xs"
                    disabled={isProcessing}
                  >
                    Abortar
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => handleAction(confirmingAction)}
                    disabled={isProcessing || safetyPhrase.toUpperCase() !== 'CONFIRMAR'}
                    className={cn(
                      "flex-1 rounded-2xl py-5 font-black uppercase tracking-widest text-xs shadow-xl transition-all",
                      safetyPhrase.toUpperCase() === 'CONFIRMAR' ? "bg-red-600 hover:bg-red-700 shadow-red-500/30 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? 'Processando...' : 'Autorizar'}
                  </Button>
                </div>
              </div>

              {isProcessing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
                   <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                   <p className="text-xs font-black text-slate-600 uppercase tracking-widest animate-pulse">Realizando manobra de dados...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
