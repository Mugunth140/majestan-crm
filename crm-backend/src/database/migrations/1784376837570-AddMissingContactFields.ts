import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingContactFields1784376837570 implements MigrationInterface {
    name = 'AddMissingContactFields1784376837570'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`security_name\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`broker_name\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`broker_mobile\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`broker_mobile\``);
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`broker_name\``);
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`security_name\``);
    }

}
