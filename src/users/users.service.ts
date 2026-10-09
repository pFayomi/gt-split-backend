import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Participant } from '../splits/participant.entity';
import { DEMO_ACCOUNT_EMAILS } from './demo-emails';
import { DEMO_ACCOUNT_PHONES } from './demo-phones';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Participant)
    private participantsRepository: Repository<Participant>,
  ) {}

  async onModuleInit() {
    await this.applyDemoContacts();
    await this.backfillParticipantPhones();
  }

  /**
   * Give demo accounts their backend-only contact details if they have none yet
   * (never overwrites). The email powers notification emails; the phone is how
   * the app finds a user's own split requests.
   */
  private async applyDemoContacts() {
    try {
      const accountNumbers = new Set([
        ...Object.keys(DEMO_ACCOUNT_EMAILS),
        ...Object.keys(DEMO_ACCOUNT_PHONES),
      ]);
      for (const accountNumber of accountNumbers) {
        const user = await this.findByAccountNumber(accountNumber);
        if (!user) continue;

        let changed = false;
        const email = DEMO_ACCOUNT_EMAILS[accountNumber];
        if (email && !user.email) {
          user.email = email;
          changed = true;
        }
        const phone = DEMO_ACCOUNT_PHONES[accountNumber];
        if (phone && !user.phone) {
          user.phone = phone;
          changed = true;
        }
        if (changed) await this.usersRepository.save(user);
      }
    } catch (e) {
      console.error('Could not apply demo account contacts:', e);
    }
  }

  /**
   * Splits created before the demo accounts had a phone stored their GT-user
   * participants with an empty number, so those requests never reached the
   * participant. Repair the old rows by matching each GT participant's name to
   * the account holder that now has a phone.
   */
  private async backfillParticipantPhones() {
    try {
      const users = await this.usersRepository.find();
      const phoneByName = new Map<string, string>();
      for (const user of users) {
        if (user.phone) phoneByName.set(user.fullName.trim().toLowerCase(), user.phone);
      }
      if (phoneByName.size === 0) return;

      const participants = await this.participantsRepository.find({ where: { isGTUser: true } });
      const toFix = participants.filter(
        (p) => !p.phone && phoneByName.has(p.name.trim().toLowerCase()),
      );
      if (toFix.length === 0) return;

      for (const participant of toFix) {
        participant.phone = phoneByName.get(participant.name.trim().toLowerCase())!;
      }
      await this.participantsRepository.save(toFix);
      console.log(`Backfilled phone for ${toFix.length} GT-user participant(s).`);
    } catch (e) {
      console.error('Could not backfill participant phones:', e);
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
    const user = this.usersRepository.create({
      accountNumber,
      fullName,
      pinHash,
      email: DEMO_ACCOUNT_EMAILS[accountNumber],
      phone: DEMO_ACCOUNT_PHONES[accountNumber],
    });
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

  async deleteUser(accountNumber: string): Promise<{ deleted: boolean }> {
    const user = await this.findByAccountNumber(accountNumber);
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepository.remove(user);
    return { deleted: true };
  }
}
