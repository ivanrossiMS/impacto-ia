import React from 'react';
import { Home, Search, AlertOctagon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-outfit">
            <div className="max-w-2xl w-full text-center space-y-12">
                <div className="relative">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                        <span className="text-[20rem] font-black">404</span>
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center gap-8">
                        <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-red-500 border-2 border-slate-100 rotate-6 hover:rotate-0 transition-transform duration-500">
                             <AlertOctagon size={64} className="stroke-[1.5]" />
                        </div>
                        
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black text-slate-900 tracking-tight">Opa! Caminho sem saída.</h1>
                            <p className="text-xl text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                                Parece que o link que você tentou acessar não existe ou foi movido para outra dimensão.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button 
                        onClick={() => navigate(-1)}
                        variant="outline" 
                        size="lg" 
                        className="rounded-[1.5rem] px-10 gap-3 font-bold border-2 border-slate-200"
                    >
                        <ArrowLeft size={20} /> Voltar
                    </Button>
                    <Button 
                        onClick={() => navigate('/')}
                        variant="primary" 
                        size="lg" 
                        className="rounded-[1.5rem] px-10 gap-3 font-black shadow-xl shadow-primary-500/20"
                    >
                        <Home size={20} /> Página Inicial
                    </Button>
                </div>

                <div className="pt-12 border-t border-slate-200/60 max-w-xs mx-auto">
                    <div className="flex items-center justify-center gap-3 text-slate-400">
                        <Search size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Dica: Use a busca global</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
