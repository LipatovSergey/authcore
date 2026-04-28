import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface NotificationsServiceContract {
  sendEmailVerification(email: string, verificationLink: string): Promise<void>;
  sendPasswordReset(email: string, verificationLink: string): Promise<void>;
}

export type NotificationsOutboxMessage = {
  id: string;
  type: 'email_verification' | 'password_reset';
  to: string;
  link: string;
  createdAt: Date;
};

@Injectable()
export class NotificationsService implements NotificationsServiceContract {
  private readonly outbox: NotificationsOutboxMessage[] = [];

  private saveToOutbox(message: NotificationsOutboxMessage): void {
    this.outbox.unshift(message);
  }

  getOutboxMessages(): NotificationsOutboxMessage[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox.length = 0;
  }

  sendEmailVerification(email: string, link: string): Promise<void> {
    this.saveToOutbox({
      id: randomUUID(),
      type: 'email_verification',
      to: email,
      link,
      createdAt: new Date(),
    });
    return Promise.resolve();
  }

  sendPasswordReset(email: string, link: string): Promise<void> {
    this.saveToOutbox({
      id: randomUUID(),
      type: 'password_reset',
      to: email,
      link,
      createdAt: new Date(),
    });
    return Promise.resolve();
  }
}
