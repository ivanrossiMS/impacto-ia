import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Mail, Lock, Sparkles } from 'lucide-react';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export const FirstAccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as any) || 'student';
  
  const [role, setRole] = useState<'student' | 'guardian' | 'teacher' | 'admin'>(initialRole);
  const [step, setStep] = useState<'validate' | 'register'>('validate');
  const [identifier, setIdentifier] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // First, check if user exists at all (even if registered)
      const user = await authService.validateFirstAccess(role, identifier);
      
      if (user) {
        setTempUser(user);
        setStep('register');
        toast.success(`Olá, ${user.name}! Notamos que este é seu primeiro acesso. Vamos configurar sua senha.`);
      } else {
        // Try to see if they are already registered
        const allUsers = await authService.getCurrentUserByRoleAndId(role, identifier);
        if (allUsers && allUsers.isRegistered) {
          toast.info('Você já possui cadastro! Use sua senha na tela de login.', {
             action: {
               label: 'Ir para Login',
               onClick: () => navigate('/login')
             }
          });
        } else {
          toast.error('Dados não encontrados. Verifique as informações ou procure a secretaria da escola.');
        }
      }
    } catch (error) {
      toast.error('Erro ao validar dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'student' && !email) {
      toast.error('O e-mail é obrigatório para o login do aluno.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (password.length < 4) {
      toast.error('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const finalEmail = (role === 'student' || !tempUser.email) ? email : tempUser.email;
      
      await authService.registerFirstAccess(tempUser.id, {
        email: finalEmail,
        passwordHash: password
      });
      toast.success('Cadastro realizado com sucesso! Agora você pode fazer login.');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao realizar cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIdentifierLabel = () => {
    switch (role) {
      case 'student': return 'Código do Aluno';
      case 'guardian': return 'E-mail do Responsável';
      case 'teacher': return 'E-mail do Professor';
      case 'admin': return 'E-mail do Administrador';
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-special-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-special-500 text-white shadow-xl mb-6">
          <Sparkles size={40} />
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Primeiro Acesso
        </h2>
        <p className="mt-3 text-lg text-slate-600">
          Vamos ativar sua conta no Impacto IA
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-surface py-10 px-6 shadow-floating rounded-[2rem] sm:px-12 border border-white">
          
          <AnimatePresence mode="wait">
            {step === 'validate' ? (
              <motion.div
                key="validate"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="mb-6 grid grid-cols-2 gap-2">
                  {(['student', 'guardian', 'teacher', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                        role === r 
                          ? 'border-primary-500 bg-primary-50 text-primary-700' 
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'student' ? 'Aluno' : r === 'teacher' ? 'Professor' : r === 'guardian' ? 'Familiar' : 'Gestor'}
                    </button>
                  ))}
                </div>

                <form className="space-y-6" onSubmit={handleValidate}>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {getIdentifierLabel()}
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      className="appearance-none block w-full px-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 transition-colors font-medium"
                      placeholder={role === 'student' ? 'Seu código único' : 'Seu e-mail cadastrado'}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-card text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {isLoading ? 'Validando...' : 'Validar Meus Dados'}
                    {!isLoading && <ArrowRight size={20} />}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-success-100 text-success-600 rounded-full mb-4">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Olá, {tempUser?.name}!</h3>
                  <p className="text-sm text-slate-500 mt-1">Dados validados com sucesso. Agora defina suas credenciais.</p>
                </div>

                <form className="space-y-4" onSubmit={handleRegister}>
                  {(role === 'student' || (tempUser && !tempUser.email)) && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        {role === 'student' ? 'Escolha um E-mail para Login' : 'Cadastre seu E-mail para Login'}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 font-medium"
                          placeholder="seu.nome@exemplo.com"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Criar Nova Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 font-medium"
                        placeholder="Mínimo 4 caracteres"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Confirmar Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50 font-medium"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-card text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 mt-6"
                  >
                    {isLoading ? 'Registrando...' : 'Finalizar e Acessar'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              Voltar para o Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
