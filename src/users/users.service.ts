import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByAccountNumber(accountNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { accountNumber } });
  }

  async createUser(accountNumber: string, fullName: string, plainPin: string): Promise<User> {
    const pinHash = await bcrypt.hash(plainPin, 10);
    const user = this.usersRepository.create({ accountNumber, fullName, pinHash });
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
}