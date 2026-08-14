import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { TaskTemplate } from './task-template.entity';

@Entity('task_metric_progress')
export class TaskMetricProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_template_id' })
  task_template_id: number;

  @Column({ name: 'metric_key', length: 50 })
  metric_key: string;

  @Column({ name: 'week_number', type: 'tinyint', unsigned: true })
  week_number: number;

  @Column({ type: 'char', length: 7 })
  month: string;

  @Column({ name: 'achieved_count', type: 'decimal', precision: 12, scale: 2, default: 0 })
  achieved_count: number;

  @Column({ type: 'enum', enum: ['auto', 'manual'] })
  source: string;

  @UpdateDateColumn({ name: 'last_updated_at' })
  last_updated_at: Date;

  @ManyToOne(() => TaskTemplate, (t) => t.metricProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_template_id' })
  taskTemplate: Relation<TaskTemplate>;
}
