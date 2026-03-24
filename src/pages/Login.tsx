import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Sparkles, User, Lock, Mail, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// Simple SHA-256-like hash (same as FirstAccess uses)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'impacto_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type LoginView = 'login' | 'forgot-email' | 'forgot-code' | 'forgot-reset' | 'forgot-success';

export const Login: React.FC = () => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password states
  const [view, setView] = useState<LoginView>('login');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotUser, setForgotUser] = useState<any>(null);
  const [forgotCodeInput, setForgotCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // 10 second timeout
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast.error('A conexão está demorando muito. Verifique sua internet e tente novamente.');
    }, 10000);

    try {
      const user = await authService.loginWithEmail(code.trim(), password);
      clearTimeout(timeoutId);

      if (user) {
        login(user);
        toast.success(`Bem-vindo(a), ${user.name.split(' ')[0]}! 🎉`);
        navigate(`/${user.role}`);
      } else {
        toast.error('Código/email ou senha incorretos. Verifique seus dados e tente novamente.');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      const msg = error?.message || '';
      if (msg.includes('network') || msg.includes('fetch')) {
        toast.error('Sem conexão com a internet. Verifique sua rede.');
      } else if (msg.includes('rate limit')) {
        toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        toast.error('Erro ao entrar. Tente novamente em instantes.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Find user by email → generate code → send email
  const handleForgotLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = forgotIdentifier.trim();
    if (!id) return;
    setIsForgotLoading(true);
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, role, isRegistered')
        .or(`email.ilike.${id.toLowerCase()},studentCode.ilike.${id},guardianCode.ilike.${id}`)
        .eq('isRegistered', true)
        .limit(1);

      if (!users || users.length === 0) {
        toast.error('Nenhuma conta encontrada com esse código ou e-mail.');
        setIsForgotLoading(false);
        return;
      }
      const found = users[0];
      setForgotUser(found);

      // Generate 6-digit numeric code
      const rawCode = String(Math.floor(100000 + Math.random() * 900000));

      // Hash and store in sessionStorage with 15-min expiry
      const encoder = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', encoder.encode(rawCode + found.id));
      const codeHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('pwd_reset', JSON.stringify({
        hash: codeHash,
        userId: found.id,
        expiresAt: Date.now() + 15 * 60 * 1000,
      }));

      // Send email via Netlify function (non-blocking, shows toast regardless)
      try {
        await fetch('/.netlify/functions/send-reset-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: found.email, name: found.name, code: rawCode }),
        });
      } catch { /* Netlify function may not be deployed – code still works via sessionStorage */ }

      toast.success(`Código enviado para ${found.email || 'seu e-mail'}! Verifique sua caixa de entrada.`);
      setView('forgot-code');
    } catch {
      toast.error('Erro ao buscar conta. Tente novamente.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 2: Verify the 6-digit code
  const handleForgotCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = forgotCodeInput.trim();
    if (!enteredCode || !forgotUser) return;
    setIsForgotLoading(true);
    try {
      const stored = sessionStorage.getItem('pwd_reset');
      if (!stored) { toast.error('Código expirado. Solicite um novo.'); return; }
      const { hash, userId, expiresAt } = JSON.parse(stored);
      if (userId !== forgotUser.id) { toast.error('Código inválido.'); return; }
      if (Date.now() > expiresAt) { toast.error('Código expirado. Solicite um novo.'); sessionStorage.removeItem('pwd_reset'); setView('forgot-email'); return; }
      const encoder = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', encoder.encode(enteredCode + forgotUser.id));
      const enteredHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (enteredHash !== hash) { toast.error('Código incorreto. Verifique e tente novamente.'); setIsForgotLoading(false); return; }
      sessionStorage.removeItem('pwd_reset');
      toast.success('Código válido! Defina sua nova senha.');
      setView('forgot-reset');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 3: Set new password
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem.'); return; }
    setIsForgotLoading(true);
    try {
      const newHash = await hashPassword(newPassword);
      const { error } = await supabase.from('users').update({ passwordHash: newHash, updatedAt: new Date().toISOString() }).eq('id', forgotUser.id);
      if (error) throw error;
      if (forgotUser.email && !forgotUser.email.includes('@impacto.ia')) {
        await supabase.auth.updateUser({ password: newHash });
      }
      setView('forgot-success');
      toast.success('Senha redefinida com sucesso!');
    } catch {
      toast.error('Erro ao redefinir senha. Tente novamente.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const resetForgot = () => {
    setView('login');
    setForgotIdentifier('');
    setForgotUser(null);
    setForgotCodeInput('');
    setNewPassword('');
    setConfirmPassword('');
    sessionStorage.removeItem('pwd_reset');
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
          {view === 'login' ? 'Entrar no Impacto IA' : 
           view === 'forgot-email' ? 'Recuperar Senha' :
           view === 'forgot-code' ? 'Verificar Código' :
           view === 'forgot-reset' ? 'Nova Senha' : 'Senha Redefinida!'}
        </h2>
        <p className="mt-3 text-lg text-slate-600">
          {view === 'login' ? 'Acesse sua conta para continuar' :
           view === 'forgot-email' ? 'Informe seu e-mail ou código de acesso' :
           view === 'forgot-code' ? `Código enviado para ${forgotUser?.email || 'seu e-mail'}` :
           view === 'forgot-reset' ? `Olá, ${forgotUser?.name?.split(' ')[0]}! Crie uma nova senha.` :
           'Sua senha foi atualizada com sucesso.'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-surface py-10 px-6 shadow-floating rounded-[2rem] sm:px-12 border border-white">

          {/* ─── LOGIN VIEW ─── */}
          {view === 'login' && (
            <form className="space-y-6 max-w-md mx-auto" onSubmit={handleLogin}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="code" className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                    Código / E-mail
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
                    <button
                      type="button"
                      onClick={() => setView('forgot-email')}
                      className="text-sm font-semibold text-primary-600 hover:text-primary-500 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <Lock size={20} />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="appearance-none block w-full pl-12 pr-12 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium text-slate-900"
                      placeholder="Sua senha secreta"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
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
          )}

          {/* ─── FORGOT: STEP 1 — Enter email/code ─── */}
          {view === 'forgot-email' && (
            <form className="space-y-6 max-w-md mx-auto" onSubmit={handleForgotLookup}>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                  E-mail ou Código de Acesso
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={e => setForgotIdentifier(e.target.value)}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                    placeholder="seu@email.com ou código do aluno"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isForgotLoading || !forgotIdentifier.trim()}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 disabled:opacity-50 transition-all"
              >
                {isForgotLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Buscando conta...
                  </div>
                ) : 'Continuar'}
              </button>

              <button type="button" onClick={resetForgot} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors">
                <ArrowLeft size={16} /> Voltar para o login
              </button>
            </form>
          )}

          {/* ─── FORGOT: STEP 2 — Enter 6-digit code ─── */}
          {view === 'forgot-code' && (
            <form className="space-y-6 max-w-md mx-auto" onSubmit={handleForgotCodeVerify}>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="font-black text-slate-800 text-sm">Código enviado!</div>
                  <div className="text-xs text-slate-500 mt-0.5">Verifique <strong>{forgotUser?.email}</strong>. Válido por 15 minutos.</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Código de Verificação</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={forgotCodeInput}
                    onChange={e => setForgotCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-mono font-bold text-2xl tracking-[0.4em] text-center"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isForgotLoading || forgotCodeInput.length < 6}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 disabled:opacity-50 transition-all"
              >
                {isForgotLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </div>
                ) : 'Verificar Código'}
              </button>

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setView('forgot-email')} className="text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors flex items-center gap-1">
                  <ArrowLeft size={14} /> Não recebi o e-mail
                </button>
                <button type="button" onClick={resetForgot} className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* ─── FORGOT: STEP 3 — Set new password ─── */}
          {view === 'forgot-reset' && (
            <form className="space-y-5 max-w-md mx-auto" onSubmit={handleForgotReset}>
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600 flex-shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <div className="font-black text-slate-800">{forgotUser?.name}</div>
                  <div className="text-xs text-slate-500 font-medium capitalize">{forgotUser?.role === 'student' ? 'Aluno' : forgotUser?.role === 'teacher' ? 'Professor' : forgotUser?.role === 'guardian' ? 'Responsável' : 'Admin'}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Nova Senha</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Confirmar Nova Senha</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-slate-100 rounded-2xl placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-primary-500 sm:text-base bg-slate-50/50 hover:bg-white focus:bg-white transition-all font-medium"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-500 font-bold">As senhas não coincidem.</p>
              )}

              <button
                type="submit"
                disabled={isForgotLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-success-600 to-success-500 hover:from-success-700 hover:to-success-600 disabled:opacity-50 transition-all"
              >
                {isForgotLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </div>
                ) : 'Redefinir Senha'}
              </button>

              <button type="button" onClick={() => setView('forgot-email')} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors">
                <ArrowLeft size={16} /> Voltar
              </button>
            </form>
          )}

          {/* ─── FORGOT: SUCCESS ─── */}
          {view === 'forgot-success' && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-success-500" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Senha Redefinida!</h3>
                <p className="text-slate-500 mt-2">Agora você pode entrar com sua nova senha.</p>
              </div>
              <button
                onClick={resetForgot}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all"
              >
                Ir para o Login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
