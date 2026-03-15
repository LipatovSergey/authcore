import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterOutput } from './interfaces/register.contract';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutAllDto } from './dto/logoutAll.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ConflictErrorResponseDto,
  GetProfileResponseDto,
  LoginResponseDto,
  LogoutAllResponseDto,
  LogoutResponseDto,
  RefreshResponseDto,
  RegisterResponseDto,
  UnauthorizedErrorResponseDto,
  ValidationErrorResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists',
    type: ConflictErrorResponseDto,
  })
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<RegisterOutput> {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({
    description: 'Tokens returned successfully',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    type: UnauthorizedErrorResponseDto,
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid refresh token',
    type: UnauthorizedErrorResponseDto,
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @ApiOperation({ summary: 'Log out from current session' })
  @ApiOkResponse({
    description: 'Current refresh token revoked successfully',
    type: LogoutResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid refresh token',
    type: UnauthorizedErrorResponseDto,
  })
  @Post('logout')
  @HttpCode(200)
  logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }

  @ApiOperation({ summary: 'Log out from all sessions' })
  @ApiOkResponse({
    description: 'All user refresh tokens revoked successfully',
    type: LogoutAllResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid refresh token',
    type: UnauthorizedErrorResponseDto,
  })
  @Post('logout-all')
  @HttpCode(200)
  logoutAll(@Body() logoutAllDto: LogoutAllDto) {
    return this.authService.logoutAll(logoutAllDto);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({
    description: 'Current user profile returned successfully',
    type: GetProfileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing or invalid',
    type: UnauthorizedErrorResponseDto,
  })
  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.payload.sub);
  }
}
