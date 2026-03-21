import React from 'react';
import { Card } from '../../components/ui/Card';
import { Send, Search, MoreVertical, Paperclip, Smile } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const Messages: React.FC = () => {
  const conversations = [
    { id: 1, name: 'Prof. Carlos Mendes', role: 'Matemática', lastMsg: 'Sofia foi muito bem no simulado!', date: '10:45', unread: true },
    { id: 2, name: 'Coordenação Pedagógica', role: 'Escola Central', lastMsg: 'Lembrete da reunião de pais amanhã.', date: 'Ontem', unread: false },
    { id: 3, name: 'Tutor IA (Suporte)', role: 'Impacto IA', lastMsg: 'Sua assinatura premium foi renovada.', date: '15 Mar', unread: false },
  ];

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Sidebar de Mensagens */}
      <aside className="w-full md:w-80 flex flex-col gap-6">
        <header className="flex justify-between items-center">
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Canal Direto</h1>
           <Badge variant="primary" className="bg-slate-900 text-white border-0">3 Contatos</Badge>
        </header>

        <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
           <input 
             type="text" 
             placeholder="Buscar conversas..." 
             className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
           />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
           {conversations.map((conv) => (
             <Card 
               key={conv.id} 
               className={`p-4 cursor-pointer hover:border-primary-100 transition-all group ${conv.unread ? 'border-primary-200 bg-primary-50/10' : 'border-slate-100'}`}
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 group-hover:bg-primary-500 group-hover:text-white transition-all">
                      {conv.name[0]}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                         <h4 className="text-sm font-black text-slate-800 truncate">{conv.name}</h4>
                         <span className="text-[9px] font-bold text-slate-400">{conv.date}</span>
                      </div>
                      <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">{conv.role}</p>
                      <p className="text-xs text-slate-500 truncate leading-tight">{conv.lastMsg}</p>
                   </div>
                   {conv.unread && <div className="w-2 h-2 bg-primary-500 rounded-full shadow-lg shadow-primary-500/50"></div>}
                </div>
             </Card>
           ))}
        </div>
      </aside>

      {/* Janela de Chat */}
      <main className="hidden md:flex flex-1 flex-col bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
         <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center font-black text-slate-500 shadow-inner">
                  CM
               </div>
               <div>
                  <h3 className="font-extrabold text-slate-800 leading-tight">Prof. Carlos Mendes</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <div className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse"></div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativo agora</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2.5 text-slate-400 hover:bg-white rounded-xl transition-all">
                  <Search size={20} />
               </button>
               <button className="p-2.5 text-slate-400 hover:bg-white rounded-xl transition-all">
                  <MoreVertical size={20} />
               </button>
            </div>
         </header>

         <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.01)_1px,transparent_1px)] bg-[length:20px_20px]">
            <div className="flex flex-col gap-6">
               <div className="flex gap-4">
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-bold shrink-0">C</div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl rounded-tl-none max-w-md shadow-sm">
                     <p className="text-sm font-medium text-slate-700 leading-relaxed">
                        Olá! Gostaria de informar que a Sofia teve um desempenho excepcional na atividade de frações hoje. Ela ajudou outros alunos!
                     </p>
                     <span className="text-[9px] font-bold text-slate-400 block mt-2 text-right">10:42</span>
                  </div>
               </div>

               <div className="flex gap-4 flex-row-reverse">
                  <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg shadow-primary-500/20">V</div>
                  <div className="bg-slate-900 p-4 rounded-3xl rounded-tr-none max-w-md shadow-xl">
                     <p className="text-sm font-medium text-slate-200 leading-relaxed">
                        Que notícia maravilhosa, Professor! Ficamos muito felizes em saber. Alguma recomendação extra para reforçar o aprendizado dela?
                     </p>
                     <span className="text-[9px] font-black text-primary-400 uppercase mt-2 block text-right tracking-widest">ENTREGUE</span>
                  </div>
               </div>
            </div>
         </div>

         <footer className="p-6 bg-slate-50/50 border-t border-slate-100">
            <div className="flex items-center gap-4 bg-white p-2.5 rounded-[1.5rem] border border-slate-200 shadow-inner group focus-within:border-primary-300 transition-all">
               <button className="p-2 text-slate-400 hover:text-primary-500 transition-colors">
                  <Paperclip size={20} />
               </button>
               <input 
                  type="text" 
                  placeholder="Escreva sua mensagem..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold placeholder:text-slate-300"
               />
               <button className="p-2 text-slate-400 hover:text-warning-500 transition-colors">
                  <Smile size={20} />
               </button>
               <Button variant="primary" size="sm" className="rounded-2xl w-11 h-11 bg-slate-900 hover:bg-slate-800 shadow-lg p-0">
                  <Send size={20} className="text-white" />
               </Button>
            </div>
         </footer>
      </main>
    </div>
  );
};
