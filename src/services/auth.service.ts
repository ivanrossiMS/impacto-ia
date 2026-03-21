import type { IAuthRepository } from '../repositories/contracts/auth.repository';
import { SupabaseAuthRepository } from '../repositories/supabase/supabase-auth.repository';
import type { AppUser } from '../types/user';

class AuthService {
  private repository: IAuthRepository;

  constructor() {
    this.repository = new SupabaseAuthRepository();
  }

  async loginWithEmail(email: string, passwordHash: string): Promise<AppUser | null> {
    return await this.repository.loginWithEmail(email, passwordHash);
  }

  async validateFirstAccess(role: string, identifier: string): Promise<AppUser | null> {
    return await this.repository.validateFirstAccess(role, identifier);
  }

  async validateFirstAccessUnified(identifier: string): Promise<AppUser | null> {
    return await this.repository.validateFirstAccessUnified(identifier);
  }

  async registerFirstAccess(userId: string, data: { email?: string; passwordHash: string }): Promise<void> {
    return await this.repository.registerFirstAccess(userId, data);
  }

  async getCurrentUser(id: string): Promise<AppUser | null> {
    return await this.repository.getCurrentUser(id);
  }

  async getCurrentUserByRoleAndId(role: string, identifier: string): Promise<AppUser | null> {
    return await this.repository.getUserByRoleAndId(role, identifier);
  }
}

export const authService = new AuthService();
