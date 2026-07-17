import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeadCommissionAndReferral1784290103522 implements MigrationInterface {
    name = 'AddLeadCommissionAndReferral1784290103522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leads\` ADD \`commission\` decimal(5,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`leads\` ADD \`is_referral\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`leads\` ADD \`referred_by_name\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`leads\` ADD \`referred_by_contact\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`leads\` DROP COLUMN \`referred_by_contact\``);
        await queryRunner.query(`ALTER TABLE \`leads\` DROP COLUMN \`referred_by_name\``);
        await queryRunner.query(`ALTER TABLE \`leads\` DROP COLUMN \`is_referral\``);
        await queryRunner.query(`ALTER TABLE \`leads\` DROP COLUMN \`commission\``);
    }

}
