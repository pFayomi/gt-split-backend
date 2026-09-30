import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Split } from './split.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  initials: string;

  @Column()
  phone: string;

    @Column({ nullable: true })
  email: string;

  @Column({ default: false })
  isGTUser: boolean;

  @Column('decimal', { precision: 12, scale: 2 })
  share: number;

  @Column({ default: 'pending' })
  status: 'paid' | 'pending' | 'declined';

  @ManyToOne(() => Split, (split) => split.participants, { onDelete: 'CASCADE' })
  split: Split;
}