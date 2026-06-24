import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const ds = new DataSource({
  type: 'mysql',
  host: '127.0.0.1', // I will run this inside the container or expose port
  port: 3307, // exposed port
  username: 'root',
  password: '8220',
  database: 'majestan_crm',
});

async function run() {
  await ds.initialize();
  await ds.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role_id INT NOT NULL,
      department_id INT,
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
  `);

  const roles = ['Admin', 'Manager', 'Team Lead', 'Staff'];
  for (const r of roles) {
    await ds.query('INSERT IGNORE INTO roles (name, description) VALUES (?, ?)', [r, r + ' Role']);
  }

  const [adminRole] = await ds.query('SELECT id FROM roles WHERE name = ?', ['Admin']);
  if (adminRole) {
    const hash = await bcrypt.hash('Prismark@2026', 10);
    await ds.query('INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', [
      'Super Admin', 'admin@majestanrealty.com', hash, adminRole.id
    ]);
    console.log('Seeded Admin!');
  }
  await ds.destroy();
}
run().catch(console.error);
