import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterRentalBrokerageType1783937523685 implements MigrationInterface {
    name = 'AlterRentalBrokerageType1783937523685'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` MODIFY \`rental_brokerage\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbounds\` MODIFY \`rental_brokerage\` decimal(12,2) NULL`);
    }

}
