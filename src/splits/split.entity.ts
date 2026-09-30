import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Participant } from './participant.entity';

@Entity('splits')
export class Split {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column()
  hostAccountNumber: string;

  @Column()
  splitType: 'equal' | 'custom';

  @Column()
  sourceAccountLabel: string;

  @Column({ default: 'active' })
  status: 'active' | 'settled' | 'cancelled';

  @OneToMany(() => Participant, (participant) => participant.split, { cascade: true })
  participants: Participant[];

  @CreateDateColumn()
  createdAt: Date;
}