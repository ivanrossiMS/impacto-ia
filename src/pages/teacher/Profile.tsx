import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Mail, Save, Camera, Lock, Award, Eye, EyeOff, Key, GraduationCap, BookOpen } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { cn } from '../../lib/utils';

const profileSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().min(2, 'Login obrigatório'),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string().min(4, 'Mínimo 4 caracteres'),
  confirmPassword: z.string().min(4, 'Mínimo 4 caracteres'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});
type PasswordFormData = z.infer<typeof passwordSchema>;

export const Profile: React.FC = () => {
  const { user, login } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(user?.avatar);

  // Fetch teacher's linked classes from DB
  const teacherUsersData = useSupabaseQuery<any>('users');
  const teacherUser = teacherUsersData?.find((u: any) => u.id === user?.id);

  const classIds: string[] = teacherUser?.classIds || [];
  const allClassesData = useSupabaseQuery<any>('classes');
  const classes = (allClassesData || []).filter((c: any) => classIds.includes(c.id));

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: (user as any)?.email || (user as any)?.studentCode || '',
    }
  });

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors, isSubmitting: isPwdSubmitting } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema) as any,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    try {
      const updateData: any = { 
        name: data.name, 
        email: data.email, 
        updatedAt: new Date().toISOString() 
      };

      if (avatarPreview) {
        updateData.avatar = avatarPreview;
      }

      const { error } = await supabase.from('users').update(updateData).eq('id', user.id);
      if (error) throw error;
      login({ ...user, ...updateData } as any);
      toast.success('Perfil atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar perfil.');
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!user) return;
    try {
      const { data: dbUserList, error: getUserError } = await supabase.from('users').select('*').eq('id', user.id);
      if (getUserError) throw getUserError;
      const dbUser = dbUserList?.[0];
      
      if (!dbUser || dbUser.passwordHash !== data.currentPassword) {
        toast.error('Senha atual incorreta.');
        return;
      }
      const { error: updateError } = await supabase.from('users').update({ passwordHash: data.newPassword, updatedAt: new Date().toISOString() }).eq('id', user.id);
      if (updateError) throw updateError;
      toast.success('Senha alterada com sucesso!');
      resetPwd();
    } catch {
      toast.error('Erro ao alterar senha.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Perfil do Educador</h1>
        <p className="text-slate-500 font-medium">Gerencie suas credenciais e identidade profissional na plataforma.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Avatar Card */}
        <div className="space-y-4">
          <Card className="p-8 border-slate-100 text-center space-y-6 self-start shadow-xl shadow-slate-200/50">
            <div className="relative inline-block">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
              <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-white shadow-2xl mx-auto ring-8 ring-indigo-50 overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.[0]?.toUpperCase()
                )}
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2.5 bg-white rounded-xl border border-slate-100 shadow-lg text-slate-600 hover:text-indigo-500 transition-all hover:scale-110 active:scale-95"
              >
                <Camera size={20} />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{user?.name}</h2>
              <span className="bg-indigo-50 text-indigo-600 py-1.5 px-4 rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 justify-center mt-2">
                <Award size={14} /> Professor
              </span>
            </div>
          </Card>

          {/* Linked Classes Card */}
          <Card className="p-6 border-slate-100 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
              <BookOpen size={13} /> Minhas Turmas
            </h3>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhuma turma vinculada.</p>
            ) : (
              <div className="space-y-2">
                {classes.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                    <GraduationCap size={14} className="text-indigo-500" />
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.grade} · {c.studentIds?.length || 0} alunos</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card className="p-8 border-slate-100 space-y-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><User size={18} /> Dados Profissionais</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nome</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      {...register('name')}
                      className={cn("w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-indigo-500/20 outline-none transition-all shadow-inner", errors.name && "border-red-500/50")}
                    />
                  </div>
                  {errors.name && <p className="text-[10px] font-black text-red-500 uppercase">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Login / Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      {...register('email')}
                      readOnly
                      className={cn("w-full bg-slate-100 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold opacity-70 cursor-not-allowed outline-none transition-all shadow-inner", errors.email && "border-red-500/50")}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Lock size={14} className="text-slate-400" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight pl-2 italic">
                    O login só pode ser alterado pelo administrador.
                  </p>
                  {errors.email && <p className="text-[10px] font-black text-red-500 uppercase">{errors.email.message}</p>}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50 flex justify-end">
                <Button type="submit" variant="primary" disabled={isSubmitting} className="rounded-2xl gap-2 font-black px-10 py-4 text-sm">
                  {isSubmitting ? 'Salvando...' : <><Save size={18} /> Salvar Perfil</>}
                </Button>
              </div>
            </Card>
          </form>

          {/* Password Change Form */}
          <form onSubmit={handlePwd(onPasswordSubmit)}>
            <Card className="p-8 border-slate-100 space-y-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Key size={18} /> Alterar Senha</h2>
              <div className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Senha Atual</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      {...regPwd('currentPassword')}
                      type={showCurrent ? 'text' : 'password'}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-12 text-sm font-bold focus:bg-white focus:border-indigo-500/20 outline-none transition-all shadow-inner"
                      placeholder="••••"
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pwdErrors.currentPassword && <p className="text-[10px] text-red-500 font-black uppercase">{pwdErrors.currentPassword.message}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        {...regPwd('newPassword')}
                        type={showNew ? 'text' : 'password'}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-12 text-sm font-bold focus:bg-white focus:border-indigo-500/20 outline-none transition-all shadow-inner"
                        placeholder="••••"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {pwdErrors.newPassword && <p className="text-[10px] text-red-500 font-black uppercase">{pwdErrors.newPassword.message}</p>}
                  </div>
                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmar Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        {...regPwd('confirmPassword')}
                        type={showConfirm ? 'text' : 'password'}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-12 text-sm font-bold focus:bg-white focus:border-indigo-500/20 outline-none transition-all shadow-inner"
                        placeholder="••••"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {pwdErrors.confirmPassword && <p className="text-[10px] text-red-500 font-black uppercase">{pwdErrors.confirmPassword.message}</p>}
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50 flex justify-end">
                <Button type="submit" disabled={isPwdSubmitting} className="rounded-2xl gap-2 font-black px-10 py-4 text-sm bg-slate-800 text-white hover:bg-slate-900">
                  {isPwdSubmitting ? 'Alterando...' : <><Key size={18} /> Alterar Senha</>}
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};
