import type { Request } from 'express';
import type { AccessTokenPayload } from './token-payloads';

export type AuthenticatedRequest = Request & {
  payload: AccessTokenPayload;
};
