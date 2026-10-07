import { forwardRef, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Split } from './split.entity';
import { Participant } from './participant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AutosplitService } from '../autosplit/autosplit.service'; // optional

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('234') ? digits : digits.replace(/^0/, '234');
}

type CreateSplitDto = {
  title: string;
  totalAmount: number;
  hostAccountNumber: string;
  hostName: string;
  splitType: 'equal' | 'custom';
  sourceAccountLabel: string;
  narration?: string | null;
  participants: {
    name: string;
    initials: string;
    phone: string;
    email?: string;
    isGTUser: boolean;
    customShare?: number;
  }[];
};
@Injectable()
export class SplitsService {
  constructor(
    @InjectRepository(Split)
    private splitsRepository: Repository<Split>,
    @InjectRepository(Participant)
    private participantsRepository: Repository<Participant>,
    private notificationsService: NotificationsService,
    @Optional() @Inject(forwardRef(() => AutosplitService))
    private autosplitService?: AutosplitService,
  ) {}

  async createSplit(dto: CreateSplitDto): Promise<Split> {
    const count = dto.participants.length + 1; // +1 for host
    const equalShare = Math.round((dto.totalAmount / count) * 100) / 100;

      const participants = dto.participants.map((p) => {
      const participant = new Participant();
      participant.name = p.name;
      participant.initials = p.initials;
      participant.phone = p.phone;
      participant.email = p.email ?? '';
      participant.isGTUser = p.isGTUser;
      participant.share = dto.splitType === 'equal' ? equalShare : (p.customShare ?? 0);
      participant.status = 'pending';
      return participant;
    });

    const split = this.splitsRepository.create({
      title: dto.title,
      totalAmount: dto.totalAmount,
      hostAccountNumber: dto.hostAccountNumber,
      splitType: dto.splitType,
      sourceAccountLabel: dto.sourceAccountLabel,
      narration: dto.narration?.trim() || undefined,
      status: 'active',
      participants,
    });

    const savedSplit = await this.splitsRepository.save(split);

    for (const participant of savedSplit.participants) {
      if (participant.email) {
        this.notificationsService.sendSplitCreatedEmail({
          toEmail: participant.email,
          participantName: participant.name,
          hostName: dto.hostName,
          splitTitle: dto.title,
          share: participant.share,
          splitId: savedSplit.id,
          participantId: participant.id,
        });
      }
      if (participant.phone) {
        this.notificationsService.sendSplitCreatedSMS({
          toPhone: participant.phone,
          hostName: dto.hostName,
          splitTitle: dto.title,
          share: participant.share,
          splitId: savedSplit.id,
          participantId: participant.id,
        });
        this.notificationsService.sendSplitCreatedWhatsApp({
          toPhone: participant.phone,
          hostName: dto.hostName,
          splitTitle: dto.title,
          share: participant.share,
          splitId: savedSplit.id,
          participantId: participant.id,
        });
      }
    }

    // Learn auto-split rule if narration present. Do not block on email failures.
    try {
      if (this.autosplitService) await this.autosplitService.learnFromSplit({
        accountNumber: dto.hostAccountNumber,
        narrationRaw: dto.narration,
        splitId: savedSplit.id,
        splitTitle: dto.title,
        splitType: dto.splitType,
        sourceAccountLabel: dto.sourceAccountLabel,
        totalAmount: dto.totalAmount,
        // Saved participants keep the request order and carry the share each one
        // actually owes, so a custom split can be replayed exactly later.
        participants: savedSplit.participants.map((p) => ({
          name: p.name,
          initials: p.initials,
          phone: p.phone,
          email: p.email || undefined,
          isGTUser: p.isGTUser,
          share: Number(p.share),
        })),
      });
    } catch (e) {
      console.error('Failed to learn auto-split rule:', e);
    }

    return savedSplit;
  }

  async findByHost(hostAccountNumber: string): Promise<Split[]> {
    return this.splitsRepository.find({
      where: { hostAccountNumber },
      relations: { participants: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByParticipantPhone(phone: string): Promise<Split[]> {
    const target = normalizePhone(phone);
    const allParticipants = await this.participantsRepository.find({
      relations: { split: { participants: true } },
    });
    const participants = allParticipants.filter((p) => normalizePhone(p.phone) === target);
    const splits = participants
      .map((p) => p.split)
      .filter((s): s is Split => !!s);
    return splits.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async findOne(id: string): Promise<Split> {
    const split = await this.splitsRepository.findOne({
      where: { id },
      relations: { participants: true },
    });
    if (!split) throw new NotFoundException('Split not found');
    return split;
  }

  async toggleParticipantStatus(splitId: string, participantId: string): Promise<Split> {
    const split = await this.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);
    if (!participant) throw new NotFoundException('Participant not found');

    participant.status = participant.status === 'paid' ? 'pending' : 'paid';
    await this.participantsRepository.save(participant);

    const allPaid = split.participants.every((p: Participant) => p.status === 'paid');
    split.status = allPaid ? 'settled' : 'active';
    await this.splitsRepository.save(split);

    return this.findOne(splitId);
  }

  async sendReminder(splitId: string, participantId: string, hostName: string): Promise<{ success: boolean }> {
    const split = await this.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);
    if (!participant) throw new NotFoundException('Participant not found');

    if (participant.email) {
      await this.notificationsService.sendReminderEmail({
        toEmail: participant.email,
        participantName: participant.name,
        hostName,
        splitTitle: split.title,
        share: participant.share,
        splitId: split.id,
        participantId: participant.id,
      });
    }
    if (participant.phone) {
      await this.notificationsService.sendReminderSMS({
        toPhone: participant.phone,
        hostName,
        splitTitle: split.title,
        share: participant.share,
        splitId: split.id,
        participantId: participant.id,
      });
      await this.notificationsService.sendReminderWhatsApp({
        toPhone: participant.phone,
        hostName,
        splitTitle: split.title,
        share: participant.share,
        splitId: split.id,
        participantId: participant.id,
      });
    }

    return { success: true };
  }
}