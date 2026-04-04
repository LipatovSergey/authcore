import { MailServiceContract } from '../../src/auth/providers/mail.service';

export interface MailServiceMock extends MailServiceContract {
  lastEmailVerificationLink: string | null;
}

export const mailServiceMock: MailServiceMock = {
  lastEmailVerificationLink: null,
  // eslint-disable-next-line @typescript-eslint/require-await
  async sendEmailVerification(_email, verificationLink) {
    mailServiceMock.lastEmailVerificationLink = verificationLink;
  },
};

export const getLastEmailVerificationUrl = () => {
  const verificationLink = mailServiceMock.lastEmailVerificationLink;
  if (!verificationLink) {
    throw new Error('Verification link was not captured by mailServiceMock');
  }
  return new URL(verificationLink);
};
