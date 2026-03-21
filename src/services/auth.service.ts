import type { IAuthRepository } from '../repositories/contracts/auth.repository';
import { LocalAuthRepository } from '../repositories/local/local-auth.repository';
import type { AppUser } from '../types/user';

class AuthService {
  private repository: IAuthRepository;

  constructor() {
    // Easily swappable for SupabaseAuthRepository in the future
    this.repository = new LocalAuthRepository();
  }

  async loginWithEmail(email: string, passwordHash: string): Promise<AppUser | null> {
    return await this.repository.loginWithEmail(email, passwordHash);
  }

  async validateFirstAccess(role: string, identifier: string): Promise<AppUser | null> {
    return await this.repository.validateFirstAccess(role, identifier);
  }

  async registerFirstAccess(userId: string, data: { email?: string; passwordHash: string }): Promise<void> {
    return await this.repository.registerFirstAccess(userId, data);
  }

  async getCurrentUser(id: string): Promise<AppUser | null> {
    return await this.repository.getCurrentUser(id);
  }

  async getCurrentUserByRoleAndId(role: string, identifier: string): Promise<AppUser | null> {
    return await (this.repository as LocalAuthRepository).getUserByRoleAndId(role, identifier);
  }
}

export const authService = new AuthService();
