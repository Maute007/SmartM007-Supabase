/**
 * Fix: Adiciona colunas ausentes (barcode, audit_logs).
 * Execute: npm run db:fix-barcode
 */
import 'dotenv/config';
import pg from 'pg';

const fixes = [
  {
    table: 'products',
    column: 'barcode',
    sql: 'ALTER TABLE products ADD COLUMN barcode text',
  },
  {
    table: 'audit_logs',
    column: 'previous_snapshot',
    sql: 'ALTER TABLE audit_logs ADD COLUMN previous_snapshot jsonb',
  },
  {
    table: 'audit_logs',
    column: 'ip_address',
    sql: 'ALTER TABLE audit_logs ADD COLUMN ip_address text',
  },
  {
    table: 'audit_logs',
    column: 'user_agent',
    sql: 'ALTER TABLE audit_logs ADD COLUMN user_agent text',
  },
  {
    table: 'audit_logs',
    column: 'risk_flags',
    sql: 'ALTER TABLE audit_logs ADD COLUMN risk_flags text[]',
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    for (const { table, column, sql } of fixes) {
      const r = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column]
      );
      if (r.rows.length === 0) {
        await client.query(sql);
        console.log(`✓ ${table}.${column} adicionada.`);
      }
    }
    console.log('✓ Verificação concluída.');
  } catch (e) {
    console.error('Erro:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
