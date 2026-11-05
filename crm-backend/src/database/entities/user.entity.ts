// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';
import { Department } from './department.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  whatsapp_no: string;

  @Column({ type: 'date', nullable: true })
  dob: string;

  @Column({ nullable: true })
  aadhaar_no: string;

  @Column({ nullable: true })
  bank_account_no: string;

  @Column({ type: 'date', nullable: true })
  join_date: string;

  @Column({ nullable: true })
  qualification: string;

  /** Profile photo on the public CDN; null shows initials. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string | null;

  /** Sidebar modules this user sees; null means the defaults for their role and department. */
  @Column({ type: 'json', nullable: true })
  nav_access: string[] | null;

  @Column({ name: 'role_id' })
  role_id: number;

  @Column({ name: 'department_id', nullable: true })
  department_id: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  device_last_sync_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  /**
   * What a user looks like inside any other record (a lead's assignee, who
   * logged a follow-up…): enough to show and link them, never the password
   * hash or personal details like Aadhaar, bank account, phone or address.
   * The admin Users screens ask for more through `fullUser`.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role_id: this.role_id,
      department_id: this.department_id,
      is_active: this.is_active,
      avatar_url: this.avatar_url ?? null,
      role: this.role,
      department: this.department,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

/** Every column except the password hash, for the admin Users screens. */
export function fullUser(user: User) {
  const { password_hash: _hash, ...rest } = user;
  return rest;
}

