import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** Account holders available as transfer beneficiaries. */
  @Get()
  async findAll() {
    return this.usersService.findAccountHolders();
  }
}