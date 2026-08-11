import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDeviceLastSyncAtToUsers1786440158414 implements MigrationInterface {
    name = 'AddDeviceLastSyncAtToUsers1786440158414';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("users");
        if (table && !table.findColumnByName("device_last_sync_at")) {
            await queryRunner.addColumn(
                "users",
                new TableColumn({
                    name: "device_last_sync_at",
                    type: "timestamp",
                    isNullable: true,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("users");
        if (table && table.findColumnByName("device_last_sync_at")) {
            await queryRunner.dropColumn("users", "device_last_sync_at");
        }
    }
}
