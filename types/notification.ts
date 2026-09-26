export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_NOTE'
  | 'TASK_APPROVED'
  | 'TASK_COMPLETED'
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_COMMENT'
  | 'TICKET_RESOLVED'
  | 'TICKET_CLOSED'
  | 'GENERAL';

export interface AppNotification {
  id: string;
  targetAccount: string;
  senderAccount: string;
  senderName?: string;
  title: string;
  body: string;
  taskId?: string;
  ticketId?: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  url?: string;
}

export interface UserDeviceToken {
  token: string;
  deviceInfo?: string;
  updatedAt: string;
}

