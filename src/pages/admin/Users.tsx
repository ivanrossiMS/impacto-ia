import React, { useState, useEffect } from 'react';
import {
  Search, Plus, X, Edit2, Trash2, CheckCircle, XCircle,
  Users as UsersIcon, User, GraduationCap, Shield, Filter, School as SchoolIcon,
  Coins, BookOpen, UserCheck, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { UserImportModal } from './UserImportModal';
import { BulkActionsModal } from './BulkActionsModal';
import { ShieldAlert } from 'lucide-react';

// ─── Schema ────────────────────────────────────────────────────────────────
const userSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  loginCode: z.string().min(2, 'Login deve ter pelo menos 2 caracteres'),
  role: z.enum(['admin', 'teacher', 'student', 'guardian', 'master']),
  password: z.string().optional(),
  schoolId: z.string().optional(),
  initialCoins: z.number().min(0).optional(),
  classId: z.string().optional(), // Primary class
  classIds: z.array(z.string()).optional(), // Multiple classes (for teachers)
  guardianIds: z.array(z.string()).optional(), // Multiple guardians (for students)
  studentIds: z.array(z.string()).optional(), // Multiple students (for guardians)
});
type UserFormData = z.infer<typeof userSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const configs: Record<string, { label: string, icon: any, color: string }> = {
    admin: { label: 'Admin', icon: Shield, color: 'bg-slate-900 text-white' },
    teacher: { label: 'Professor', icon: GraduationCap, color: 'bg-indigo-500 text-white' },
    student: { label: 'Aluno', icon: UsersIcon, color: 'bg-primary-500 text-white' },
    guardian: { label: 'Responsável', icon: User, color: 'bg-violet-500 text-white' },
    master: { label: 'Admin Master', icon: Shield, color: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' }
  };
  const config = configs[role] || configs.student;
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", config.color)}>
       <config.icon size={10} /> {config.label}
    </div>
  );
};

const SchoolCell: React.FC<{ schoolId?: string }> = ({ schoolId }) => {
  const schools = useSupabaseQuery<any>('schools');
  const school = schools.find(s => s.id === schoolId);
  if (!schoolId || !school) return <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">—</span>;
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
       <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><SchoolIcon size={12}/></div>
       {school.name}
    </div>
  );
};

// ─── User Modal ────────────────────────────────────────────────────────────
interface UserModalProps {
  editUser?: any;
  onClose: () => void;
  schools: any[];
  isAdminMaster: boolean;
  userSchoolId?: string;
  allUsers: any[];
  allClasses: any[];
  allGamStats: any[];
}

const UserModal: React.FC<UserModalProps> = ({ editUser, onClose, schools, isAdminMaster, userSchoolId, allUsers, allClasses, allGamStats }) => {
  const isEdit = !!editUser;
  const [guardianSearch, setGuardianSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: isEdit ? {
      name: editUser.name,
      role: editUser.isMaster ? 'master' : editUser.role,
      loginCode: editUser.studentCode || editUser.guardianCode || editUser.email,
      schoolId: editUser.schoolId || '',
      password: '',
      initialCoins: 100, 
      classId: editUser.classId || (editUser.classIds?.[0] || ''),
      classIds: editUser.classIds || (editUser.classId ? [editUser.classId] : []),
      guardianIds: editUser.guardianIds || (editUser.guardianId ? [editUser.guardianId] : []),
      studentIds: editUser.studentIds || []
    } : { role: 'admin', schoolId: isAdminMaster ? '' : userSchoolId, initialCoins: 100, classIds: [], guardianIds: [], studentIds: [] }
  });

  // Load existing coins if editing a student
  const studentStats = allGamStats.find(s => s.id === editUser?.id);

  useEffect(() => {
    if (studentStats && isEdit && editUser.role === 'student') {
      setValue('initialCoins', studentStats.coins);
    }
  }, [studentStats, isEdit, setValue, editUser]);

  const selectedRole = watch('role');
  const selectedSchoolId = watch('schoolId');
  const watchedClassIds = watch('classIds') || [];
  const watchedGuardianIds = watch('guardianIds') || [];
  const watchedStudentIds = watch('studentIds') || [];

  // Fetch classes and guardians for the selected school
  const schoolClasses = allClasses.filter(c => c.schoolId === selectedSchoolId);
  const schoolGuardians = allUsers.filter(u => u.schoolId === selectedSchoolId && u.role === 'guardian');

  const filteredGuardians = schoolGuardians.filter(g => 
    g.name.toLowerCase().includes(guardianSearch.toLowerCase()) || 
    (g.email || (g as any).guardianCode || '').toLowerCase().includes(guardianSearch.toLowerCase())
  );

  const schoolStudents = allUsers.filter(u => u.schoolId === selectedSchoolId && u.role === 'student');

  const filteredStudents = schoolStudents.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    (s.email || (s as any).studentCode || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const onSubmit = async (data: UserFormData) => {
    const now = new Date().toISOString();
    try {
      const targetUserId = isEdit ? editUser.id : crypto.randomUUID();

      // --- MULTI-GUARDIAN SYNC LOGIC ---
      if (data.role === 'student') {
        const newGuardianIds = data.guardianIds || [];
        const oldGuardianIds = editUser?.guardianIds || (editUser?.guardianId ? [editUser.guardianId] : []);
        
        // Guardians to remove student from
        const removed = oldGuardianIds.filter((id: string) => !newGuardianIds.includes(id));
        for (const gid of removed) {
          const { data: g } = await supabase.from('users').select('*').eq('id', gid).single();
          if (g && g.role === 'guardian') {
            const newIds = (g.studentIds || []).filter((id: string) => id !== targetUserId);
            await supabase.from('users').update({ studentIds: newIds }).eq('id', gid);
          }
        }
        
        // Guardians to add student to
        for (const gid of newGuardianIds) {
          const { data: g } = await supabase.from('users').select('*').eq('id', gid).single();
          if (g && g.role === 'guardian') {
            const newIds = Array.from(new Set([...(g.studentIds || []), targetUserId]));
            await supabase.from('users').update({ studentIds: newIds }).eq('id', gid);
          }
        }
      }

      // --- CLASS SYNC LOGIC (STUDENT) ---
      if (data.role === 'student') {
        const newClassId = data.classId;
        const oldClassId = editUser?.classId;
        if (newClassId !== oldClassId) {
          if (oldClassId) {
            const { data: oldC } = await supabase.from('classes').select('*').eq('id', oldClassId).single();
            if (oldC) {
              const newIds = (oldC.studentIds || []).filter((id: string) => id !== targetUserId);
              await supabase.from('classes').update({ studentIds: newIds }).eq('id', oldClassId);
            }
          }
          if (newClassId) {
            const { data: newC } = await supabase.from('classes').select('*').eq('id', newClassId).single();
            if (newC) {
              const newIds = Array.from(new Set([...(newC.studentIds || []), targetUserId]));
              await supabase.from('classes').update({ studentIds: newIds }).eq('id', newClassId);
            }
          }
        }
      } 
      
      // --- CLASS SYNC LOGIC (TEACHER) ---
      else if (data.role === 'teacher') {
        const newIds = data.classIds || [];
        const oldIds = editUser?.classIds || (editUser?.classId ? [editUser.classId] : []);
        
        // Classes to remove teacher from
        const removed = oldIds.filter((id: string) => !newIds.includes(id));
        for (const cid of removed) {
          const { data: c } = await supabase.from('classes').select('*').eq('id', cid).single();
          if (c && c.teacherId === targetUserId) {
            await supabase.from('classes').update({ teacherId: null }).eq('id', cid);
          }
        }
        
        // Classes to add teacher to
        for (const cid of newIds) {
          await supabase.from('classes').update({ teacherId: targetUserId }).eq('id', cid);
        }
      }

      // --- MULTI-STUDENT SYNC LOGIC (GUARDIAN) ---
      if (data.role === 'guardian') {
        const newStudentIds = data.studentIds || [];
        const oldStudentIds = editUser?.studentIds || [];
        
        // Students to remove guardian from
        const removed = oldStudentIds.filter((id: string) => !newStudentIds.includes(id));
        for (const sid of removed) {
          const { data: s } = await supabase.from('users').select('*').eq('id', sid).single();
          if (s && s.role === 'student') {
            const newGIds = (s.guardianIds || []).filter((id: string) => id !== targetUserId);
            await supabase.from('users').update({ guardianIds: newGIds }).eq('id', sid);
          }
        }
        
        // Students to add guardian to
        for (const sid of newStudentIds) {
          const { data: s } = await supabase.from('users').select('*').eq('id', sid).single();
          if (s && s.role === 'student') {
            const newGIds = Array.from(new Set([...(s.guardianIds || []), targetUserId]));
            await supabase.from('users').update({ guardianIds: newGIds }).eq('id', sid);
          }
        }
      }

      // Fetch class grade if student
      let classGrade = undefined;
      if (data.role === 'student' && data.classId) {
        const { data: cls } = await supabase.from('classes').select('grade').eq('id', data.classId).single();
        if (cls) classGrade = cls.grade;
      }

      const userUpdate: any = { 
        name: data.name, 
        role: data.role === 'master' ? 'admin' : data.role, 
        isMaster: data.role === 'master' ? true : false,
        schoolId: data.schoolId || null, 
        updatedAt: now,
        grade: classGrade || (isEdit ? editUser.grade : null),
        classId: data.role === 'student' ? data.classId || null : (data.role === 'teacher' ? data.classIds?.[0] || null : null),
        classIds: data.role === 'teacher' ? data.classIds : (data.role === 'student' && data.classId ? [data.classId] : []),
        guardianIds: data.role === 'student' ? data.guardianIds : [],
        studentIds: data.role === 'guardian' ? data.studentIds : []
      };

      if (data.password) {
        userUpdate.passwordHash = data.password;
        userUpdate.isRegistered = true;
      }
      
      const normalizedLogin = data.loginCode.trim().toLowerCase();
      if (data.role === 'admin' || data.role === 'teacher' || data.role === 'master') {
          userUpdate.email = normalizedLogin;
          userUpdate.studentCode = null;
          userUpdate.guardianCode = null;
      } else if (data.role === 'student') {
          userUpdate.studentCode = data.loginCode;
          userUpdate.email = null;
          userUpdate.guardianCode = null;
      } else {
          userUpdate.guardianCode = data.loginCode;
          userUpdate.email = null;
          userUpdate.studentCode = null;
      }

      if (isEdit) {
        await supabase.from('users').update(userUpdate).eq('id', editUser.id);
        
        if (data.role === 'student') {
          const { data: stats } = await supabase.from('gamification_stats').select('*').eq('id', editUser.id).single();
          if (stats) {
            await supabase.from('gamification_stats').update({ coins: data.initialCoins || 0 }).eq('id', editUser.id);
          } else {
            await supabase.from('gamification_stats').insert({ 
              id: editUser.id, level: 1, xp: 0, coins: data.initialCoins || 100, streak: 0, lastStudyDate: now 
            });
          }
        }
        toast.success('Usuário atualizado!');
      } else {
        const newUser: any = { 
          ...userUpdate,
          id: targetUserId,
          isRegistered: !!data.password,
          createdAt: now, 
          avatar: data.role === 'student' ? '/avatars/default-impacto.png' : null,
          studentIds: data.role === 'guardian' ? data.studentIds : []
        };
        
        await supabase.from('users').insert(newUser);
        
        if (data.role === 'student') {
          await supabase.from('gamification_stats').insert({ 
            id: targetUserId, level: 1, xp: 0, coins: data.initialCoins || 100, streak: 0, lastStudyDate: now 
          });
        }
        toast.success('Usuário cadastrado!');
      }
      onClose();
    } catch (e: any) { 
        console.error("Save error:", e);
        toast.error('Erro ao salvar. Verifique se o login já existe.'); 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{isEdit ? 'Editar Acesso' : 'Novo Acesso'}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Impacto IA Auth System</p>
           </div>
           <button onClick={onClose} className="p-2.5 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-5 overflow-y-auto max-h-[85vh] custom-scrollbar">
           <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Completo</label>
                 <input {...register('name')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all placeholder:text-slate-300" placeholder="Digite o nome completo" />
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Perfil de Acesso</label>
                 <select {...register('role')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:bg-white transition-colors">
                    <option value="student">Aluno</option>
                    <option value="teacher">Professor</option>
                    <option value="guardian">Responsável</option>
                    <option value="admin">Administrador</option>
                    {isAdminMaster && <option value="master">Administrador Master ✨</option>}
                  </select>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Unidade Escolar</label>
                 <select 
                   {...register('schoolId')} 
                   disabled={!isAdminMaster}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white transition-colors"
                 >
                    {isAdminMaster && <option value="">Nenhuma / Global</option>}
                    {schools
                      .filter(s => isAdminMaster || s.id === userSchoolId)
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    }
                 </select>
                 {!isAdminMaster && <p className="text-[9px] font-bold text-primary-500 uppercase mt-1 px-1">Restrito à sua unidade escolar</p>}
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Login / E-mail</label>
                 <input {...register('loginCode')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-300" placeholder="E-mail ou código" />
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Senha {isEdit && '(Em branco p/ manter)'}</label>
                 <input type="password" {...register('password')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-300" placeholder="••••••••" />
              </div>

              {selectedRole === 'student' && (
                <>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Turma / Classe</label>
                     <select {...register('classId')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none appearance-none focus:bg-white transition-colors">
                        <option value="">Sem Turma</option>
                        {schoolClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
                     </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Moedas Iniciais (🪙)</label>
                    <input type="number" {...register('initialCoins', { valueAsNumber: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-primary-500/10 transition-all" />
                  </div>

                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsáveis Vinculados</label>
                      <span className="text-[9px] font-bold text-primary-500 uppercase bg-primary-50 px-2 py-0.5 rounded-full">{watchedGuardianIds.length} selecionado(s)</span>
                    </div>
                    
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="text"
                        placeholder="Buscar responsável por nome ou código..."
                        value={guardianSearch}
                        onChange={(e) => setGuardianSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary-400 transition-all shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                      {filteredGuardians.map(g => (
                        <label key={g.id} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all group">
                          <input 
                            type="checkbox" 
                            checked={watchedGuardianIds.includes(g.id)}
                            onChange={(e) => {
                              const current = watchedGuardianIds;
                              if (e.target.checked) setValue('guardianIds', [...current, g.id]);
                              else setValue('guardianIds', current.filter((id: string) => id !== g.id));
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-all cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-black text-slate-800 truncate">{g.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                              {g.email || (g as any).guardianCode}
                            </span>
                          </div>
                        </label>
                      ))}
                      {schoolGuardians.length === 0 && (
                        <p className="col-span-2 text-center py-4 text-[10px] font-bold text-slate-400 uppercase italic">Nenhum responsável encontrado</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedRole === 'teacher' && (
                <div className="col-span-2 space-y-3">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Turmas Atribuídas</label>
                   <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                      {schoolClasses.map((c: any) => (
                        <label key={c.id} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all group">
                          <input 
                            type="checkbox" 
                            checked={watchedClassIds.includes(c.id)}
                            onChange={(e) => {
                              const current = watchedClassIds;
                              if (e.target.checked) setValue('classIds', [...current, c.id]);
                              else setValue('classIds', current.filter((id: string) => id !== c.id));
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-all cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-black text-slate-800 truncate">{c.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{c.grade}</span>
                          </div>
                        </label>
                      ))}
                      {schoolClasses.length === 0 && (
                        <p className="col-span-2 text-center py-4 text-[10px] font-bold text-slate-400 uppercase italic">Nenhuma turma encontrada</p>
                      )}
                   </div>
                </div>
              )}

              {selectedRole === 'guardian' && (
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alunos Dependentes</label>
                    <span className="text-[9px] font-bold text-primary-500 uppercase bg-primary-50 px-2 py-0.5 rounded-full">{watchedStudentIds.length} aluno(s)</span>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input
                      type="text"
                      placeholder="Buscar aluno por nome ou código..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary-400 transition-all shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {filteredStudents.map(s => (
                      <label key={s.id} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all group">
                        <input 
                          type="checkbox" 
                          checked={watchedStudentIds.includes(s.id)}
                          onChange={(e) => {
                            const current = watchedStudentIds;
                            if (e.target.checked) setValue('studentIds', [...current, s.id]);
                            else setValue('studentIds', current.filter((id: string) => id !== s.id));
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-all cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-black text-slate-800 truncate">{s.name}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                            {s.email || (s as any).studentCode}
                          </span>
                        </div>
                      </label>
                    ))}
                    {schoolStudents.length === 0 && (
                      <p className="col-span-2 text-center py-4 text-[10px] font-bold text-slate-400 uppercase italic">Nenhum aluno encontrado</p>
                    )}
                  </div>
                </div>
              )}
           </div>

           <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Cancelar</Button>
              <Button type="submit" variant="primary" className="flex-1 rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-500/20" disabled={isSubmitting}>
                 {isEdit ? 'Salvar' : 'Criar'}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
export const Users: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const userSchoolId = user?.schoolId;

  const [activeRole, setActiveRole] = useState<'all' | 'admin' | 'teacher' | 'student' | 'guardian'>('all');
  const [filterSchoolId, setFilterSchoolId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const users = useSupabaseQuery<any>('users') || [];
  const schools = useSupabaseQuery<any>('schools') || [];
  const classes = useSupabaseQuery<any>('classes') || [];
  const stats = useSupabaseQuery<any>('gamification_stats') || [];

  const filteredUsers = users.filter(u => {
    const matchesRole = activeRole === 'all' || u.role === activeRole;
    const matchesSchool = filterSchoolId === 'all' || (u as any).schoolId === filterSchoolId;
    const matchesAccess = isAdminMaster || (u as any).schoolId === userSchoolId;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.email || (u as any).studentCode || (u as any).guardianCode || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSchool && matchesAccess && matchesSearch;
  });

  const handleToggleStatus = async (user: any) => {
    await supabase.from('users').update({ status: user.status === 'active' ? 'inactive' : 'active', updatedAt: new Date().toISOString() }).eq('id', user.id);
    toast.success('Status atualizado!');
  };

  const handleDelete = async (user: any) => {
    if (!window.confirm(`Excluir ${user.name}?`)) return;
    await supabase.from('users').delete().eq('id', user.id);
    if (user.role === 'student') await supabase.from('gamification_stats').delete().eq('id', user.id);
    toast.success('Usuário removido.');
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <header className="bg-slate-900 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="space-y-3">
              <Badge variant="ai" className="bg-primary-500/20 border-0 text-primary-400 py-1 px-4 italic font-black uppercase tracking-widest scale-95 -ml-2">GERENCIAMENTO</Badge>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">Usuários & Acessos</h1>
              <p className="text-slate-400 font-medium text-lg max-w-xl">Central de controle de identidades para alunos, professores e responsáveis.</p>
           </div>
           <div className="flex gap-4">
             <Button 
               onClick={() => { setIsImportModalOpen(true); }} 
               variant="outline" 
               className="bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-[2rem] px-8 py-8 font-black text-base transition-all"
             >
                <Download size={24} className="mr-2" /> Importar Planilha
             </Button>
             <Button 
               onClick={() => { setIsBulkActionsOpen(true); }} 
               variant="outline" 
               className="bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-[2rem] px-8 py-8 font-black text-base transition-all"
             >
                <ShieldAlert size={24} className="mr-2" /> Ações em Massa
             </Button>
             <Button 
               onClick={() => { setEditingUser(null); setIsModalOpen(true); }} 
               variant="primary" 
               className="rounded-[2rem] px-10 py-8 font-black text-base shadow-2xl shadow-primary-500/20 hover:scale-[1.05] transition-all"
             >
                <Plus size={24} className="mr-2" /> Novo Acesso
             </Button>
           </div>
        </div>
      </header>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-100 rounded-[2.5rem] bg-white/50 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row gap-6">
         <div className="flex bg-slate-100 p-1.5 rounded-[2rem] overflow-x-auto">
            {['all', 'admin', 'teacher', 'student', 'guardian'].map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role as any)}
                className={cn(
                  "px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeRole === role ? "bg-white text-primary-600 shadow-md scale-[1.02]" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {role === 'all' ? 'Todos' : role === 'admin' ? 'Admins' : role === 'teacher' ? 'Profs' : role === 'student' ? 'Alunos' : 'Resps'}
              </button>
            ))}
         </div>

         <div className="flex-1 flex gap-4">
            <div className="relative flex-1">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] py-4 pl-14 pr-6 text-sm font-bold focus:ring-4 focus:ring-primary-500/10 outline-none transition-all" placeholder="Nome ou login..." />
            </div>
            {isAdminMaster && (
               <div className="relative group">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-primary-500 transition-colors" size={16} />
                  <select 
                    value={filterSchoolId} onChange={e => setFilterSchoolId(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-10 py-4 text-xs font-black uppercase tracking-tight text-slate-600 outline-none appearance-none cursor-pointer hover:bg-white transition-all">
                     <option value="all">Todas as Escolas</option>
                     {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            )}
         </div>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in duration-700">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                     <th className="p-8">Usuário</th>
                     <th className="p-8">Moedas</th>
                     <th className="p-8">Perfil / Acesso</th>
                     <th className="p-8">Unidade</th>
                     <th className="p-8">Status</th>
                     <th className="p-8 text-right">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="p-8">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-black border border-slate-200 overflow-hidden shadow-inner">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name[0]}
                             </div>
                             <div>
                                <div className="text-lg font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors uppercase">{u.name}</div>
                                <div className="space-y-1 mt-1.5">
                                   <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2 lowercase select-all bg-slate-50 px-2 py-0.5 rounded-lg w-fit">
                                      <span className="text-[9px] uppercase font-black text-slate-300">Login:</span> {u.email || (u as any).studentCode || (u as any).guardianCode}
                                   </div>
                                   
                                   {(() => {
                                     const cids = u.role === 'teacher' ? (u as any).classIds || [] : [(u as any).classId || (u as any).classIds?.[0]].filter(Boolean);
                                     if (cids.length === 0) return null;
                                     
                                     if (u.role === 'teacher') {
                                       return (
                                         <div className="space-y-1 mt-1">
                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Turmas:</div>
                                            <div className="flex flex-wrap gap-1">
                                               {cids.map((cid: string) => {
                                                 const c = classes.find((cl: any) => cl.id === cid);
                                                 return c ? (
                                                   <span key={cid} className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100/50">
                                                      {c.name}
                                                   </span>
                                                 ) : null;
                                               })}
                                            </div>
                                         </div>
                                       );
                                     }

                                     const clsName = classes.find((c: any) => c.id === cids[0])?.name || 'N/A';
                                     return (
                                       <div className="text-[10px] font-black text-primary-500/70 flex items-center gap-1 uppercase tracking-tight">
                                          <BookOpen size={10} /> Turma: {clsName}
                                       </div>
                                     );
                                   })()}

                                   {u.role === 'student' && (
                                     <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-tight">
                                        <UserCheck size={10} /> Responsaveis: {
                                          users
                                            .filter(g => g.role === 'guardian' && ((g.studentIds || []).includes(u.id)))
                                            .map(g => g.name.split(' ')[0])
                                            .join(', ') || 'Nenhum'
                                        }
                                     </div>
                                   )}

                                   {u.role === 'guardian' && (
                                     <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-tight">
                                        <UsersIcon size={10} /> Alunos: {
                                          users
                                            .filter(s => s.role === 'student' && ((s as any).guardianIds?.includes(u.id)))
                                            .map(s => s.name.split(' ')[0])
                                            .join(', ') || 'Nenhum'
                                        }
                                     </div>
                                   )}
                                </div>
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          {u.role === 'student' ? (
                            <div className="flex flex-col">
                               <div className="flex items-center gap-1.5 text-amber-500 font-black text-base">
                                  <Coins size={16} /> {stats.find(s => s.id === u.id)?.coins || 0}
                               </div>
                               <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Disponíveis</div>
                            </div>
                          ) : (
                            <span className="text-slate-200 font-black">—</span>
                          )}
                       </td>
                       <td className="p-8">
                          <RoleBadge role={u.isMaster ? 'master' : u.role} />
                       </td>
                       <td className="p-8">
                          <SchoolCell schoolId={(u as any).schoolId} />
                       </td>
                       <td className="p-8">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              u.status === 'active' ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            )}>
                             {u.status === 'active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                             {u.status === 'active' ? 'Ativo' : 'Inativo'}
                          </button>
                       </td>
                       <td className="p-8">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                             <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-primary-500 hover:border-primary-200 rounded-2xl transition-all shadow-sm"><Edit2 size={18} /></button>
                             <button onClick={() => handleDelete(u)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-200 rounded-2xl transition-all shadow-sm"><Trash2 size={18} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-32 text-center flex flex-col items-center gap-4">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><UsersIcon size={40} /></div>
                 <h3 className="text-xl font-black text-slate-400">Nenhum usuário encontrado</h3>
              </div>
            )}
         </div>
         <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{filteredUsers.length} Registros Encontrados</span>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Anterior</Button>
               <Button variant="outline" size="sm" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Próximo</Button>
            </div>
         </div>
      </div>

      {isModalOpen && (
        <UserModal
          editUser={editingUser}
          onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
          schools={schools}
          isAdminMaster={isAdminMaster}
          userSchoolId={userSchoolId}
          allUsers={users}
          allClasses={classes}
          allGamStats={stats}
        />
      )}

      {isImportModalOpen && (
        <UserImportModal
          onClose={() => setIsImportModalOpen(false)}
          schools={schools}
          isAdminMaster={isAdminMaster}
          userSchoolId={userSchoolId}
        />
      )}

      {isBulkActionsOpen && (
        <BulkActionsModal
          onClose={() => setIsBulkActionsOpen(false)}
          schools={schools}
          isAdminMaster={isAdminMaster}
          userSchoolId={userSchoolId}
        />
      )}
    </div>
  );
};
