import type { AppUser } from '../../types/user';

export interface IAuthRepository {
  loginWithEmail(email: string, passwordHash: string): Promise<AppUser | null>;
  validateFirstAccess(role: string, identifier: string): Promise<AppUser | null>;
  registerFirstAccess(userId: string, data: { email?: string; passwordHash: string }): Promise<void>;
  getCurrentUser(id: string): Promise<AppUser | null>;
}
