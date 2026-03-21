import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Mail, Lock, Sparkles } from 'lucide-react';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export const FirstAccess: React.FC = () => {
  const [role, setRole] = useState<'student' | 'guardian' | 'teacher' | 'admin' | null>(null);
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
      // Use unified validation (auto-detects role)
      const user = await authService.validateFirstAccessUnified(identifier);
      
      if (user) {
        setTempUser(user);
        setRole(user.role); // Identifies role automatically!
        setStep('register');
        toast.success(`Olá, ${user.name}! Notamos que este é seu primeiro acesso. Vamos configurar sua senha.`);
      } else {
        toast.error('Dados não encontrados ou você já possui cadastro. Verifique as informações ou procure a secretaria.');
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

                <form className="space-y-6" onSubmit={handleValidate}>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                      Código/E-mail
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                        <Mail size={20} />
                      </div>
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                        placeholder="Seu código ou e-mail"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Validando...
                      </div>
                    ) : (
                      <>
                        Validar Meus Dados
                        <ArrowRight size={20} />
                      </>
                    )}
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
                      <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                        {role === 'student' ? 'Escolha um E-mail para Login' : 'Cadastre seu E-mail para Login'}
                      </label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                          <Mail size={20} />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                          placeholder="seu.nome@exemplo.com"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                      Criar Nova Senha
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                        <Lock size={20} />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                        placeholder="Mínimo 4 caracteres"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                      Confirmar Senha
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                        <Lock size={20} />
                      </div>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 mt-6"
                   >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Registrando...
                      </div>
                    ) : 'Finalizar e Acessar'}
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
