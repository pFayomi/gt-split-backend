import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(accountNumber: string, pin: string) {
    const user = await this.usersService.validatePin(accountNumber, pin);
    if (!user) {
      throw new UnauthorizedException('Invalid account number or PIN');
    }

    const payload = { sub: user.id, accountNumber: user.accountNumber };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        accountNumber: user.accountNumber,
        fullName: user.fullName,
        phone: user.phone,
      },
    };
  }
}