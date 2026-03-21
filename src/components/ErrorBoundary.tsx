import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-outfit">
          <div className="max-w-md w-full text-center space-y-10">
            <div className="relative inline-block">
               <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
               <div className="relative w-24 h-24 bg-red-500 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-white/10 mx-auto">
                  <AlertTriangle size={48} className="text-white" />
               </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight">Eita! Algo deu errado.</h1>
              <p className="text-slate-400 font-medium leading-relaxed">
                Nossos robôs capivaras encontraram um probleminha técnico. Não se preocupe, seus dados estão seguros!
              </p>
            </div>

            {this.state.error && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                    <div className="text-[10px] font-black uppercase text-slate-500 mb-2">Detalhes do Erro</div>
                    <code className="text-xs text-red-300 break-all">{this.state.error.message}</code>
                </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
               <Button 
                 variant="primary" 
                 size="lg" 
                 className="w-full rounded-2xl font-black gap-2 shadow-2xl shadow-primary-500/20"
                 onClick={() => window.location.reload()}
               >
                 <RefreshCcw size={20} /> Tentar Novamente
               </Button>
               <Button 
                 variant="ghost" 
                 size="lg" 
                 className="w-full rounded-2xl font-bold text-slate-400 hover:text-white"
                 onClick={() => window.location.href = '/'}
               >
                 <Home size={20} /> Ir para Início
               </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
