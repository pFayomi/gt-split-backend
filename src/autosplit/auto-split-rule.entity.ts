import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** The group is frozen exactly as it was when the rule was first learned. */
export type AutoSplitParticipant = {
  name: string;
  initials: string;
  phone: string;
  email?: string;
  isGTUser: boolean;
  /**
   * What this person owed the last time the bill was split. A proportion, not a
   * fixed amount: a later debit of a different size rescales it.
   */
  share?: number;
};

@Entity('auto_split_rules')
@Index(['accountNumber', 'narrationKey'], { unique: true })
export class AutoSplitRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The account that split the bill the first time, i.e. who owns the rule. */
  @Column()
  accountNumber: string;

  /** sha256 of the normalized narration: the exact-match lookup key. */
  @Column()
  narrationKey: string;

  /** Narration as the owner first typed it, kept verbatim for display. */
  @Column({ type: 'varchar' })
  narration: string;

  @Column()
  splitTitle: string;

  @Column()
  splitType: 'equal' | 'custom';

  /**
   * The bill total at the time the rule was learned. Kept so a custom split's
   * remembered shares can be rescaled when the next bill with the same narration
   * costs a different amount. Nullable so rules learned before this column
   * existed still load; those fall back to the total of their last split.
   */
  @Column('decimal', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
    },
  })
  totalAmount: number | null;

  @Column()
  sourceAccountLabel: string;

  @Column({ type: 'jsonb' })
  participants: AutoSplitParticipant[];

  @Column({ default: 'active' })
  status: 'active' | 'paused';

  /** The manual or auto split this rule was last refreshed from. */
  @Column({ type: 'uuid', nullable: true })
  lastSplitId: string | null;

  @Column({ default: 0 })
  occurrenceCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}