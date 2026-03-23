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
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { RefreshRequestDto, RefreshResponseDto } from './dto/refresh.dto';
import { LogoutRequestDto, LogoutResponseDto } from './dto/logout.dto';
import { LogoutAllRequestDto, LogoutAllResponseDto } from './dto/logoutAll.dto';
import { GetProfileResponseDto } from './dto/get-profile.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';
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
  UnauthorizedErrorResponseDto,
  ValidationErrorResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Register
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
  register(
    @Body() registerRequestDto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(registerRequestDto);
  }

  // Login
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
  login(@Body() loginRequestDto: LoginRequestDto) {
    return this.authService.login(loginRequestDto);
  }

  // Refresh tokens
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
  refresh(@Body() refreshRequestDto: RefreshRequestDto) {
    return this.authService.refresh(refreshRequestDto);
  }

  // Logout current session
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
  logout(@Body() logoutRequestDto: LogoutRequestDto) {
    return this.authService.logout(logoutRequestDto);
  }

  // Logout all sessions
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
  logoutAll(@Body() logoutAllRequestDto: LogoutAllRequestDto) {
    return this.authService.logoutAll(logoutAllRequestDto);
  }

  // Get current user profile
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
