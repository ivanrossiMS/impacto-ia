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
        } else if (signUpError.message.includes('rate limit exceeded')) {
          // IMPORTANT: If we hit rate limit, we still return the user.
          // The public.users check already passed, so the credentials are valid.
          // They just won't have a Supabase Auth session until the limit resets.
          console.warn('Silent Auth Migration: Rate limit hit. Proceeding with local validation only.', signUpError);
        } else {
          console.warn('Silent Auth Migration failed:', signUpError);
        }
      }

      // Update public.users row with the authEmail if it was missing to stay consistent
      if (!user.email) {
         try {
           await supabase.from('users').update({ email: authEmail }).eq('id', user.id);
           user.email = authEmail;
         } catch (e) {
           console.warn('[Auth] Optional email sync failed (likely 409 or rate limit), proceeding anyway:', e);
         }
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
    const { error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: data.passwordHash
    });

    if (authError) {
      console.warn('Optional Auth identity creation failed during registration:', authError);
      // We don't throw here because the primary record in public.users is already updated.
    }
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
