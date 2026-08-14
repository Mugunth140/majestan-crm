import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity';
import { Department } from './department.entity';
import { TaskMetricTarget } from './task-metric-target.entity';
import { TaskMetricProgress } from './task-metric-progress.entity';
import { TaskActivityLog } from './task-activity-log.entity';
import { TaskReceipt } from './task-receipt.entity';

@Entity('task_templates')
export class TaskTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ name: 'department_id' })
  department_id: number;

  @Column({ name: 'assigned_to' })
  assigned_to: number;

  @Column({ name: 'created_by' })
  created_by: number;

  @Column({ type: 'char', length: 7 })
  month: string;

  @Column({ type: 'enum', enum: ['active', 'archived'], default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: Relation<User>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<User>;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Relation<Department>;

  @OneToMany(() => TaskMetricTarget, (t) => t.taskTemplate)
  metricTargets: Relation<TaskMetricTarget[]>;

  @OneToMany(() => TaskMetricProgress, (p) => p.taskTemplate)
  metricProgress: Relation<TaskMetricProgress[]>;

  @OneToMany(() => TaskActivityLog, (l) => l.taskTemplate)
  activityLogs: Relation<TaskActivityLog[]>;

  @OneToMany(() => TaskReceipt, (r) => r.taskTemplate)
  receipts: Relation<TaskReceipt[]>;
}
