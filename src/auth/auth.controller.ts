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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<RegisterOutput> {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }

  @Post('logout-all')
  @HttpCode(200)
  logoutAll(@Body() logoutAllDto: LogoutAllDto) {
    return this.authService.logoutAll(logoutAllDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.payload.sub);
  }
}
