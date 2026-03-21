import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, User, Shield, GraduationCap, Sparkles } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [role, setRole] = useState<'student' | 'guardian' | 'teacher' | 'admin'>('student');
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

  const RoleCard = ({ type, icon: Icon, label, desc }: { type: any, icon: any, label: string, desc: string }) => (
    <button
      type="button"
      onClick={() => {
        setRole(type);
        setCode('');
        setPassword('');
      }}
      className={`p-4 rounded-xl border-2 text-left transition-all ${
        role === type 
          ? 'border-primary-500 bg-primary-50 shadow-sm ring-1 ring-primary-500 ring-opacity-50' 
          : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
      }`}
    >
      <Icon className={`mb-2 ${role === type ? 'text-primary-600' : 'text-slate-400'}`} size={24} />
      <div className={`font-bold ${role === type ? 'text-primary-900' : 'text-slate-700'}`}>{label}</div>
      <div className="text-xs text-slate-500 mt-1">{desc}</div>
    </button>
  );

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
          Escolha seu perfil para continuar
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-surface py-10 px-6 shadow-floating rounded-[2rem] sm:px-12 border border-white">
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <RoleCard type="student" icon={User} label="Aluno" desc="Aprender" />
            <RoleCard type="guardian" icon={Shield} label="Familiar" desc="Acompanhar" />
            <RoleCard type="teacher" icon={GraduationCap} label="Professor" desc="Ensinar" />
            <RoleCard type="admin" icon={Bot} label="Escola" desc="Gestão" />
          </div>

          <form className="space-y-6 max-w-md mx-auto" onSubmit={handleLogin}>
            <div>
              <label htmlFor="code" className="block text-sm font-bold text-slate-700 mb-2">
                E-mail
              </label>
              <div className="mt-1">
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="appearance-none block w-full px-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 transition-colors font-medium"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                  Senha
                </label>
                <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-500">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 transition-colors font-medium text-slate-900"
                  placeholder="Sua senha secreta"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-card text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {isLoading ? 'Entrando...' : 'Entrar na Plataforma'}
              </button>
            </div>

            <div className="text-center">
              <Link 
                to={`/primeiro-acesso?role=${role}`}
                className="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> É seu primeiro acesso? Comece aqui
              </Link>
            </div>
            
            {/* Helpful hint for master admin */}
            <div className="mt-6 text-xs text-center text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
              <span className="font-bold block mb-2 text-slate-700 text-primary-700 uppercase tracking-wider">Acesso Master</span>
              <div className="text-center font-medium">
                ivanrossi@outlook.com <br/>
                <span className="text-slate-400">senha:</span> ivanrossi
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
