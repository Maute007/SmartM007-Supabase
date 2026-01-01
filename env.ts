// env.ts - Carrega as variáveis de ambiente o mais cedo possível
import { config } from 'dotenv';
import path from 'path';

// Carregar .env do diretório raiz
const result = config({ path: path.resolve(process.cwd(), '.env') });

if (result.error) {
  console.warn('⚠️  Aviso: Arquivo .env não encontrado ou erro ao carregar');
  console.warn('   Caminho procurado:', path.resolve(process.cwd(), '.env'));
} else {
  console.log('✅ Variáveis de ambiente carregadas do .env');
}

// Validar variáveis essenciais
const requiredEnvVars = ['DATABASE_URL'];
const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ ERRO: Variáveis de ambiente obrigatórias não definidas:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('\n💡 Certifique-se de que o arquivo .env existe e contém essas variáveis\n');
  process.exit(1);
}

export {};