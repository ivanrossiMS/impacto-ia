import { db } from './dexie';

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

  await db.notifications.add(notification);

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

  await db.notifications.bulkAdd(notifications);

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

  // 1. Get all students to find their guardian links and names
  const students = await db.users
    .where('id')
    .anyOf(studentIds)
    .toArray();

  const notifications: any[] = [];
  const now = new Date().toISOString();

  for (const student of students) {
    // Collect all unique guardian IDs (checking both formats)
    const guardianIds = new Set<string>();
    
    if ((student as any).guardianId) guardianIds.add((student as any).guardianId);
    if ((student as any).guardianIds && Array.isArray((student as any).guardianIds)) {
      (student as any).guardianIds.forEach((id: string) => guardianIds.add(id));
    }

    if (guardianIds.size > 0) {
      const message = messageGenerator(student.name);
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
    }
  }

  if (notifications.length > 0) {
    // Use bulkAdd but filter out duplicates just in case
    const uniqueNotifications = Array.from(new Map(notifications.map(n => [n.userId + n.message, n])).values());
    await db.notifications.bulkAdd(uniqueNotifications);
  }
}
