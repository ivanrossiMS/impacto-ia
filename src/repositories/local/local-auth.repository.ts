import type { IAuthRepository } from '../contracts/auth.repository';
import type { AppUser } from '../../types/user';
import { db } from '../../lib/dexie';

export class LocalAuthRepository implements IAuthRepository {
  async loginWithEmail(identifier: string, passwordHash: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();
    
    // Search by email (normalized), studentCode, or guardianCode
    let user = await db.users.where('email').equals(idLower).first();
    if (!user) {
      user = await db.users.where('studentCode').equals(idClean).first();
    }
    if (!user) {
      user = await db.users.where('guardianCode').equals(idClean).first();
    }
    if (!user) {
      user = await db.users.where('guardianCode').equals(idLower).first();
    }

    // Only allow login if registered AND has a password
    if (user && user.isRegistered === true && user.passwordHash && user.passwordHash === passwordHash) {
      return user;
    }
    return null;
  }

  async validateFirstAccess(role: string, identifier: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();
    let user;

    if (role === 'student') {
      user = await db.users.where('studentCode').equals(idClean).first();
    } else if (role === 'guardian') {
      // For guardians, try matching by email (normalized) OR guardianCode
      user = await db.users.where('email').equals(idLower).first();
      if (!user) {
        user = await db.users.where('guardianCode').equals(idClean).first();
      }
      if (!user) {
        user = await db.users.where('guardianCode').equals(idLower).first();
      }
    } else {
      user = await db.users.where('email').equals(idLower).first();
    }

    // Must be the right role AND NOT registered yet
    if (user && user.role === role && user.isRegistered !== true) {
      return user;
    }
    return null;
  }

  async registerFirstAccess(userId: string, data: { email?: string; passwordHash: string }): Promise<void> {
    await db.users.update(userId, {
      ...data,
      isRegistered: true,
      updatedAt: new Date().toISOString()
    });
  }

  async getCurrentUser(id: string): Promise<AppUser | null> {
    const user = await db.users.get(id);
    return user || null;
  }

  async getUserByRoleAndId(role: string, identifier: string): Promise<AppUser | null> {
    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();
    let user;

    if (role === 'student') {
      user = await db.users.where('studentCode').equals(idClean).first();
    } else if (role === 'guardian') {
      user = await db.users.where('email').equals(idLower).first() || 
             await db.users.where('guardianCode').equals(idClean).first() ||
             await db.users.where('guardianCode').equals(idLower).first();
    } else {
      user = await db.users.where('email').equals(idLower).first();
    }

    return (user && user.role === role) ? user : null;
  }
}
