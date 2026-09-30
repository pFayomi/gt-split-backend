import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingsContribution } from './savings-box.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingsContribution)
    private savingsRepository: Repository<SavingsContribution>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async contribute(params: {
    accountNumber: string;
    contributorName: string;
    splitId: string;
    splitTitle: string;
    amount: number;
  }): Promise<SavingsContribution> {
    const contribution = this.savingsRepository.create(params);
    return this.savingsRepository.save(contribution);
  }

  async getTotalForAccount(accountNumber: string): Promise<number> {
    const contributions = await this.savingsRepository.find({ where: { accountNumber } });
    return contributions.reduce((sum, c) => sum + Number(c.amount), 0);
  }

  async getHistoryForAccount(accountNumber: string): Promise<SavingsContribution[]> {
    return this.savingsRepository.find({
      where: { accountNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async getForSplit(splitId: string): Promise<SavingsContribution[]> {
    return this.savingsRepository.find({ where: { splitId } });
  }
}