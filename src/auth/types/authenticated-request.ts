import type { Request } from 'express';
import type { AccessTokenPayload } from './jwt-tokens';

export type AuthenticatedRequest = Request & {
  payload: AccessTokenPayload;
};
