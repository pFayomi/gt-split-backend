import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('savings_contributions')
export class SavingsContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountNumber: string;

  @Column()
  contributorName: string;

  @Column()
  splitId: string;

  @Column()
  splitTitle: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}