export interface CreateSessionInput {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ValidateActiveUserSessionInput {
  sessionId: string;
  userId: string;
}
