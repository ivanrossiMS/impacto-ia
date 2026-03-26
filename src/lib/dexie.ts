import Dexie, { type EntityTable } from 'dexie';
import type { AppUser } from '../types/user';
import type { SchoolClass } from '../types/user';
import type { 
  AvatarCatalogItem, 
  StudentOwnedAvatarItem, 
  StudentAvatarProfile,
  AvatarCollection,
  AdminAvatarCampaign
} from '../types/avatar';
import type { GamificationStats, Achievement, StudentAchievement, Mission, StudentMissionProgress } from '../types/gamification';
import type { LearningPath, Activity, StudentProgress, LibraryItem } from '../types/learning';
import type { SupportTicket, TicketMessage } from '../types/support';
import type { Duel, DuelQuestion } from '../types/duel';

export interface DiaryEntry {
  id: string;
  studentId: string;
  title: string;
  content: string;
  mood: string;
  tags: string[];
  isAIGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DuelQuestionHistory {
  id: string;
  studentId: string;
  theme: string;
  questionText: string;
  seenAt: string;
}


export interface StudentActivityResult {
  id: string; // activityId + studentId
  activityId: string;
  studentId: string;
  status: 'passed' | 'failed' | 'given_up';
  score: number;
  totalQuestions: number;
  xpEarned: number;
  coinsEarned: number;
  completedAt: string;
  timeSpent?: number; // in seconds
  responses?: any[]; // Simplified for Dexie, type defined in gamification.ts
}


export interface AppNotification {
  id: string;
  userId: string;
  role: 'student' | 'guardian' | 'teacher' | 'admin';
  title: string;
  message: string;
  type: 'info' | 'reward' | 'alert' | 'success' | 'warning' | 'system';
  priority: 'low' | 'normal' | 'high';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}


export class ImpactoDatabase extends Dexie {
  users!: EntityTable<AppUser, 'id'>;
  schools!: EntityTable<{ id: string; name: string; status: 'active' | 'inactive'; usersCount: number; globalScore: number; logo?: string }, 'id'>;
  classes!: EntityTable<SchoolClass, 'id'>;

  // Avatar
  avatarCatalog!: EntityTable<AvatarCatalogItem, 'id'>;
  studentOwnedAvatars!: EntityTable<StudentOwnedAvatarItem, 'id'>;
  studentAvatarProfiles!: EntityTable<StudentAvatarProfile, 'studentId'>;
  avatarCollections!: EntityTable<AvatarCollection, 'id'>;
  avatarCampaigns!: EntityTable<AdminAvatarCampaign, 'id'>;

  // Gamification
  gamificationStats!: EntityTable<GamificationStats, 'id'>;
  achievements!: EntityTable<Achievement, 'id'>;
  studentAchievements!: EntityTable<StudentAchievement, 'id'>;
  missions!: EntityTable<Mission, 'id'>;
  studentMissions!: EntityTable<StudentMissionProgress, 'id'>;

  // Learning
  learningPaths!: EntityTable<LearningPath, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  studentProgress!: EntityTable<StudentProgress, 'id'>;
  studentActivityResults!: EntityTable<StudentActivityResult, 'id'>;

  // Support
  supportTickets!: EntityTable<SupportTicket, 'id'>;
  ticketMessages!: EntityTable<TicketMessage, 'id'>;
  libraryItems!: EntityTable<LibraryItem, 'id'>;
  diaryEntries!: EntityTable<DiaryEntry, 'id'>;
  duels!: EntityTable<Duel, 'id'>;
  duelQuestions!: EntityTable<DuelQuestion, 'id'>;
  duelQuestionHistory!: EntityTable<DuelQuestionHistory, 'id'>;

  // System
  notifications!: EntityTable<AppNotification, 'id'>;


  constructor() {
    super('ImpactoIADatabase');
    this.version(5).stores({
      users: 'id, role, studentCode, guardianCode, email, isRegistered',
      schools: 'id, name, status',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade',
      studentProgress: 'id, studentId, pathId, status',
    });
    this.version(5).stores({
      users: 'id, role, studentCode, guardianCode, email',
      schools: 'id, name, status',
      classes: 'id, name, grade, teacherId',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade',
      studentProgress: 'id, studentId, pathId, status',
    });
    this.version(8).stores({
      users: 'id, role, studentCode, guardianCode, email',
      schools: 'id, name, status',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
    });
    this.version(9).stores({
      users: 'id, role, studentCode, guardianCode, email',
      schools: 'id, name, status',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
    });
    this.version(10).stores({
      users: 'id, role, studentCode, guardianCode, email',
      schools: 'id, name, status',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
    });
    this.version(11).stores({
      users: 'id, role, studentCode, guardianCode, email',
      schools: 'id, name, status',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type',
      studentMissions: 'id, studentId, missionId',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
    });
    this.version(15).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId',
      schools: 'id, name, status, globalScore',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
    });
    this.version(16).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId',
      schools: 'id, name, status, globalScore',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
      notifications: 'id, userId, role, read, createdAt',
    });
    this.version(18).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId, guardianId, [schoolId+role]',
      schools: 'id, name, status, globalScore',
      classes: 'id, name, grade, teacherId, schoolId, year',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria, title',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId, title',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
      notifications: 'id, userId, role, read, createdAt',
    });

    this.version(19).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId, guardianId, [schoolId+role], classId',
      schools: 'id, name, status, globalScore',
      classes: 'id, name, grade, teacherId, schoolId, year, *studentIds',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria, title',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade',
      activities: 'id, subject, grade, classId, teacherId, title',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
      notifications: 'id, userId, role, read, createdAt',
      duels: 'id, challengerId, challengedId, status, createdAt',
      duelQuestions: 'id, duelId',
    });

    this.version(23).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId, guardianId, *guardianIds, [schoolId+role], classId',
      schools: 'id, name, status, globalScore, logo',
      classes: 'id, name, grade, teacherId, schoolId, year, *studentIds',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria, title',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade, classId, schoolYear, schoolId',
      activities: 'id, subject, grade, classId, teacherId, title',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt, schoolId, isReadByParticipant, isReadByAdmin',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
      notifications: 'id, userId, role, read, createdAt',
      duels: 'id, challengerId, challengedId, status, createdAt',
      duelQuestions: 'id, duelId',
    });
    this.version(24).stores({
      users: 'id, role, studentCode, guardianCode, email, schoolId, guardianId, *guardianIds, [schoolId+role], classId',
      schools: 'id, name, status, globalScore, logo',
      classes: 'id, name, grade, teacherId, schoolId, year, *studentIds',
      avatarCatalog: 'id, type, priceCoins, rarity, isActive',
      studentOwnedAvatars: 'id, studentId, catalogItemId',
      studentAvatarProfiles: 'studentId',
      avatarCollections: 'id, isActive',
      avatarCampaigns: 'id, isActive',
      gamificationStats: 'id',
      achievements: 'id',
      studentAchievements: 'id, studentId, achievementId',
      missions: 'id, type, criteria, title',
      studentMissions: 'id, studentId, missionId, [studentId+missionId]',
      learningPaths: 'id, subject, grade, classId, schoolYear, schoolId',
      activities: 'id, subject, grade, classId, teacherId, title',
      studentProgress: 'id, studentId, pathId, status',
      supportTickets: 'id, userId, status, priority, createdAt, schoolId, isReadByParticipant, isReadByAdmin',
      ticketMessages: 'id, ticketId, senderId, createdAt',
      libraryItems: 'id, classId, teacherId, subject, grade, type',
      diaryEntries: 'id, studentId, createdAt',
      studentActivityResults: 'id, activityId, studentId, status',
      notifications: 'id, userId, role, read, createdAt',
      duels: 'id, challengerId, challengedId, status, createdAt',
      duelQuestions: 'id, duelId',
      duelQuestionHistory: 'id, studentId, theme, seenAt, [studentId+theme]',
    });
  }
}



export const db = new ImpactoDatabase();
