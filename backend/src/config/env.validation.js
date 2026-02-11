const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

const optionalEnvVars = {
  NODE_ENV: 'development',
  PORT: '5000',
  FRONTEND_URL: 'http://localhost:3000',
};

const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }

  // Set defaults for optional variables
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      warnings.push(`${varName} (using default: ${defaultValue})`);
    }
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    console.warn(`⚠️  Warning: NODE_ENV should be one of: ${validEnvs.join(', ')}`);
  }

  // Log warnings if any
  if (warnings.length > 0) {
    console.log('ℹ️  Using default values for:');
    warnings.forEach((warning) => {
      console.log(`   - ${warning}`);
    });
  }

  console.log('✅ Environment variables validated successfully\n');
};

module.exports = { validateEnv };
