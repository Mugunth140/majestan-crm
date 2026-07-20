import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHrModule1784541283071 implements MigrationInterface {
    name = 'AddHrModule1784541283071'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`hr_candidates\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`mobile\` varchar(255) NOT NULL, \`whatsapp\` varchar(255) NULL, \`email\` varchar(255) NULL, \`city\` varchar(255) NULL, \`state\` varchar(255) NULL, \`department\` varchar(255) NOT NULL, \`position\` varchar(255) NOT NULL, \`experience\` varchar(255) NULL, \`currentSalary\` varchar(255) NULL, \`expectedSalary\` varchar(255) NULL, \`noticePeriod\` varchar(255) NULL, \`recruitmentSource\` varchar(255) NULL, \`interviewDate\` date NULL, \`interviewer\` varchar(255) NULL, \`interviewRound\` varchar(255) NULL, \`interviewFeedback\` text NULL, \`status\` enum ('New Application', 'Resume Shortlisted', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Offer Sent', 'Joined', 'Rejected', 'Hold') NOT NULL DEFAULT 'New Application', \`resumeUrl\` varchar(255) NULL, \`aadhaarUrl\` varchar(255) NULL, \`panUrl\` varchar(255) NULL, \`educationCertUrl\` varchar(255) NULL, \`experienceCertUrl\` varchar(255) NULL, \`photoUrl\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`hr_follow_ups\` (\`id\` int NOT NULL AUTO_INCREMENT, \`hr_candidate_id\` int NOT NULL, \`follow_up_date\` date NULL, \`follow_up_time\` time NULL, \`contacted_via\` varchar(255) NULL, \`next_follow_up_date\` date NULL, \`next_follow_up_time\` time NULL, \`priority\` varchar(255) NULL, \`rnr\` varchar(255) NULL, \`notes\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`hr_follow_ups\` ADD CONSTRAINT \`FK_91d45c4c4b94f12f2c7f2a7a3ec\` FOREIGN KEY (\`hr_candidate_id\`) REFERENCES \`hr_candidates\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`hr_follow_ups\` DROP FOREIGN KEY \`FK_91d45c4c4b94f12f2c7f2a7a3ec\``);
        await queryRunner.query(`DROP TABLE \`hr_follow_ups\``);
        await queryRunner.query(`DROP TABLE \`hr_candidates\``);
    }

}
