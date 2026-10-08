import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('room_dimensions')
export class RoomDimension {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'length_ft', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthFt!: number | null;

  @Column({ name: 'width_ft', type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthFt!: number | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
