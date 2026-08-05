import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  UseGuards,
  Request,
  Header,
  Query,
  Res,
  Param,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { RefreshResponseDto } from './dto/refresh.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { VerifyEmailQueryDto } from './dto/email-verification.dto';
import { ConfigService } from '@nestjs/config';
import { EmailVerificationResendRequestDto } from './dto/email-verification-resend.dto';
import {
  ApiAuthController,
  ApiEmailVerificationEndpoint,
  ApiEmailVerificationResendEndpoint,
  ApiForgotPasswordEndpoint,
  ApiGetProfileEndpoint,
  ApiGetSessionsEndpoint,
  ApiLoginEndpoint,
  ApiLogoutAllEndpoint,
  ApiLogoutEndpoint,
  ApiRefreshEndpoint,
  ApiRegisterEndpoint,
  ApiRevokeOtherSessionsEndpoint,
  ApiRevokeSessionEndpoint,
  ApiResetPasswordEndpoint,
} from './auth-swagger.decorators';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import { ResetPasswordRequestDto } from './dto/reset-password.dto';
import { SessionIdParamDto } from './dto/revoke-session.dto';
import { RefreshCookieService } from './cookies/refresh-cookie.service';
import { IssuedAuthTokenSet } from './types/auth-tokens';
import { CsrfCookieService } from './cookies/csrf-cookie.service';

@ApiAuthController()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly refreshCookieService: RefreshCookieService,
    private readonly csrfCookieService: CsrfCookieService,
  ) {}

  @ApiRegisterEndpoint()
  @Throttle({ authRegister: {} })
  @SkipThrottle({ authLogin: true, authRefresh: true })
  @Post('register')
  register(
    @Body() registerRequestDto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(registerRequestDto);
  }

  // Login
  @ApiLoginEndpoint()
  @Throttle({ authLogin: {} })
  @SkipThrottle({ authRegister: true, authRefresh: true })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginRequestDto: LoginRequestDto,
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
  ): Promise<LoginResponseDto> {
    const rawUserAgent = request.headers['user-agent'];
    const userAgent = typeof rawUserAgent === 'string' ? rawUserAgent : null;
    const ipAddress = request.ip ?? null;
    const issuedAuthTokenSet: IssuedAuthTokenSet = await this.authService.login(
      {
        credentials: loginRequestDto,
        metadata: { userAgent, ipAddress },
      },
    );
    this.refreshCookieService.set(response, issuedAuthTokenSet.rawRefreshToken);
    this.csrfCookieService.set(response, issuedAuthTokenSet.rawCsrfToken);
    return { access_token: issuedAuthTokenSet.rawAccessToken };
  }

  // Refresh token
  @ApiRefreshEndpoint()
  @Throttle({ authRefresh: {} })
  @SkipThrottle({ authLogin: true, authRegister: true })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
  ): Promise<RefreshResponseDto> {
    const refreshToken = this.refreshCookieService.getToken(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh credentials are required');
    }

    const issuedAuthTokenSet: IssuedAuthTokenSet =
      await this.authService.refresh(refreshToken);
    this.refreshCookieService.set(response, issuedAuthTokenSet.rawRefreshToken);
    this.csrfCookieService.set(response, issuedAuthTokenSet.rawCsrfToken);
    return { access_token: issuedAuthTokenSet.rawAccessToken };
  }

  // Logout current session
  @ApiLogoutEndpoint()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    try {
      const refreshToken = this.refreshCookieService.getToken(request);
      if (!refreshToken) {
        throw new UnauthorizedException('Refresh credentials are required');
      }
      const result = await this.authService.logout(refreshToken);
      this.refreshCookieService.clear(response);
      this.csrfCookieService.clear(response);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.refreshCookieService.clear(response);
        this.csrfCookieService.clear(response);
      }
      throw error;
    }
  }

  // Logout all sessions
  @ApiLogoutAllEndpoint()
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    try {
      const refreshToken = this.refreshCookieService.getToken(request);
      if (!refreshToken) {
        throw new UnauthorizedException('Refresh credentials are required');
      }
      const result = await this.authService.logoutAll(refreshToken);
      this.refreshCookieService.clear(response);
      this.csrfCookieService.clear(response);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.refreshCookieService.clear(response);
        this.csrfCookieService.clear(response);
      }
      throw error;
    }
  }

  // Get current user profile
  @ApiGetProfileEndpoint()
  @UseGuards(AuthGuard)
  @Get('me')
  @Header('Cache-Control', 'no-store')
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.payload.sub);
  }

  // Get all user's active sessions
  @ApiGetSessionsEndpoint()
  @Get('sessions')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  getSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.getActiveSessions({
      sessionId: req.payload.sessionId,
      userId: req.payload.sub,
    });
  }

  @ApiRevokeOtherSessionsEndpoint()
  @Delete('sessions/others')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  revokeOtherSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.revokeOtherUserSessions({
      userId: req.payload.sub,
      sessionId: req.payload.sessionId,
    });
  }

  // revokes user's active session by session id
  @ApiRevokeSessionEndpoint()
  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  revokeSession(
    @Param() params: SessionIdParamDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.authService.revokeUserSession({
      userId: req.payload.sub,
      sessionId: params.id,
    });
  }

  // Verify user's email
  @ApiEmailVerificationEndpoint()
  @Get('email-verification')
  @Header('Cache-Control', 'no-store')
  async emailVerification(
    @Query() query: VerifyEmailQueryDto,
    @Res() response: ExpressResponse,
  ) {
    const customResultUrl = this.config.getOrThrow<string>(
      'emailVerificationResultUrl',
    );
    const redirectUrl = new URL(customResultUrl);
    try {
      const outcome = await this.authService.verifyEmail(query.token);
      redirectUrl.searchParams.set('status', outcome);
    } catch (_error) {
      redirectUrl.searchParams.set('status', 'invalid');
    }
    return response.redirect(redirectUrl.toString());
  }

  @ApiEmailVerificationResendEndpoint()
  @Post('email-verification/resend')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  emailVerificationResend(
    @Body()
    emailVerificationResendRequestDto: EmailVerificationResendRequestDto,
  ) {
    return this.authService.emailVerificationResend(
      emailVerificationResendRequestDto,
    );
  }

  @ApiForgotPasswordEndpoint()
  @Post('forgot-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  forgotPassword(@Body() forgotPasswordRequestDto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(forgotPasswordRequestDto);
  }

  @ApiResetPasswordEndpoint()
  @Post('reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resetPassword(@Body() resetPasswordRequestDto: ResetPasswordRequestDto) {
    return this.authService.resetPassword(resetPasswordRequestDto);
  }
}
