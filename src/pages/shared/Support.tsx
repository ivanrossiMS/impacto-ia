import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send,
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  LifeBuoy
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/auth.store';

export const Support: React.FC = () => {
  const { user } = useAuthStore();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [tickets, setTickets] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const fetchTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('userId', user.id)
      .order('updatedAt', { ascending: false });
    setTickets(data || []);
  };

  const fetchMessages = async () => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticketId', selectedTicketId)
      .order('createdAt', { ascending: true });
    setMessages(data || []);
  };

  React.useEffect(() => {
    fetchTickets();
    const ch = supabase.channel('support_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `userId=eq.${user?.id}` }, fetchTickets)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  React.useEffect(() => {
    fetchMessages();
    if (selectedTicketId) {
      const ch = supabase.channel(`ticket_msgs_${selectedTicketId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages', filter: `ticketId=eq.${selectedTicketId}` }, fetchMessages)
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [selectedTicketId]);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !message.trim()) return;

    setIsLoading(true);
    try {
      const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      const newTicket = {
        id: ticketId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        schoolId: user.schoolId,
        subject,
        status: 'open' as const,
        priority: 'medium' as const,
        createdAt: now,
        updatedAt: now,
        lastMessage: message,
        isReadByParticipant: true,
        isReadByAdmin: false
      };

      await supabase.from('support_tickets').insert(newTicket);
      await supabase.from('ticket_messages').insert({
        id: crypto.randomUUID(),
        ticketId,
        senderId: user.id,
        senderName: user.name,
        content: message,
        createdAt: now,
        senderRole: user.role
      });

      toast.success('Chamado aberto com sucesso!');
      setSubject('');
      setMessage('');
      setIsCreating(false);
      setSelectedTicketId(ticketId);
    } catch (error) {
      toast.error('Erro ao abrir chamado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedTicketId || !replyText.trim()) return;

    try {
      const now = new Date().toISOString();
      const newMessage = {
        id: crypto.randomUUID(),
        ticketId: selectedTicketId,
        senderId: user.id,
        senderName: user.name,
        content: replyText,
        createdAt: now,
        senderRole: user.role
      };
      
      await supabase.from('ticket_messages').insert(newMessage);
      await supabase.from('support_tickets').update({ 
        updatedAt: now,
        lastMessage: replyText,
        status: 'open', // Reopen/keep open when user sends message
        isReadByAdmin: false,
        isReadByParticipant: true
      }).eq('id', selectedTicketId);

      setReplyText('');
    } catch (error) {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <LifeBuoy size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Atendimento</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Como podemos <span className="text-primary-600">ajudar?</span></h1>
          <p className="text-slate-500 font-medium font-outfit">Estamos aqui para tirar suas dúvidas e resolver problemas.</p>
        </div>
        {!isCreating && !selectedTicketId && (
          <Button onClick={() => setIsCreating(true)} className="rounded-2xl font-bold gap-2 py-6 px-8 shadow-lg shadow-primary-500/20 active:scale-95 transition-all">
            <Plus size={20} /> Novo Chamado
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-h-[600px]">
        {/* Sidebar / List */}
        <div className={cn(
          "md:col-span-1 space-y-4 transition-all",
          (selectedTicketId || isCreating) && "hidden md:block"
        )}>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Meus Chamados</h3>
          <div className="space-y-3">
            {tickets.length > 0 ? (
              tickets.map((t) => (
                <Card 
                  key={t.id}
                  onClick={() => {
                    setSelectedTicketId(t.id);
                    supabase.from('support_tickets').update({ isReadByParticipant: true }).eq('id', t.id);
                  }}
                  className={cn(
                    "p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all border-slate-100 relative",
                    selectedTicketId === t.id && "border-primary-500 bg-primary-50/30 ring-1 ring-primary-500/10"
                  )}
                >
                  {/* Notification Dot for user */}
                  {!t.isReadByParticipant && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50 animate-pulse" />
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.id}</span>
                    <Badge variant={t.status === 'resolved' ? 'success' : 'primary'} className="scale-75 origin-right uppercase">
                      {t.status === 'resolved' ? 'Resolvido' : t.status === 'pending' ? 'Resposta' : 'Aberto'}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mb-1">{t.subject}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1 italic mb-2">"{t.lastMessage}"</p>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">{format(new Date(t.createdAt), "dd/MM/yy HH:mm")}</span>
                  </div>
                </Card>
              ))
            ) : (
              <div className="p-10 text-center opacity-50 border-2 border-dashed border-slate-200 rounded-3xl">
                <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-xs font-bold text-slate-400">Nenhum chamado aberto ainda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <Card className="md:col-span-2 p-0 overflow-hidden border-slate-100 flex flex-col bg-white shadow-xl min-h-[600px]">
          {isCreating ? (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <button onClick={() => setIsCreating(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <h3 className="text-lg font-black text-slate-800">Novo Chamado</h3>
                <div className="w-10" />
              </div>
              <form onSubmit={handleCreateTicket} className="p-8 space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Assunto / Tópico</label>
                  <input 
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Dificuldade com atividade de Português"
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:bg-white focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sua Mensagem</label>
                  <textarea 
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva detalhadamente o que está acontecendo..."
                    className="w-full flex-1 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-medium focus:bg-white focus:border-primary-500 outline-none transition-all resize-none placeholder:text-slate-300 min-h-[250px]"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-6 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary-500/20"
                >
                  {isLoading ? 'Enviando...' : 'Abrir Chamado'}
                  {!isLoading && <Send size={20} />}
                </Button>
              </form>
            </div>
          ) : selectedTicket ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Ticket Header */}
              <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedTicketId(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors md:hidden">
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{selectedTicket.id}</span>
                      <span className="text-slate-300">•</span>
                      <Badge variant={selectedTicket.status === 'resolved' ? 'success' : 'primary'} className="scale-75 origin-left uppercase">
                        {selectedTicket.status === 'resolved' ? 'Resolvido' : 'Em atendimento'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[450px] custom-scrollbar">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1 max-w-[85%]",
                      msg.senderId === user?.id ? "self-end items-end" : "self-start items-start"
                    )}
                  >
                    <div className={cn(
                      "p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm border",
                      msg.senderId === user?.id 
                        ? "bg-primary-600 text-white border-primary-500 rounded-tr-none" 
                        : "bg-slate-100 text-slate-800 border-slate-200 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      {format(new Date(msg.createdAt), 'HH:mm')} • {msg.senderId === user?.id ? 'Você' : 'Suporte Impacto IA'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              {selectedTicket.status !== 'resolved' ? (
                <div className="p-6 border-t border-slate-50 mt-auto">
                  <div className="relative">
                    <input 
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Responda para o suporte..."
                      className="w-full p-4 pr-14 bg-slate-50 border-2 border-slate-100 rounded-2xl font-medium focus:bg-white focus:border-primary-500 outline-none transition-all"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!replyText.trim()}
                      className="absolute right-2 top-2 p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-3 mt-auto">
                  <CheckCircle2 size={16} className="text-success-600" />
                  <span className="text-xs font-bold text-slate-400 italic">Este chamado foi resolvido e encerrado.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 border border-slate-100 shadow-inner">
                <LifeBuoy size={40} className="text-primary-100" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Estamos Prontos para Ouvir</h3>
                <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm leading-relaxed">
                  Selecione um chamado existente ou abra um novo caso para falar com nossa equipe técnica.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm mt-4">
                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-success-50 text-success-600 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="text-left leading-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Tempo Médio</div>
                    <div className="text-sm font-bold text-slate-800">15 min</div>
                  </div>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <AlertCircle size={16} />
                  </div>
                  <div className="text-left leading-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Suporte</div>
                    <div className="text-sm font-bold text-slate-800">24 / 7</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
