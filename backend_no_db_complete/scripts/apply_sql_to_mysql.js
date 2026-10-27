const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'angel_guardian_init.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Arquivo SQL não encontrado:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  try {
    console.log(
      'Aplicando SQL em',
      `${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`
    );
    const [results] = await conn.query(sql);
    console.log('SQL aplicado com sucesso.');
  } catch (err) {
    console.error('Erro ao aplicar SQL:', err.message || err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
