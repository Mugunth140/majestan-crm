import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { TaskTemplate } from './task-template.entity';
import { User } from './user.entity';

@Entity('task_activity_logs')
export class TaskActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_template_id' })
  task_template_id: number;

  @Column({ name: 'metric_key', length: 50 })
  metric_key: string;

  @Column({ name: 'logged_by' })
  logged_by: number;

  @Column({ name: 'count_value', type: 'decimal', precision: 12, scale: 2 })
  count_value: number;

  @Column({ name: 'logged_date', type: 'date' })
  logged_date: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => TaskTemplate, (t) => t.activityLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_template_id' })
  taskTemplate: Relation<TaskTemplate>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'logged_by' })
  loggedBy: Relation<User>;
}
