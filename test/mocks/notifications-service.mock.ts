import type { NotificationsServiceContract } from '../../src/notifications/notifications.service';

export type NotificationsServiceMock = NotificationsServiceContract & {
  lastEmailVerificationLink: string | null;
  lastPasswordResetLink: string | null;
  sendEmailVerification: jest.MockedFunction<
    NotificationsServiceContract['sendEmailVerification']
  >;
  sendPasswordReset: jest.MockedFunction<
    NotificationsServiceContract['sendPasswordReset']
  >;
  reset: () => void;
};

export function createNotificationsServiceMock(): NotificationsServiceMock {
  const mock = {
    lastEmailVerificationLink: null,
    lastPasswordResetLink: null,
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    reset: () => {},
  } as NotificationsServiceMock;

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
  notificationsServiceMock: NotificationsServiceMock,
) => {
  const verificationLink = notificationsServiceMock.lastEmailVerificationLink;
  if (!verificationLink) {
    throw new Error(
      'Verification link was not captured by notificationsServiceMock',
    );
  }

  const url = new URL(verificationLink);
  if (!url.searchParams.get('token')) {
    throw new Error('Invalid verification link');
  }

  return url;
};

export const getLastResetPasswordUrl = (
  notificationsServiceMock: NotificationsServiceMock,
) => {
  const passwordResetLink = notificationsServiceMock.lastPasswordResetLink;
  if (!passwordResetLink) {
    throw new Error(
      'Password reset link was not captured by notificationsServiceMock',
    );
  }

  const url = new URL(passwordResetLink);
  if (!url.searchParams.get('token')) {
    throw new Error('Invalid password reset link');
  }

  return url;
};
