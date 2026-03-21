export type UserRole = 'student' | 'guardian' | 'teacher' | 'admin';

export interface BaseUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  isRegistered: boolean; // True if password/email (for students) set
  schoolId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
  avatar?: string;
  isMaster?: boolean;
}

export interface Student extends BaseUser {
  role: 'student';
  studentCode: string;
  passwordHash?: string;
  birthDate?: string;
  grade?: string;
  guardianIds?: string[];
  classId?: string;
}

export interface Guardian extends BaseUser {
  role: 'guardian';
  guardianCode: string;
  passwordHash?: string;
  phone?: string;
  studentIds: string[];
}

export interface Teacher extends BaseUser {
  role: 'teacher';
  email: string;
  passwordHash?: string;
  classIds: string[];
  subjects: string[];
}

export interface Admin extends BaseUser {
  role: 'admin';
  email: string;
  passwordHash?: string;
}

export type AppUser = Student | Guardian | Teacher | Admin;

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  subject?: string;
  year?: string;
  schoolId?: string;
  teacherId?: string;
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface School {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  usersCount: number;
  globalScore: number;
}
