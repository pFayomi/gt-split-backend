import { forwardRef, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoSplitRule, AutoSplitParticipant } from './auto-split-rule.entity';
import { AutoSplitProposal } from './auto-split-proposal.entity';
import { narrationKey, normalizeNarration, generateToken, hashToken } from './narration';
import { SplitsService } from '../splits/splits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

type LearnSplitParams = {
  accountNumber: string;
  narrationRaw?: string | null;
  splitId: string;
  splitTitle: string;
  splitType: 'equal' | 'custom';
  sourceAccountLabel: string;
  /** Bill total of the split being learned; a later debit must match it to trigger the rule. */
  totalAmount?: number;
  participants: {
    name: string;
    initials: string;
    phone: string;
    email?: string;
    isGTUser: boolean;
    /** What this person owes in the split being learned. */
    share?: number;
  }[];
};

type RuleSnapshot = {
  totalAmount: number;
  participants: (AutoSplitParticipant & { share: number })[];
};

/** Money is rounded to the kobo so shares never carry float noise into the emails. */
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * The shares to propose for a NEW debit total, keeping the split method of the
 * rule. The narration is the trigger, so the amount can be anything, and the
 * remembered shares are only proportions to reuse, never amounts to copy:
 *
 * - equal  -> everyone owes the same share, using the exact formula
 *   createSplit applies (host included in the divisor, host absorbs the rounding).
 * - custom -> the remembered shares are rescaled to the new total, and the
 *   rounding remainder lands on the biggest share so the split sums exactly.
 *
 * Guards come first: a group of zero can never be sent to anyone, and a total of
 * zero cannot be rescaled from, so both fall back to treating it as an equal split.
 */
export function sharesForTotal(
  participants: AutoSplitParticipant[],
  splitType: 'equal' | 'custom',
  newTotal: number,
  rememberedTotal: number,
): number[] {
  const total = round2(newTotal);
  const n = participants.length;
  if (n === 0) return [];

  if (splitType !== 'custom' || !(rememberedTotal > 0)) {
    return participants.map(() => round2(total / (n + 1))); // +1 for the host, same as createSplit
  }

  const remembered = participants.map((p) => Number(p.share) || 0);
  const scaled = remembered.map((share) => round2((share / rememberedTotal) * total));
  const assigned = round2(scaled.reduce((sum, share) => sum + share, 0));
  const drift = round2(total - assigned);
  if (drift !== 0) {
    let biggest = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i] > scaled[biggest]) biggest = i;
    }
    scaled[biggest] = round2(scaled[biggest] + drift);
  }
  return scaled;
}

type EvaluateDebitParams = {
  accountNumber: string;
  narrationRaw?: string | null;
  amount: number;
  transactionId: string;
};

@Injectable()
export class AutosplitService {
  private readonly logger = new Logger(AutosplitService.name);

  constructor(
    @InjectRepository(AutoSplitRule)
    private rulesRepo: Repository<AutoSplitRule>,
    @InjectRepository(AutoSplitProposal)
    private proposalsRepo: Repository<AutoSplitProposal>,
    @Inject(forwardRef(() => SplitsService))
    private splitsService: SplitsService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  /** Learn a rule the first time the user creates a split for a narration. */
  async learnFromSplit(params: LearnSplitParams): Promise<AutoSplitRule> {
    const normNarr = normalizeNarration(params.narrationRaw);
    if (!normNarr) {
      return null as any;
    }

    const key = narrationKey(normNarr);
    const existing = await this.rulesRepo.findOne({
      where: { accountNumber: params.accountNumber, narrationKey: key },
    });
    if (existing) {
      existing.lastSplitId = params.splitId;
      existing.occurrenceCount = (existing.occurrenceCount || 0) + 1;
      existing.splitTitle = params.splitTitle;
      existing.participants = params.participants.map((p) => ({ ...p, email: p.email || undefined }));
      existing.splitType = params.splitType;
      if (params.totalAmount !== undefined) existing.totalAmount = Number(params.totalAmount);
      existing.sourceAccountLabel = params.sourceAccountLabel;
      await this.rulesRepo.save(existing);
      return existing;
    }

    const rule = this.rulesRepo.create({
      accountNumber: params.accountNumber,
      narrationKey: key,
      narration: params.narrationRaw?.trim() || normNarr,
      splitTitle: params.splitTitle,
      splitType: params.splitType,
      sourceAccountLabel: params.sourceAccountLabel,
      participants: params.participants.map((p) => ({ ...p, email: p.email || undefined })),
      totalAmount: params.totalAmount !== undefined ? Number(params.totalAmount) : null,
      lastSplitId: params.splitId,
      occurrenceCount: 1,
    });
    return this.rulesRepo.save(rule);
  }

  /**
   * The bill total and per-person shares the rule remembers. Rules learned
   * before amounts/shares were stored are rebuilt from the split they last
   * learned from, so they keep working instead of silently never matching.
   */
  private async resolveSnapshot(rule: AutoSplitRule): Promise<RuleSnapshot | null> {
    const haveShares =
      rule.participants.length > 0 && rule.participants.every((p) => typeof p.share === 'number');
    if (rule.totalAmount !== null && rule.totalAmount !== undefined && haveShares) {
      return {
        totalAmount: Number(rule.totalAmount),
        participants: rule.participants.map((p) => ({ ...p, share: Number(p.share) })),
      };
    }

    if (!rule.lastSplitId) return null;
    try {
      const split = await this.splitsService.findOne(rule.lastSplitId);
      return {
        totalAmount: Number(split.totalAmount),
        participants: split.participants.map((p) => ({
          name: p.name,
          initials: p.initials,
          phone: p.phone,
          email: p.email || undefined,
          isGTUser: p.isGTUser,
          share: Number(p.share),
        })),
      };
    } catch (e) {
      this.logger.warn(`Auto-split rule ${rule.id}: could not rebuild it from its last split (${(e as Error).message})`);
      return null;
    }
  }

  /**
   * When a debit hits carrying a narration this account has split before, email
   * the account holder asking "auto split with the same people?". The narration
   * is the trigger word and nothing else is: a bill's total changes over time
   * (Netflix was split at 4,000 and again at 100,000), and requiring the amount
   * to match too meant a rule learned on one bill never fired on the next. The
   * remembered split supplies the people and the split method; the shares are
   * recomputed for whatever this debit actually cost. Yes replays that split
   * exactly; No leaves everything alone. One proposal per debit transaction, so
   * retries never double-mail.
   */
  async evaluateForDebit(params: EvaluateDebitParams): Promise<{ proposed: boolean } | null> {
    const normNarr = normalizeNarration(params.narrationRaw);
    if (!normNarr) {
      return null;
    }

    const key = narrationKey(normNarr);
    const rule = await this.rulesRepo.findOne({
      where: { accountNumber: params.accountNumber, narrationKey: key, status: 'active' },
    });
    if (!rule) {
      return null;
    }

    // Avoid proposing for the same transaction twice.
    const already = await this.proposalsRepo.findOne({
      where: { transactionId: params.transactionId, accountNumber: params.accountNumber },
    });
    if (already) {
      return { proposed: already.status === 'pending' };
    }

    const snapshot = await this.resolveSnapshot(rule);
    if (!snapshot) {
      return null;
    }
    if (snapshot.participants.length === 0) {
      this.logger.warn(
        `Auto-split: rule ${rule.id} for narration "${rule.narration}" remembers nobody to split with; not proposing.`,
      );
      return null;
    }

    // The proposal goes to the account holder's own email. Without one there is
    // nobody to ask, so don't leave a dead pending proposal behind.
    const user = await this.usersService.findByAccountNumber(params.accountNumber);
    if (!user?.email) {
      this.logger.warn(
        `Auto-split: account ${params.accountNumber} matched a saved split but has no email on file, so no proposal was sent. Set one with POST /auth/update-email.`,
      );
      return { proposed: false };
    }

    const shares = sharesForTotal(snapshot.participants, rule.splitType, params.amount, snapshot.totalAmount);
    const participants = snapshot.participants.map((p, i) => ({ ...p, share: shares[i] }));

    const rawToken = generateToken();
    const proposal = this.proposalsRepo.create({
      accountNumber: params.accountNumber,
      narrationKey: key,
      narration: rule.narration,
      splitTitle: rule.splitTitle,
      totalAmount: params.amount,
      // Same method as last time. The shares below are what each person owes for
      // THIS debit, not what they owed last time.
      splitType: rule.splitType,
      sourceAccountLabel: rule.sourceAccountLabel,
      participants,
      ruleId: rule.id,
      sourceSplitId: rule.lastSplitId,
      tokenHash: hashToken(rawToken),
      transactionId: params.transactionId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
      status: 'pending',
    });
    const saved = await this.proposalsRepo.save(proposal);

    // Same public base URL the split-request emails use for their pay links.
    const baseUrl = (this.configService.get<string>('PUBLIC_BASE_URL') ?? this.configService.get<string>('RENDER_EXTERNAL_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    const result = await this.notificationsService.sendAutoSplitProposalEmail({
      toEmail: user.email,
      accountFullName: user.fullName,
      splitTitle: saved.splitTitle,
      narration: saved.narration,
      totalAmount: saved.totalAmount,
      previousTotal: snapshot.totalAmount,
      participantCount: saved.participants.length,
      participants: saved.participants.map((p) => ({ name: p.name, share: p.share })),
      yesLink: `${baseUrl}/auto-split/${saved.id}/yes/${rawToken}`,
      noLink: `${baseUrl}/auto-split/${saved.id}/no/${rawToken}`,
      expiresAt: saved.expiresAt,
    });

    if (!result?.success) {
      this.logger.error(`Auto-split: proposal ${saved.id} was created but the email to ${user.email} failed to send.`);
      return { proposed: false };
    }
    return { proposed: true };
  }

  async approve(proposalId: string, token: string): Promise<{ splitId: string }> {
    const proposal = await this.proposalsRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') throw new UnauthorizedException('Proposal not pending');
    if (proposal.expiresAt < new Date()) {
      proposal.status = 'expired';
      await this.proposalsRepo.save(proposal);
      throw new UnauthorizedException('Proposal expired');
    }
    if (hashToken(token) !== proposal.tokenHash) {
      throw new UnauthorizedException('Invalid token');
    }

    // Create the split. The participants in the proposal already include share.
    const host = await this.usersService.findByAccountNumber(proposal.accountNumber);
    const split = await this.splitsService.createSplit({
      title: proposal.splitTitle,
      totalAmount: Number(proposal.totalAmount),
      hostAccountNumber: proposal.accountNumber,
      hostName: host?.fullName ?? proposal.accountNumber,
      splitType: proposal.splitType,
      sourceAccountLabel: proposal.sourceAccountLabel,
      // Keeping the narration lets createSplit refresh the rule from this split
      // (last split id, occurrence count) exactly like a manual split does.
      narration: proposal.narration,
      participants: proposal.participants.map((p) => ({
        name: p.name,
        initials: p.initials,
        phone: p.phone,
        email: p.email,
        isGTUser: p.isGTUser,
        customShare: p.share, // use the exact share computed at proposal time
      })),
    });

    proposal.status = 'approved';
    proposal.createdSplitId = split.id;
    proposal.respondedAt = new Date();
    proposal.consumedAt = new Date();
    await this.proposalsRepo.save(proposal);

    // createSplit already refreshed lastSplitId/occurrenceCount via learnFromSplit.
    await this.rulesRepo.update({ id: proposal.ruleId }, {
      lastSplitId: split.id,
      lastTriggeredAt: new Date(),
    });

    return { splitId: split.id };
  }

  async decline(proposalId: string, token: string): Promise<{ ok: true }> {
    const proposal = await this.proposalsRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') throw new UnauthorizedException('Proposal not pending');
    if (proposal.expiresAt < new Date()) {
      proposal.status = 'expired';
      await this.proposalsRepo.save(proposal);
      throw new UnauthorizedException('Proposal expired');
    }
    if (hashToken(token) !== proposal.tokenHash) {
      throw new UnauthorizedException('Invalid token');
    }

    proposal.status = 'declined';
    proposal.respondedAt = new Date();
    await this.proposalsRepo.save(proposal);
    return { ok: true };
  }
}