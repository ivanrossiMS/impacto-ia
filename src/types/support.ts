export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  schoolId?: string;
  updatedAt: string;
  lastMessage?: string;
  isReadByParticipant: boolean;
  isReadByAdmin: boolean;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  senderRole?: string;
}
