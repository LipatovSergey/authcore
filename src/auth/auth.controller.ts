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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { RefreshRequestDto } from './dto/refresh.dto';
import { LogoutRequestDto } from './dto/logout.dto';
import { LogoutAllRequestDto } from './dto/logoutAll.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';
import type { Request as ExpressRequest } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { VerifyEmailQueryDto } from './dto/email-verification.dto';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
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

@ApiAuthController()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
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
  login(
    @Body() loginRequestDto: LoginRequestDto,
    @Request() req: ExpressRequest,
  ) {
    const rawUserAgent = req.headers['user-agent'];
    const userAgent = typeof rawUserAgent === 'string' ? rawUserAgent : null;
    const ipAddress = req.ip ?? null;
    return this.authService.login({
      credentials: loginRequestDto,
      metadata: { userAgent, ipAddress },
    });
  }

  // Refresh tokenk
  @ApiRefreshEndpoint()
  @Throttle({ authRefresh: {} })
  @SkipThrottle({ authLogin: true, authRegister: true })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() refreshRequestDto: RefreshRequestDto) {
    return this.authService.refresh(refreshRequestDto);
  }

  // Logout current session
  @ApiLogoutEndpoint()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() logoutRequestDto: LogoutRequestDto) {
    return this.authService.logout(logoutRequestDto);
  }

  // Logout all sessions
  @ApiLogoutAllEndpoint()
  @Post('logout-all')
  @HttpCode(200)
  logoutAll(@Body() logoutAllRequestDto: LogoutAllRequestDto) {
    return this.authService.logoutAll(logoutAllRequestDto);
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
    @Res() res: Response,
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
    return res.redirect(redirectUrl.toString());
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
