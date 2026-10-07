import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type AutoSplitProposalParticipant = {
  name: string;
  initials: string;
  phone: string;
  email?: string;
  isGTUser: boolean;
  share: number;
};

export type AutoSplitProposalStatus = 'pending' | 'approved' | 'declined' | 'expired' | 'consumed';

@Entity('auto_split_proposals')
@Index(['status', 'expiresAt'])
export class AutoSplitProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountNumber: string;

  @Column()
  narrationKey: string;

  @Column({ type: 'varchar' })
  narration: string;

  @Column()
  splitTitle: string;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column()
  splitType: 'equal' | 'custom';

  @Column()
  sourceAccountLabel: string;

  @Column({ type: 'jsonb' })
  participants: AutoSplitProposalParticipant[];

  /** The rule this proposal is based on. */
  @Column({ type: 'uuid' })
  ruleId: string;

  /** The split that was last created from this rule. */
  @Column({ type: 'uuid', nullable: true })
  sourceSplitId: string | null;

  /** The split created if approved. */
  @Column({ type: 'uuid', nullable: true })
  createdSplitId: string | null;

  @Column({ default: 'pending' })
  status: AutoSplitProposalStatus;

  /** sha256 of the raw token, never the raw token. */
  @Column()
  tokenHash: string;

  /** Uniquely identifies the debit transaction that triggered this proposal. */
  @Column({ type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}