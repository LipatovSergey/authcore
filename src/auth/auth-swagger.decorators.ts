import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ConflictErrorResponseDto,
  UnauthorizedErrorResponseDto,
  ValidationErrorResponseDto,
} from './dto/auth-error-response.dto';
import { GetProfileResponseDto } from './dto/get-profile.dto';
import { LoginResponseDto } from './dto/login.dto';
import { LogoutResponseDto } from './dto/logout.dto';
import { LogoutAllResponseDto } from './dto/logoutAll.dto';
import { RefreshResponseDto } from './dto/refresh.dto';
import { RegisterResponseDto } from './dto/register.dto';
import { EmailVerificationResendResponseDto } from './dto/email-verification-resend.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password.dto';
import { ResetPasswordResponseDto } from './dto/reset-password.dto';

export function ApiAuthController() {
  return applyDecorators(ApiTags('auth'));
}

export function ApiRegisterEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Register a new user' }),
    ApiCreatedResponse({
      description: 'User registered successfully',
      type: RegisterResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiConflictResponse({
      description: 'Email already exists',
      type: ConflictErrorResponseDto,
    }),
  );
}

export function ApiLoginEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Log in with email and password' }),
    ApiOkResponse({
      description: 'Tokens returned successfully',
      type: LoginResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid credentials',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}

export function ApiRefreshEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Refresh access and refresh tokens' }),
    ApiOkResponse({
      description: 'Tokens refreshed successfully',
      type: RefreshResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid refresh token',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}

export function ApiLogoutEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Log out from current session' }),
    ApiOkResponse({
      description: 'Current refresh token revoked successfully',
      type: LogoutResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid refresh token',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}

export function ApiLogoutAllEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Log out from all sessions' }),
    ApiOkResponse({
      description: 'All user refresh tokens revoked successfully',
      type: LogoutAllResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid refresh token',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}

export function ApiGetProfileEndpoint() {
  return applyDecorators(
    ApiBearerAuth('bearer'),
    ApiOperation({ summary: 'Get current user profile' }),
    ApiOkResponse({
      description: 'Current user profile returned successfully',
      type: GetProfileResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Access token is missing or invalid',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}

export function ApiEmailVerificationEndpoint() {
  return applyDecorators(
    ApiOperation({
      summary: 'Verify email by token',
      description:
        'Verifies the email verification token. Redirects to the configured client result URL.',
    }),
    ApiQuery({
      name: 'token',
      required: true,
      description: 'Email verification token from the email link',
      type: String,
    }),
    ApiOkResponse({
      description:
        'Redirects to the configured client result URL with ?status=verified, ?status=already_verified, or ?status=invalid.',
    }),
  );
}

export function ApiEmailVerificationResendEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Resend email verification link' }),
    ApiOkResponse({
      description:
        'Returns a generic success response whether or not a new verification email was sent.',
      type: EmailVerificationResendResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
  );
}

export function ApiForgotPasswordEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Request a password reset link' }),
    ApiOkResponse({
      description:
        'Returns a generic success response whether or not a password reset email was sent.',
      type: ForgotPasswordResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
  );
}

export function ApiResetPasswordEndpoint() {
  return applyDecorators(
    ApiOperation({ summary: 'Reset password by token' }),
    ApiOkResponse({
      description: 'Password reset successfully',
      type: ResetPasswordResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      type: ValidationErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid password reset token',
      type: UnauthorizedErrorResponseDto,
    }),
  );
}
