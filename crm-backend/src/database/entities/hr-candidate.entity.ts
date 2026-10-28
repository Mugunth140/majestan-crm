// fallow-ignore-file circular-dependencies
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HrFollowUp } from './hr-follow-up.entity';

export enum HrCandidateStatus {
  NEW_APPLICATION = 'New Application',
  RESUME_SHORTLISTED = 'Resume Shortlisted',
  INTERVIEW_SCHEDULED = 'Interview Scheduled',
  INTERVIEW_COMPLETED = 'Interview Completed',
  SELECTED = 'Selected',
  OFFER_SENT = 'Offer Sent',
  JOINED = 'Joined',
  REJECTED = 'Rejected',
  HOLD = 'Hold'
}

@Entity('hr_candidates')
export class HrCandidate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column() name: string;
  @Column() mobile: string;
  @Column({ nullable: true }) whatsapp: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) state: string;
  @Column({ type: 'int', nullable: true }) cityId: number | null;

  @Column() department: string;
  @Column() position: string;
  @Column({ nullable: true }) experience: string;
  @Column({ nullable: true }) currentSalary: string;
  @Column({ nullable: true }) expectedSalary: string;
  @Column({ nullable: true }) noticePeriod: string;

  @Column({ nullable: true }) recruitmentSource: string;
  @Column({ type: 'int', nullable: true }) leadSourceId: number | null;
  @Column({ type: 'int', nullable: true }) hrSourceId: number | null;
  @Column({ type: 'int', nullable: true }) assignedStaffId: number | null;
  
  @Column({ type: 'date', nullable: true }) interviewDate: Date;
  // Local (IST) wall-clock time, 'HH:mm:ss'. Paired with interviewDate; no TZ conversion.
  @Column({ type: 'time', nullable: true }) interviewTime: string | null;
  @Column({ type: 'enum', enum: ['in_person', 'phone', 'video'], nullable: true }) interviewMode: 'in_person' | 'phone' | 'video' | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) interviewLocation: string | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) interviewLink: string | null;
  @Column({ nullable: true }) interviewer: string;
  @Column({ nullable: true }) interviewRound: string;
  @Column({ type: 'text', nullable: true }) interviewFeedback: string;

  @Column({
    type: 'enum',
    enum: HrCandidateStatus,
    default: HrCandidateStatus.NEW_APPLICATION
  })
  status: HrCandidateStatus;

  @Column({ nullable: true }) resumeUrl: string;
  @Column({ nullable: true }) aadhaarUrl: string;
  @Column({ nullable: true }) panUrl: string;
  @Column({ nullable: true }) educationCertUrl: string;
  @Column({ nullable: true }) experienceCertUrl: string;
  @Column({ nullable: true }) photoUrl: string;

  assignedStaff?: { id: number; name: string } | null;

  // follow_ups mapped manually
  

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
