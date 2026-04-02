import { Injectable, Logger } from '@nestjs/common';

export interface MailServiceContract {
  sendEmailVerification(email: string, verificationLink: string): Promise<void>;
}

@Injectable()
export class MailService implements MailServiceContract {
  private readonly logger = new Logger(MailService.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendEmailVerification(email: string, verificationLink: string) {
    console.log(`Email verification link for ${email}: ${verificationLink}`);
    this.logger.log(
      `Email verification link for ${email}: ${verificationLink}`,
    );
  }
}
