import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { TaskTemplate } from './task-template.entity';
import { User } from './user.entity';

@Entity('task_receipts')
export class TaskReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_template_id' })
  task_template_id: number;

  @Column({ name: 'uploaded_by' })
  uploaded_by: number;

  @Column({ name: 'file_name', type: 'varchar', length: 500 })
  file_name: string;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  file_url: string;

  @Column({ name: 'file_key', type: 'varchar', length: 500 })
  file_key: string;

  @Column({ name: 'upload_date', type: 'date' })
  upload_date: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => TaskTemplate, (t) => t.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_template_id' })
  taskTemplate: Relation<TaskTemplate>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: Relation<User>;
}
