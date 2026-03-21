import type { IAuthRepository } from '../contracts/auth.repository';
import type { AppUser } from '../../types/user';
import { supabase } from '../../lib/supabase';

export class SupabaseAuthRepository implements IAuthRepository {
  async loginWithEmail(identifier: string, passwordHash: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();
    
    // We search by email (normalized), studentCode, or guardianCode
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${idLower},studentCode.ilike.${idClean},guardianCode.ilike.${idClean},guardianCode.ilike.${idLower}`)
      .limit(1);

    if (error || !users || users.length === 0) return null;

    const user = users[0];

    if (user && user.isRegistered === true && user.passwordHash && user.passwordHash === passwordHash) {
      
      // Transparent Migration to Supabase Auth (`auth.users`)
      const authEmail = user.email ? user.email.toLowerCase() : `student_${user.id}@impacto.ia`;
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: passwordHash
      });

      if (authError && authError.message.includes('Invalid login credentials')) {
        // User probably doesn't exist in auth.users yet. Create them silently.
        const { error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: passwordHash
        });
        
        if (!signUpError) {
          // Retry login
          await supabase.auth.signInWithPassword({
            email: authEmail,
            password: passwordHash
          });
        } else {
          console.warn('Silent Auth Migration notice:', signUpError);
        }
      }

      // Update public.users row with the authEmail if it was missing to stay consistent
      if (!user.email) {
         await supabase.from('users').update({ email: authEmail }).eq('id', user.id);
         user.email = authEmail;
      }

      return user as AppUser;
    }
    return null;
  }

  async validateFirstAccess(role: string, identifier: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();

    let query = supabase.from('users').select('*').eq('role', role).limit(1);

    if (role === 'student') {
      query = query.or(`studentCode.ilike.${idClean}`);
    } else if (role === 'guardian') {
      query = query.or(`email.ilike.${idLower},guardianCode.ilike.${idClean},guardianCode.ilike.${idLower}`);
    } else {
      query = query.or(`email.ilike.${idLower}`);
    }

    const { data: users, error } = await query;

    if (error || !users || users.length === 0) return null;

    const user = users[0];

    // Must be the right role AND NOT registered yet
    if (user && user.role === role && user.isRegistered !== true) {
      return user as AppUser;
    }
    return null;
  }

  async validateFirstAccessUnified(identifier: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${idLower},studentCode.ilike.${idClean},guardianCode.ilike.${idClean},guardianCode.ilike.${idLower}`)
      .eq('isRegistered', false)
      .limit(1);

    if (error || !users || users.length === 0) return null;

    return users[0] as AppUser;
  }

  async registerFirstAccess(userId: string, data: { email?: string; passwordHash: string }): Promise<void> {
    const authEmail = data.email ? data.email.toLowerCase() : `student_${userId}@impacto.ia`;

    const updateData: any = {
      isRegistered: true,
      passwordHash: data.passwordHash,
      email: authEmail,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('Supabase register error:', error);
      throw error;
    }

    // Auto-create identity in auth.users
    await supabase.auth.signUp({
      email: authEmail,
      password: data.passwordHash
    });
  }

  async getCurrentUser(id: string): Promise<AppUser | null> {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (error || !users || users.length === 0) return null;
    return users[0] as AppUser;
  }

  async getUserByRoleAndId(role: string, identifier: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();

    let query = supabase.from('users').select('*').eq('role', role).limit(1);

    if (role === 'student') {
      query = query.or(`studentCode.ilike.${idClean}`);
    } else if (role === 'guardian') {
      query = query.or(`email.ilike.${idLower},guardianCode.ilike.${idClean},guardianCode.ilike.${idLower}`);
    } else {
      query = query.or(`email.ilike.${idLower}`);
    }

    const { data: users, error } = await query;

    if (error || !users || users.length === 0) return null;
    
    return users[0] as AppUser;
  }
}
