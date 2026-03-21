import React, { useState } from 'react';
import { 
  Megaphone, 
  X, 
  Send, 
  Calendar, 
  Bell,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { db } from '../../lib/dexie';
import { useAuthStore } from '../../store/auth.store';
import { createBulkNotifications } from '../../lib/notificationUtils';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: { id: string; name: string }[];
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose, classes }) => {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const { user } = useAuthStore();

  // Auto-select if there's only one class and none selected
  React.useEffect(() => {
    if (classes.length === 1 && selectedClasses.length === 0) {
      setSelectedClasses([classes[0].id]);
    }
  }, [classes, selectedClasses.length]);

  const toggleClass = (id: string) => {
    setSelectedClasses(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (selectedClasses.length === 0) return toast.error('Selecione pelo menos uma turma.');
    if (!message) return toast.error('Escreva uma mensagem.');
    
    // Fetch all student IDs from selected classes
    const studentIds: string[] = [];
    for (const classId of selectedClasses) {
      const cls = await db.classes.get(classId);
      if (cls && cls.studentIds) {
        studentIds.push(...cls.studentIds);
      }
    }

    if (studentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(studentIds));
      await createBulkNotifications(
        uniqueStudentIds,
        'student',
        'Novo Comunicado! 📣',
        `Professor ${user?.name}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
        'info',
        'normal',
        '/student/dashboard'
      );
    }

    toast.success('Comunicado enviado com sucesso!');
    onClose();
    setMessage('');
    setSelectedClasses([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden"
          >
            <div className="bg-primary-600 p-10 text-white relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <button 
                  type="button"
                  onClick={onClose}
                  className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all shadow-lg"
                >
                  <X size={20} />
                </button>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 backdrop-blur-sm border border-white/10">
                  <Megaphone size={32} className="stroke-[2.5]" />
                </div>
                <h2 className="text-3xl font-black tracking-tight relative z-10">Novo Comunicado</h2>
                <p className="text-primary-100 font-medium mt-1 relative z-10">Envie avisos, lembretes ou incentivos para suas turmas.</p>
            </div>
            
            <div className="p-10 space-y-8">
               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Destinatários</label>
                  <div className="flex flex-wrap gap-2">
                     {classes.map(c => (
                       <button
                         key={c.id}
                         type="button"
                         onClick={() => toggleClass(c.id)}
                         className={cn(
                           "px-5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer",
                           selectedClasses.includes(c.id)
                             ? "bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20 scale-105"
                             : "bg-white border-slate-100 text-slate-500 hover:border-primary-200"
                         )}
                       >
                         {c.name}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sua Mensagem</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex: Não esqueçam da atividade de Frações hoje! 🚀"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-6 text-sm font-medium focus:bg-white focus:border-primary-500/20 outline-none transition-all resize-none min-h-[150px]"
                  />
               </div>

               <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-4 text-slate-400">
                     <button type="button" className="p-2 hover:text-primary-500 transition-colors"><Calendar size={20} /></button>
                     <button type="button" className="p-2 hover:text-primary-500 transition-colors"><Bell size={20} /></button>
                     <button type="button" className="p-2 hover:text-primary-500 transition-colors"><Sparkles size={20} /></button>
                  </div>
                  <div className="flex gap-4">
                     <Button 
                        type="button"
                        onClick={onClose}
                        variant="ghost" 
                        className="rounded-2xl font-bold text-slate-400"
                     >
                        Cancelar
                     </Button>
                     <Button 
                       type="button"
                       onClick={handleSend}
                       variant="primary" 
                       className="rounded-[1.5rem] font-black px-10 gap-2 shadow-xl shadow-primary-500/20"
                     >
                       Enviar Agora <Send size={18} />
                     </Button>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
