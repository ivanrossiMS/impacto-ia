import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Minimize2 } from 'lucide-react';

import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export const AITutorWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chat, setChat] = useState<{role: 'ai' | 'user', text: string}[]>([
    { role: 'ai', text: 'Olá! Sou seu tutor Capivara IA. Estou aqui para te ajudar a superar qualquer desafio! O que vamos aprender hoje? 💡' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, isTyping]);

  const handleSend = () => {
    if (!message.trim()) return;
    const userMsg = message;
    setChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setMessage('');
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setChat(prev => [...prev, { role: 'ai', text: 'Essa é uma ótima pergunta! Vamos pensar juntos: como você abordaria isso se estivéssemos em uma aventura na floresta? 🤔' }]);
    }, 2000);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {!isOpen ? (
          <motion.button 
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 bg-gradient-to-br from-special-500 to-special-600 text-white rounded-3xl shadow-floating flex items-center justify-center relative group"
          >
            <Bot size={32} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-energy-500 rounded-full border-2 border-white flex items-center justify-center">
              <Sparkles size={10} />
            </div>
            <div className="absolute right-full mr-4 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Dúvidas? Chame a IA!
            </div>
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="w-[400px] h-[600px] flex flex-col"
          >
            <Card variant="glass" className="h-full flex flex-col p-0 overflow-hidden border-special-100 shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-special-600 to-special-700 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20">
                    <Bot size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-white leading-none mb-1">Capivara IA</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-special-100 uppercase tracking-widest">Tutor Online</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-xl transition-colors text-white">
                    <Minimize2 size={20} />
                  </button>
                </div>
              </div>

              {/* Chat Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth no-scrollbar"
              >
                {chat.map((msg, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[85%] rounded-[2rem] p-5 text-sm font-medium shadow-sm",
                      msg.role === 'user' 
                        ? "bg-primary-600 text-white rounded-tr-none" 
                        : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-white border border-slate-100 rounded-[2rem] rounded-tl-none p-4 flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-special-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-special-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-special-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 mt-auto">
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Sua dúvida aqui..."
                    className="flex-1 bg-white border-2 border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-special-500 transition-colors shadow-inner"
                  />
                  <Button 
                    variant="ai"
                    onClick={handleSend}
                    className="aspect-square p-0 w-12 rounded-2xl"
                  >
                    <Send size={20} />
                  </Button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest">
                  IA Generativa para Educação
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
