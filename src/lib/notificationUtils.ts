import { supabase } from './supabase';

export type NotificationType = 'info' | 'reward' | 'alert' | 'success' | 'warning' | 'system';
export type UserRole = 'student' | 'guardian' | 'teacher' | 'admin';

interface CreateNotificationParams {
  userId: string;
  role: UserRole;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: 'low' | 'normal' | 'high';
  actionUrl?: string;
}

/**
 * Creates a notification in the database for a specific user.
 * Automatically notifies guardians if the user is a student.
 */
export async function createNotification({
  userId,
  role,
  title,
  message,
  type = 'info',
  priority = 'normal',
  actionUrl,
  skipMirroring = false
}: CreateNotificationParams & { skipMirroring?: boolean }) {
  if (!userId) return;

  const now = new Date().toISOString();
  const notification = {
    id: crypto.randomUUID(),
    userId,
    role,
    title,
    message,
    type,
    priority,
    read: false,
    actionUrl,
    createdAt: now
  };

  const { error } = await supabase.from('notifications').insert(notification);
  if (error) console.error('Error creating notification:', error);

  // Auto-mirror to guardians if recipient is a student
  if (role === 'student' && !skipMirroring) {
    await createBulkNotificationsForGuardians(
      [userId],
      title,
      (studentName: string) => `[Para Responsáveis] ${studentName}: ${message}`,
      type,
      priority,
      actionUrl?.replace('/student/', '/guardian/')
    );
  }
}

/**
 * Creates notifications for multiple users.
 * Automatically notifies guardians if the role is student.
 */
export async function createBulkNotifications(
  userIds: string[],
  role: UserRole,
  title: string,
  message: string,
  type: NotificationType = 'info',
  priority: 'low' | 'normal' | 'high' = 'normal',
  actionUrl?: string,
  skipMirroring = false
) {
  if (!userIds || userIds.length === 0) return;

  const now = new Date().toISOString();
  const notifications = userIds.map(id => ({
    id: crypto.randomUUID(),
    userId: id,
    role,
    title,
    message,
    type,
    priority,
    read: false,
    actionUrl,
    createdAt: now
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  if (error) console.error('Error creating bulk notifications:', error);

  // Auto-mirror to guardians if recipients are students
  if (role === 'student' && !skipMirroring) {
    await createBulkNotificationsForGuardians(
      userIds,
      title,
      (studentName: string) => `[Para Responsáveis] ${studentName}: ${message}`,
      type,
      priority,
      actionUrl?.replace('/student/', '/guardian/')
    );
  }
}

/**
 * Sends a notification to the guardians of the specified students.
 * Checks both guardianId and guardianIds.
 */
export async function createBulkNotificationsForGuardians(
  studentIds: string[],
  title: string,
  messageGenerator: (studentName: string) => string,
  type: NotificationType = 'info',
  priority: 'low' | 'normal' | 'high' = 'normal',
  actionUrl?: string
) {
  if (!studentIds || studentIds.length === 0) return;

  // 1. Get all students to find their guardian links and names from Supabase
  const { data: students, error: studentError } = await supabase
    .from('users')
    .select('id, name, guardianIds, guardianId')
    .in('id', studentIds);

  if (studentError || !students) return;

  const notifications: any[] = [];
  const now = new Date().toISOString();

  for (const student of students) {
    // Collect all unique guardian IDs
    const guardianIds = new Set<string>();
    
    // 1. Support for multiple guardian IDs (preferred)
    const gIds = student.guardianIds;
    if (gIds) {
      if (Array.isArray(gIds)) {
        gIds.forEach((id: string) => id && guardianIds.add(id));
      } else if (typeof gIds === 'string') {
        try {
          // If it's a string, try to parse it as JSON
          const parsed = JSON.parse(gIds);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => id && guardianIds.add(id));
          } else if (parsed && typeof parsed === 'string') {
            guardianIds.add(parsed);
          }
        } catch (e) {
          // If not JSON, assume it's a single ID string
          if (gIds.trim()) guardianIds.add(gIds.trim());
        }
      }
    }

    // 2. Fallback for singular guardianId (legacy/compatibility)
    if (student.guardianId && typeof student.guardianId === 'string') {
      guardianIds.add(student.guardianId);
    }

    if (guardianIds.size > 0) {
      const message = messageGenerator(student.name);
      console.log(`[NotificationMirror] Student: ${student.name}, Guardians: ${Array.from(guardianIds).join(', ')}`);
      
      guardianIds.forEach((gId: string) => {
        notifications.push({
          id: crypto.randomUUID(),
          userId: gId,
          role: 'guardian',
          title,
          message,
          type,
          priority,
          read: false,
          actionUrl,
          createdAt: now
        });
      });
    } else {
      console.warn(`[NotificationMirror] Student: ${student.name} has no guardians linked.`);
    }
  }

  if (notifications.length > 0) {
    // Filter out duplicates (at application level)
    const uniqueNotificationsMap = new Map();
    notifications.forEach(n => {
      const key = `${n.userId}-${n.message}`;
      if (!uniqueNotificationsMap.has(key)) {
        uniqueNotificationsMap.set(key, n);
      }
    });
    
    const uniqueNotifications = Array.from(uniqueNotificationsMap.values());
    await supabase.from('notifications').insert(uniqueNotifications);
  }
}
