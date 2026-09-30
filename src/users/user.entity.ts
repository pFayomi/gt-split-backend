import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  accountNumber: string;

  @Column()
  fullName: string;

  @Column()
  pinHash: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;
}