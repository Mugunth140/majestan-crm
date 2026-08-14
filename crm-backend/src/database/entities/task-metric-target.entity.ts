import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { TaskTemplate } from './task-template.entity';

@Entity('task_metric_targets')
export class TaskMetricTarget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_template_id' })
  task_template_id: number;

  @Column({ name: 'metric_key', length: 50 })
  metric_key: string;

  @Column({ name: 'metric_label', length: 100 })
  metric_label: string;

  @Column({ name: 'metric_value_type', type: 'enum', enum: ['count', 'amount'], default: 'count' })
  metric_value_type: string;

  @Column({ name: 'monthly_target', type: 'decimal', precision: 12, scale: 2 })
  monthly_target: number;

  @Column({ name: 'week1_target', type: 'decimal', precision: 12, scale: 2 })
  week1_target: number;

  @Column({ name: 'week2_target', type: 'decimal', precision: 12, scale: 2 })
  week2_target: number;

  @Column({ name: 'week3_target', type: 'decimal', precision: 12, scale: 2 })
  week3_target: number;

  @Column({ name: 'week4_target', type: 'decimal', precision: 12, scale: 2 })
  week4_target: number;

  @Column({ name: 'week5_target', type: 'decimal', precision: 12, scale: 2, default: 0 })
  week5_target: number;

  @Column({ name: 'tracking_type', type: 'enum', enum: ['auto', 'manual'] })
  tracking_type: string;

  @Column({ name: 'carry_forward_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  carry_forward_amount: number;

  @ManyToOne(() => TaskTemplate, (t) => t.metricTargets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_template_id' })
  taskTemplate: Relation<TaskTemplate>;
}
