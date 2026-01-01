// import { drizzle } from 'drizzle-orm/neon-http';
// import { neon } from '@neondatabase/serverless';
// import * as schema from '../shared/schema';


// if (!process.env.DATABASE_URL) {
//   throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
// }

// const sql = neon(process.env.DATABASE_URL);
// export const db = drizzle(sql, { schema });
// db/index.ts
// db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';

// NÃO verificar DATABASE_URL aqui - será verificado quando usado
// Isso permite que o dotenv carregue primeiro

// Função para obter a DATABASE_URL
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('❌ DATABASE_URL não está definida no arquivo .env');
  }
  return url;
}

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Eventos de monitoramento do pool
pool.on('connect', () => {
  console.log('✅ Nova conexão estabelecida com PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no PostgreSQL:', err);
  process.exit(-1);
});

// Criar instância do Drizzle ORM com o schema
export const db = drizzle(pool, { schema });

// Função para testar a conexão
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, current_database() as database, version() as version');
    console.log('🔗 Conexão PostgreSQL bem-sucedida!');
    console.log(`   📅 Hora do servidor: ${result.rows[0].now}`);
    console.log(`   🗄️  Database: ${result.rows[0].database}`);
    console.log(`   📌 Versão: ${result.rows[0].version.split(',')[0]}`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com PostgreSQL:');
    console.error('   Erro:', error instanceof Error ? error.message : error);
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      // Oculta a senha no log
      console.error('   DATABASE_URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
    } else {
      console.error('   DATABASE_URL: não definida!');
    }
    return false;
  }
}

// Função para fechar todas as conexões (útil para shutdown gracioso)
export async function closeDatabase() {
  try {
    await pool.end();
    console.log('🔌 Todas as conexões PostgreSQL foram fechadas');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões:', error);
  }
}

// Exportar pool caso precise de acesso direto
export { pool };

export default db;