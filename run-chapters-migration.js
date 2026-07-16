require('dotenv').config();
const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Bắt đầu chạy migration thêm bảng chapters...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrate-chapters.sql'), 'utf8');
    await db.query(sql);
    console.log('✅ Migration hoàn thành!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration thất bại:', err.message);
    process.exit(1);
  }
}

runMigration();
