import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInboundModule1783772008187 implements MigrationInterface {
    name = 'AddInboundModule1783772008187'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`inbound_follow_ups\` (\`id\` int NOT NULL AUTO_INCREMENT, \`inbound_id\` int NOT NULL, \`follow_up_date\` date NULL, \`follow_up_time\` time NULL, \`contacted_via\` varchar(255) NULL, \`next_follow_up_date\` date NULL, \`next_follow_up_time\` time NULL, \`purpose\` varchar(255) NULL, \`priority\` varchar(255) NULL, \`rnr\` varchar(255) NULL, \`notes\` text NULL, \`created_by_id\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`inbounds\` (\`id\` int NOT NULL AUTO_INCREMENT, \`property_id\` varchar(255) NULL, \`property_category\` varchar(255) NULL, \`property_type\` varchar(255) NULL, \`purpose\` varchar(255) NULL, \`property_title\` varchar(255) NULL, \`state\` varchar(255) NULL, \`city\` varchar(255) NULL, \`area\` varchar(255) NULL, \`locality\` varchar(255) NULL, \`landmark\` varchar(255) NULL, \`google_map_location\` text NULL, \`status\` varchar(255) NOT NULL DEFAULT 'New Inbound', \`owner_name\` varchar(255) NULL, \`mobile_number\` varchar(255) NULL, \`whatsapp_number\` varchar(255) NULL, \`email\` varchar(255) NULL, \`address\` text NULL, \`preferred_contact_time\` varchar(255) NULL, \`alternate_contact\` varchar(255) NULL, \`pan_available\` tinyint NOT NULL DEFAULT 0, \`gst_applicable\` tinyint NOT NULL DEFAULT 0, \`primary_contact\` varchar(255) NULL, \`building_manager_name\` varchar(255) NULL, \`manager_mobile\` varchar(255) NULL, \`caretaker_name\` varchar(255) NULL, \`caretaker_mobile\` varchar(255) NULL, \`security_contact\` varchar(255) NULL, \`key_available_with\` varchar(255) NULL, \`prior_appointment_required\` tinyint NOT NULL DEFAULT 0, \`brokerage_accepted\` varchar(255) NULL, \`brokerage_paid_by\` text NULL, \`brokerage_type\` varchar(255) NULL, \`percentage\` decimal(5,2) NULL, \`fixed_amount\` decimal(12,2) NULL, \`rental_brokerage\` decimal(12,2) NULL, \`brokerage_remarks\` text NULL, \`image_url\` text NULL, \`video_url\` text NULL, \`documents_collected\` tinyint NOT NULL DEFAULT 0, \`is_exclusive\` tinyint NOT NULL DEFAULT 0, \`is_prime_location\` tinyint NOT NULL DEFAULT 0, \`listed_on\` text NULL, \`quality_score\` int NOT NULL DEFAULT '0', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_102a9f3672a22532a4ff372a34\` (\`property_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`inbound_contact_logs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`inbound_id\` int NOT NULL, \`contact_type\` varchar(255) NOT NULL, \`subject\` varchar(255) NULL, \`message\` text NULL, \`sent_by_id\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`inbound_follow_ups\` ADD CONSTRAINT \`FK_06a557e19ab0abca21a1fc32a38\` FOREIGN KEY (\`inbound_id\`) REFERENCES \`inbounds\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`inbound_follow_ups\` ADD CONSTRAINT \`FK_9ffe9bdf65c50e6d30efe9bacff\` FOREIGN KEY (\`created_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`inbound_contact_logs\` ADD CONSTRAINT \`FK_c8176da200a194bd47f7ae1cb11\` FOREIGN KEY (\`inbound_id\`) REFERENCES \`inbounds\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`inbound_contact_logs\` ADD CONSTRAINT \`FK_bfe9d542d28ecc17355965fadfd\` FOREIGN KEY (\`sent_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inbound_contact_logs\` DROP FOREIGN KEY \`FK_bfe9d542d28ecc17355965fadfd\``);
        await queryRunner.query(`ALTER TABLE \`inbound_contact_logs\` DROP FOREIGN KEY \`FK_c8176da200a194bd47f7ae1cb11\``);
        await queryRunner.query(`ALTER TABLE \`inbound_follow_ups\` DROP FOREIGN KEY \`FK_9ffe9bdf65c50e6d30efe9bacff\``);
        await queryRunner.query(`ALTER TABLE \`inbound_follow_ups\` DROP FOREIGN KEY \`FK_06a557e19ab0abca21a1fc32a38\``);
        await queryRunner.query(`DROP TABLE \`inbound_contact_logs\``);
        await queryRunner.query(`DROP INDEX \`IDX_102a9f3672a22532a4ff372a34\` ON \`inbounds\``);
        await queryRunner.query(`DROP TABLE \`inbounds\``);
        await queryRunner.query(`DROP TABLE \`inbound_follow_ups\``);
    }

}
