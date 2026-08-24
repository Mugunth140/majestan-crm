import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingIndexes1787577159739 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IDX_lead_follow_ups_lead_id ON lead_follow_ups(lead_id)`);
        await queryRunner.query(`CREATE INDEX IDX_contact_logs_lead_id ON contact_logs(lead_id)`);
        await queryRunner.query(`CREATE INDEX IDX_agent_follow_ups_agent_id ON agent_follow_ups(agent_id)`);
        await queryRunner.query(`CREATE INDEX IDX_task_metric_progress_template_id ON task_metric_progress(task_template_id)`);
        await queryRunner.query(`CREATE INDEX IDX_asset_documents_asset_id ON asset_documents(asset_id)`);
        await queryRunner.query(`CREATE INDEX IDX_routing_history_lead_id ON routing_history(lead_id)`);
        await queryRunner.query(`CREATE INDEX IDX_hr_follow_ups_candidate_id ON hr_follow_ups(hr_candidate_id)`);
        await queryRunner.query(`CREATE INDEX IDX_inbound_follow_ups_inbound_id ON inbound_follow_ups(inbound_id)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IDX_lead_follow_ups_lead_id ON lead_follow_ups`);
        await queryRunner.query(`DROP INDEX IDX_contact_logs_lead_id ON contact_logs`);
        await queryRunner.query(`DROP INDEX IDX_agent_follow_ups_agent_id ON agent_follow_ups`);
        await queryRunner.query(`DROP INDEX IDX_task_metric_progress_template_id ON task_metric_progress`);
        await queryRunner.query(`DROP INDEX IDX_asset_documents_asset_id ON asset_documents`);
        await queryRunner.query(`DROP INDEX IDX_routing_history_lead_id ON routing_history`);
        await queryRunner.query(`DROP INDEX IDX_hr_follow_ups_candidate_id ON hr_follow_ups`);
        await queryRunner.query(`DROP INDEX IDX_inbound_follow_ups_inbound_id ON inbound_follow_ups`);
    }
}
