import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body() body: { accountNumber: string; pin: string }) {
    return this.authService.login(body.accountNumber, body.pin);
  }

  @Post('seed-user')
  async seedUser(@Body() body: { accountNumber: string; fullName: string; pin: string }) {
    return this.usersService.createUser(body.accountNumber, body.fullName, body.pin);
  }

  @Post('update-phone')
  async updatePhone(@Body() body: { accountNumber: string; phone: string }) {
    return this.usersService.updatePhone(body.accountNumber, body.phone);
  }

  @Post('update-email')
  async updateEmail(@Body() body: { accountNumber: string; email: string }) {
    return this.usersService.updateEmail(body.accountNumber, body.email);
  }

  @Post('delete-user')
  async deleteUser(@Body() body: { accountNumber: string }) {
    return this.usersService.deleteUser(body.accountNumber);
  }
}