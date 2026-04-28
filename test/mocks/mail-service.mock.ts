import type { MailServiceContract } from '../../src/auth/providers/mail.service';

export type MailServiceMock = MailServiceContract & {
  lastEmailVerificationLink: string | null;
  lastPasswordResetLink: string | null;
  sendEmailVerification: jest.MockedFunction<
    MailServiceContract['sendEmailVerification']
  >;
  sendPasswordReset: jest.MockedFunction<
    MailServiceContract['sendPasswordReset']
  >;
  reset: () => void;
};

export function createMailServiceMock(): MailServiceMock {
  const mock = {
    lastEmailVerificationLink: null,
    lastPasswordResetLink: null,
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    reset: () => {},
  } as MailServiceMock;

  const applyDefaultBehavior = () => {
    mock.sendEmailVerification.mockImplementation(
      (_email, verificationLink) => {
        mock.lastEmailVerificationLink = verificationLink;
        return Promise.resolve();
      },
    );

    mock.sendPasswordReset.mockImplementation((_email, passwordResetLink) => {
      mock.lastPasswordResetLink = passwordResetLink;
      return Promise.resolve();
    });
  };

  mock.reset = () => {
    mock.lastEmailVerificationLink = null;
    mock.lastPasswordResetLink = null;

    mock.sendEmailVerification.mockReset();
    mock.sendPasswordReset.mockReset();

    applyDefaultBehavior();
  };

  mock.reset();
  return mock;
}

export const getLastEmailVerificationUrl = (
  mailServiceMock: MailServiceMock,
) => {
  const verificationLink = mailServiceMock.lastEmailVerificationLink;
  if (!verificationLink) {
    throw new Error('Verification link was not captured by mailServiceMock');
  }

  const url = new URL(verificationLink);
  if (!url.searchParams.get('token')) {
    throw new Error('Invalid verification link');
  }

  return url;
};

export const getLastResetPasswordUrl = (mailServiceMock: MailServiceMock) => {
  const passwordResetLink = mailServiceMock.lastPasswordResetLink;
  if (!passwordResetLink) {
    throw new Error('Password reset link was not captured by mailServiceMock');
  }

  const url = new URL(passwordResetLink);
  if (!url.searchParams.get('token')) {
    throw new Error('Invalid verification link');
  }

  return url;
};
