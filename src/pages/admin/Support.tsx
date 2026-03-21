import React, { useState } from 'react';
import { 
  MessageSquare, 
  User, 
  Send,
  Search,
  Trash2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../store/auth.store';

export const AdminSupport: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const userSchoolId = user?.schoolId;

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');

  const schools = useLiveQuery(() => db.schools.toArray()) || [];

  const tickets = useLiveQuery(async () => {
    const allTickets = await db.supportTickets.toArray();
    const allUsers = await db.users.toArray();
    
    return allTickets.filter(t => {
      const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.userName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Admin Master sees everything. 
      // Regular Admin only sees their school.
      let matchesAccess = true;
      
      if (isAdminMaster) {
        if (selectedSchoolId !== 'all') {
          matchesAccess = t.schoolId === selectedSchoolId;
        }
      } else {
        if (t.schoolId) {
          matchesAccess = t.schoolId === userSchoolId;
        } else {
          // Fallback for older tickets without schoolId
          const ticketUser = allUsers.find(u => u.id === t.userId);
          matchesAccess = (ticketUser as any)?.schoolId === userSchoolId;
        }
      }
      
      return matchesSearch && matchesAccess;
    });
  }, [searchTerm, isAdminMaster, userSchoolId, selectedSchoolId]) || [];

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);
  
  const messages = useLiveQuery(async () => {
    if (!selectedTicketId) return [];
    return db.ticketMessages
      .where('ticketId')
      .equals(selectedTicketId)
      .sortBy('createdAt');
  }, [selectedTicketId]) || [];

  const handleSendMessage = async () => {
    if (!selectedTicketId || !replyText.trim()) return;

    try {
      const newMessage = {
        id: crypto.randomUUID(),
        ticketId: selectedTicketId,
        senderId: user?.id || 'admin-master', // Use current admin ID
        senderName: 'Suporte Impacto IA',
        content: replyText,
        createdAt: new Date().toISOString(),
        senderRole: 'admin'
      };

      await db.ticketMessages.add(newMessage);
      await db.supportTickets.update(selectedTicketId, { 
        updatedAt: new Date().toISOString(),
        lastMessage: replyText,
        status: 'pending',
        isReadByParticipant: false,
        isReadByAdmin: true
      });

      setReplyText('');
      toast.success('Resposta enviada!');
    } catch (error) {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  const handleDeleteTicket = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este chamado permanentemente?')) return;

    try {
      await db.supportTickets.delete(id);
      await db.ticketMessages.where('ticketId').equals(id).delete();
      if (selectedTicketId === id) setSelectedTicketId(null);
      toast.success('Chamado excluído com sucesso.');
    } catch (error) {
      toast.error('Erro ao excluir chamado.');
    }
  };

  const handleToggleStatus = async (ticket: any) => {
    const newStatus = ticket.status === 'resolved' ? 'open' : 'resolved';
    try {
      await db.supportTickets.update(ticket.id, { status: newStatus });
      toast.success(`Chamado ${newStatus === 'resolved' ? 'resolvido' : 'reaberto'}.`);
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };


  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <MessageSquare size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Atendimento</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Central de <span className="text-primary-600">Suporte</span></h1>
          <p className="text-slate-500 font-medium font-outfit">Gerencie chamados e dúvidas de professores, alunos e pais.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[750px]">
        {/* Ticket List */}
        <Card className="lg:col-span-1 p-0 overflow-hidden border-slate-100 flex flex-col bg-white shadow-xl shadow-slate-200/50">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="Pesquisar chamados..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary-400 transition-all shadow-sm"
                   />
                </div>
                {isAdminMaster && (
                  <select 
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary-400 transition-all shadow-sm min-w-[180px]"
                  >
                    <option value="all">Todas Escolas</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
             </div>
             <div className="flex gap-2">
                <Badge variant="primary" className="py-1.5 px-3">Total: {tickets.length}</Badge>
                <Badge variant="success" className="py-1.5 px-3">Abertos: {tickets.filter(t => t.status !== 'resolved').length}</Badge>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {tickets.length > 0 ? tickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    db.supportTickets.update(ticket.id, { isReadByAdmin: true });
                  }}
                  className={cn(
                    "p-6 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 relative group",
                    selectedTicketId === ticket.id && "bg-primary-50/50 border-l-4 border-l-primary-500"
                  )}
                >
                   {/* Notification Dot for admin */}
                   {!ticket.isReadByAdmin && (
                     <div className="absolute top-6 right-10 w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50 animate-pulse" />
                   )}
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ticket.id}</span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          ticket.priority === 'high' ? "bg-red-500" : ticket.priority === 'medium' ? "bg-warning-500" : "bg-primary-500"
                        )}></div>
                        <button 
                          onClick={(e) => handleDeleteTicket(ticket.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                   </div>
                   <h4 className="text-sm font-black text-slate-800 mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">{ticket.subject}</h4>
                   <div className="flex items-center gap-2 mb-3">
                      <User size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500">{ticket.userName}</span>
                      <Badge variant={ticket.status === 'resolved' ? 'success' : 'primary'} className="scale-[0.7] origin-left uppercase">
                        {ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'open' ? 'Aberto' : 'Pendente'}
                      </Badge>
                   </div>
                   <p className="text-[11px] text-slate-400 italic line-clamp-1 mb-2">"{ticket.lastMessage}"</p>
                   <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={10} />
                      <span className="text-[9px] font-bold uppercase tracking-wider">{format(new Date(ticket.createdAt), "dd/MM/yy HH:mm")}</span>
                   </div>
                </div>
             )) : (
               <div className="p-10 text-center space-y-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-400">Nenhum chamado disponível.</p>
               </div>
             )}
          </div>
        </Card>

        {/* Conversation View */}
        <Card className="lg:col-span-2 p-0 overflow-hidden border-slate-100 flex flex-col bg-white shadow-2xl shadow-slate-200/50">
          {selectedTicket ? (
            <>
              <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between shadow-sm relative z-10">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-primary-50 text-primary-500 rounded-2xl flex items-center justify-center border border-primary-100 shadow-inner">
                       <User size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-slate-800 leading-tight">{selectedTicket.subject}</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-bold text-slate-500">{selectedTicket.userName}</span>
                          <span className="text-slate-300">•</span>
                          <Badge variant="primary" className="scale-75 origin-left uppercase">{selectedTicket.userRole}</Badge>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedTicket.id}</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <Button 
                      variant={selectedTicket.status === 'resolved' ? 'success' : 'outline'} 
                      size="sm" 
                      onClick={() => handleToggleStatus(selectedTicket)}
                      className="rounded-xl font-bold gap-2"
                    >
                      {selectedTicket.status === 'resolved' ? <CheckCircle size={16} /> : <Clock size={16} />}
                      {selectedTicket.status === 'resolved' ? 'Reabrir' : 'Resolver'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteTicket(selectedTicket.id)}
                      className="rounded-xl font-bold text-red-500 hover:bg-red-50 border-red-100"
                    >
                      <Trash2 size={16} />
                    </Button>
                 </div>
              </div>

              <div className="flex-1 bg-slate-50/30 p-8 overflow-y-auto space-y-8 font-outfit custom-scrollbar">
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] bg-white px-6 py-2 rounded-full border border-slate-100 shadow-sm">
                      Ticket criado em {format(new Date(selectedTicket.createdAt), "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                 </div>

                 {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                        msg.senderRole === 'admin' ? "flex-row-reverse self-end" : "self-start"
                      )}
                    >
                       <div className={cn(
                         "w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-sm font-black border shadow-sm",
                         msg.senderRole === 'admin' ? "bg-primary-600 text-white border-primary-500" : "bg-white text-slate-600 border-slate-200"
                       )}>
                          {msg.senderName[0]}
                       </div>
                       <div className={cn(
                         "space-y-2",
                         msg.senderRole === 'admin' ? "text-right" : "text-left"
                       )}>
                          <div className={cn(
                            "p-5 rounded-[2rem] shadow-sm border text-sm font-medium leading-relaxed",
                            msg.senderRole === 'admin' 
                              ? "bg-primary-600 text-white border-primary-500 rounded-tr-none" 
                              : "bg-white text-slate-700 border-slate-100 rounded-tl-none"
                          )}>
                             <p>{msg.content}</p>
                          </div>
                          <span className="text-[9px] font-black text-slate-400 px-2 uppercase tracking-widest">
                            {format(new Date(msg.createdAt), 'HH:mm')} • {msg.senderName}
                          </span>
                       </div>
                    </div>
                 ))}
              </div>

              <div className="p-8 border-t border-slate-100 bg-white shadow-top">
                 <div className="relative group">
                    <textarea 
                      placeholder="Escreva sua resposta para o usuário..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleSendMessage();
                      }}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-8 py-6 text-sm font-medium focus:bg-white focus:border-primary-500/20 outline-none transition-all resize-none min-h-[140px] shadow-inner"
                    />
                    <div className="absolute bottom-6 right-6 flex items-center gap-3">
                       <span className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Ctrl + Enter para enviar</span>
                       <Button 
                         onClick={handleSendMessage}
                         disabled={!replyText.trim()}
                         size="sm" 
                         variant="primary" 
                         className="rounded-2xl font-black px-10 py-5 gap-2 shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-500/30 transition-all active:scale-95"
                       >
                          <Send size={18} /> Enviar Resposta
                       </Button>
                    </div>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/30">
               <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-200 mb-8 border border-slate-100 shadow-xl shadow-slate-200/20">
                  <MessageSquare size={48} className="text-primary-200" />
               </div>
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Central de Atendimento</h3>
               <p className="text-slate-400 font-medium max-w-sm mt-3 font-outfit">
                 Selecione um chamado na lista lateral para gerenciar a conversa, resolver o problema ou excluir o registro.
               </p>
               <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                    <div className="text-xl font-black text-primary-500">{tickets.filter(t => t.status === 'open').length}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Chamados Abertos</div>
                  </div>
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                    <div className="text-xl font-black text-success-500">{tickets.filter(t => t.status === 'resolved').length}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Resolvidos</div>
                  </div>
               </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

