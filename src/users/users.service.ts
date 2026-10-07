import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { DEMO_ACCOUNT_EMAILS } from './demo-emails';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /** Give demo accounts their backend-only email if they have none yet (never overwrites). */
  async onModuleInit() {
    try {
      for (const [accountNumber, email] of Object.entries(DEMO_ACCOUNT_EMAILS)) {
        const user = await this.findByAccountNumber(accountNumber);
        if (user && !user.email) {
          user.email = email;
          await this.usersRepository.save(user);
        }
      }
    } catch (e) {
      console.error('Could not apply demo account emails:', e);
    }
  }

  async findByAccountNumber(accountNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { accountNumber } });
  }

  /**
   * Every account holder, minus the sensitive fields (pinHash/balance), so the
   * app can populate the transfer beneficiary picker straight from the backend.
   */
  async findAccountHolders(): Promise<
    Pick<User, 'id' | 'accountNumber' | 'fullName' | 'phone'>[]
  > {
    const users = await this.usersRepository.find({ order: { createdAt: 'ASC' } });
    return users.map(({ id, accountNumber, fullName, phone }) => ({
      id,
      accountNumber,
      fullName,
      phone,
    }));
  }

  async createUser(accountNumber: string, fullName: string, plainPin: string): Promise<User> {
    const pinHash = await bcrypt.hash(plainPin, 10);
    const user = this.usersRepository.create({ accountNumber, fullName, pinHash, email: DEMO_ACCOUNT_EMAILS[accountNumber] });
    return this.usersRepository.save(user);
  }

  async validatePin(accountNumber: string, plainPin: string): Promise<User | null> {
    const user = await this.findByAccountNumber(accountNumber);
    if (!user) return null;
    const isMatch = await bcrypt.compare(plainPin, user.pinHash);
    return isMatch ? user : null;
  }

  async updatePhone(accountNumber: string, phone: string): Promise<User> {
    const user = await this.findByAccountNumber(accountNumber);
    if (!user) throw new NotFoundException('User not found');
    user.phone = phone;
    return this.usersRepository.save(user);
  }

  async updateEmail(accountNumber: string, email: string): Promise<User> {
    const user = await this.findByAccountNumber(accountNumber);
    if (!user) throw new NotFoundException('User not found');
    user.email = email;
    return this.usersRepository.save(user);
  }
}