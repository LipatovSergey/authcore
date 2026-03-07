import type { Request } from 'express';
import type { AccessTokenPayload } from './token-payloads.interface';

export type AuthenticatedRequest = Request & {
  payload: AccessTokenPayload;
};
