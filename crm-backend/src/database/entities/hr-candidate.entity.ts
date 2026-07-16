import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column() department: string;
  @Column() position: string;
  @Column({ nullable: true }) experience: string;
  @Column({ nullable: true }) currentSalary: string;
  @Column({ nullable: true }) expectedSalary: string;
  @Column({ nullable: true }) noticePeriod: string;

  @Column({ nullable: true }) recruitmentSource: string;
  
  @Column({ type: 'date', nullable: true }) interviewDate: Date;
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

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
