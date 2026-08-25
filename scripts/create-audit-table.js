const { sequelize } = require("../src/database");

const sql = `
CREATE TABLE IF NOT EXISTS "AuditLogs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "username" VARCHAR(255),
  "role" VARCHAR(50),
  "action" VARCHAR(255) NOT NULL,
  "entity_type" VARCHAR(255),
  "entity_id" VARCHAR(255),
  "status" VARCHAR(50) DEFAULT 'success',
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON "AuditLogs"(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON "AuditLogs"(createdAt DESC);
`;

async function createAuditTable() {
  try {
    console.log("Criando tabela AuditLogs...");
    await sequelize.query(sql);
    console.log("✅ Tabela AuditLogs criada com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err.message);
    process.exit(1);
  }
}

createAuditTable();
