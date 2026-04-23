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
} from '@nestjs/common';
import { AuthService, VERIFY_EMAIL_OUTCOME } from './auth.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { RefreshRequestDto } from './dto/refresh.dto';
import { LogoutRequestDto } from './dto/logout.dto';
import { LogoutAllRequestDto } from './dto/logoutAll.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';
import { Throttle } from '@nestjs/throttler';
import { VerifyEmailQueryDto } from './dto/email-verification.dto';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { resolve } from 'node:path';
import { EmailVerificationResendRequestDto } from './dto/email-verification-resend.dto';
import {
  ApiAuthController,
  ApiEmailVerificationEndpoint,
  ApiEmailVerificationResendEndpoint,
  ApiGetProfileEndpoint,
  ApiLoginEndpoint,
  ApiLogoutAllEndpoint,
  ApiLogoutEndpoint,
  ApiRefreshEndpoint,
  ApiRegisterEndpoint,
} from './auth-swagger.decorators';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';

const verifiedPagePath = resolve(
  process.cwd(),
  'src',
  'auth',
  'pages',
  'verified.html',
);
const alreadyVerifiedPagePath = resolve(
  process.cwd(),
  'src',
  'auth',
  'pages',
  'already-verified.html',
);
const verificationFailedPagePath = resolve(
  process.cwd(),
  'src',
  'auth',
  'pages',
  'verification-failed.html',
);

@ApiAuthController()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Register
  @ApiRegisterEndpoint()
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('register')
  register(
    @Body() registerRequestDto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(registerRequestDto);
  }

  // Login
  @ApiLoginEndpoint()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() loginRequestDto: LoginRequestDto) {
    return this.authService.login(loginRequestDto);
  }

  // Refresh tokens
  @ApiRefreshEndpoint()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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

  // Verify user's email
  @ApiEmailVerificationEndpoint()
  @Get('email-verification')
  @Header('Cache-Control', 'no-store')
  async emailVerification(
    @Query() query: VerifyEmailQueryDto,
    @Res() res: Response,
  ) {
    const customResultUrl = this.config.get<string>(
      'emailVerificationResultUrl',
    );
    try {
      const outcome = await this.authService.verifyEmail(query.token);
      if (customResultUrl) {
        const redirectUrl = new URL(customResultUrl);
        redirectUrl.searchParams.set('status', outcome);
        return res.redirect(redirectUrl.toString());
      }

      if (outcome === VERIFY_EMAIL_OUTCOME.ALREADY_VERIFIED) {
        return res.sendFile(alreadyVerifiedPagePath);
      }

      return res.sendFile(verifiedPagePath);
    } catch (_error) {
      if (customResultUrl) {
        const redirectUrl = new URL(customResultUrl);
        redirectUrl.searchParams.set('status', 'invalid');
        return res.redirect(redirectUrl.toString());
      }
      return res.sendFile(verificationFailedPagePath);
    }
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

  @Post('forgot-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  forgotPassword(@Body() forgotPasswordRequestDto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(forgotPasswordRequestDto);
  }
}
