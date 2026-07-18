import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBudgetAndFloorToInbound1784377240643 implements MigrationInterface {
    name = 'AddBudgetAndFloorToInbound1784377240643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`budget_details\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`inbounds\` ADD \`floor_number\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`floor_number\``);
        await queryRunner.query(`ALTER TABLE \`inbounds\` DROP COLUMN \`budget_details\``);
    }

}
