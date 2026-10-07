import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { AutosplitService } from '../autosplit/autosplit.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private autosplitService: AutosplitService,
  ) {}

  async getBalance(accountNumber: string): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { accountNumber } });
    if (!user) throw new NotFoundException('Account not found');
    return Number(user.balance);
  }

  async findByAccount(accountNumber: string): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { accountNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async fund(accountNumber: string, amount: number): Promise<{ newBalance: number }> {
    const user = await this.usersRepository.findOne({ where: { accountNumber } });
    if (!user) throw new NotFoundException('Account not found');

    user.balance = Number(user.balance) + amount;
    await this.usersRepository.save(user);

    return { newBalance: Number(user.balance) };
  }

  async debit(params: {
    accountNumber: string;
    amount: number;
    kind: Transaction['kind'];
    title: string;
    subtitle: string;
    splitId?: string;
    narration?: string;
  }): Promise<{ transaction: Transaction; newBalance: number }> {
    const user = await this.usersRepository.findOne({ where: { accountNumber: params.accountNumber } });
    if (!user) throw new NotFoundException('Account not found');

    const currentBalance = Number(user.balance);
    if (currentBalance < params.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    user.balance = currentBalance - params.amount;
    await this.usersRepository.save(user);

    const transaction = this.transactionsRepository.create({
      accountNumber: params.accountNumber,
      kind: params.kind,
      title: params.title,
      subtitle: params.subtitle,
      amount: params.amount,
      direction: 'out',
      splitId: params.splitId,
      narration: params.narration?.trim() || undefined,
    });
    await this.transactionsRepository.save(transaction);

    // Evaluate auto-split rule for this debit. Do not block if it fails.
    try {
      await this.autosplitService.evaluateForDebit({
        accountNumber: params.accountNumber,
        narrationRaw: params.narration,
        amount: params.amount,
        transactionId: transaction.id,
      });
    } catch (e) {
      console.error('Failed to evaluate auto-split for debit:', e);
    }

    return { transaction, newBalance: Number(user.balance) };
  }

  async credit(
    accountNumber: string,
    amount: number,
    title: string,
    subtitle: string,
    kind: Transaction['kind'] = 'billsplit',
    narration?: string,
  ): Promise<{ newBalance: number }> {
    const user = await this.usersRepository.findOne({ where: { accountNumber } });
    if (!user) throw new NotFoundException('Account not found');

    user.balance = Number(user.balance) + amount;
    await this.usersRepository.save(user);

    const transaction = this.transactionsRepository.create({
      accountNumber,
      kind,
      title,
      subtitle,
      amount,
      direction: 'in',
      narration: narration?.trim() || undefined,
    });
    await this.transactionsRepository.save(transaction);

    return { newBalance: Number(user.balance) };
  }
}