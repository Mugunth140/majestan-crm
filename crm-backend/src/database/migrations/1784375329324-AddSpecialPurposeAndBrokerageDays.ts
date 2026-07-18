import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpecialPurposeAndBrokerageDays1784375329324 implements MigrationInterface {
    name = 'AddSpecialPurposeAndBrokerageDays1784375329324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`special_purpose\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`brokerage_days\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`brokerage_days\``);
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`special_purpose\``);
    }

}
