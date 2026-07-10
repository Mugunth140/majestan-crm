import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesAndDocuments1783698480701 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create lead_documents table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`lead_documents\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`lead_id\` int NOT NULL,
                \`file_name\` varchar(255) NOT NULL,
                \`file_url\` varchar(500) NOT NULL,
                \`file_key\` varchar(500) NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`FK_lead_document_lead\` (\`lead_id\`),
                CONSTRAINT \`FK_lead_document_lead\` FOREIGN KEY (\`lead_id\`) REFERENCES \`leads\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Add indexes to leads table
        await queryRunner.query(`CREATE INDEX \`IDX_leads_name\` ON \`leads\` (\`name\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_leads_email\` ON \`leads\` (\`email\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_leads_status\` ON \`leads\` (\`status\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_leads_assigned_staff_id\` ON \`leads\` (\`assigned_staff_id\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_leads_created_at\` ON \`leads\` (\`created_at\`);`);

        // Add indexes to agents table
        await queryRunner.query(`CREATE INDEX \`IDX_agents_name\` ON \`agents\` (\`name\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_company_name\` ON \`agents\` (\`company_name\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_email\` ON \`agents\` (\`email\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_partner_type\` ON \`agents\` (\`partner_type\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_status\` ON \`agents\` (\`status\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_assigned_staff_id\` ON \`agents\` (\`assigned_staff_id\`);`);
        await queryRunner.query(`CREATE INDEX \`IDX_agents_created_at\` ON \`agents\` (\`created_at\`);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes from agents table
        await queryRunner.query(`DROP INDEX \`IDX_agents_created_at\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_assigned_staff_id\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_status\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_partner_type\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_email\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_company_name\` ON \`agents\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_agents_name\` ON \`agents\`;`);

        // Drop indexes from leads table
        await queryRunner.query(`DROP INDEX \`IDX_leads_created_at\` ON \`leads\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_leads_assigned_staff_id\` ON \`leads\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_leads_status\` ON \`leads\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_leads_email\` ON \`leads\`;`);
        await queryRunner.query(`DROP INDEX \`IDX_leads_name\` ON \`leads\`;`);

        // Drop lead_documents table
        await queryRunner.query(`DROP TABLE \`lead_documents\`;`);
    }

}
