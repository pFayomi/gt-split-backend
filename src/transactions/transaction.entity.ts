import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountNumber: string;

  @Column()
  kind: 'transfer' | 'charge' | 'airtime' | 'billsplit' | 'savings';

  @Column()
  title: string;

  @Column()
  subtitle: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column()
  direction: 'in' | 'out';

  @Column({ nullable: true })
  splitId: string;

  @CreateDateColumn()
  createdAt: Date;
}