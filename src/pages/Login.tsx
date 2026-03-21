import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Sparkles, User, Lock } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const user = await authService.loginWithEmail(code, password);

      if (user) {
        login(user);
        toast.success(`Bem-vindo(a), ${user.name}!`);
        navigate(`/${user.role}`);
      } else {
        toast.error('Credenciais inválidas ou conta não registrada no Primeiro Acesso.');
      }
    } catch (error) {
      toast.error('Erro ao fazer login.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-6 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-special-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-special-500 text-white shadow-xl mb-6">
          <Bot size={40} />
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Entrar no Impacto IA
        </h2>
        <p className="mt-3 text-lg text-slate-600">
          Acesse sua conta para continuar
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-surface py-10 px-6 shadow-floating rounded-[2rem] sm:px-12 border border-white">
          

          <form className="space-y-6 max-w-md mx-auto" onSubmit={handleLogin}>
            <div className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                  Código/E-mail
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <User size={20} />
                  </div>
                  <input
                    id="code"
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                    placeholder="Seu código ou e-mail"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                    Senha
                  </label>
                  <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-500 transition-colors">
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium text-slate-900"
                    placeholder="Sua senha secreta"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : 'Entrar na Plataforma'}
              </button>
            </div>

            <div className="text-center">
              <Link 
                to="/primeiro-acesso"
                className="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> É seu primeiro acesso? Comece aqui
              </Link>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
};
