/**
 * run-migration.js
 * Chạy migration thêm bảng Assessment vào database
 * Dùng cùng config db.js của app (đọc từ .env)
 * 
 * Cách chạy: node run-migration.js
 */
require('dotenv').config();
const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Bắt đầu chạy migration thêm bảng Assessment...');
  console.log('📦 DATABASE_URL:', process.env.DATABASE_URL);
  
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrate-assessment.sql'), 'utf8');
    
    // Chạy từng statement riêng để dễ debug
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.query(stmt);
        const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
        if (tableName) console.log(`  ✅ Tạo bảng: ${tableName}`);
      }
    }
    
    // Xác nhận bảng đã tồn tại
    const result = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'assessment%'
      ORDER BY table_name
    `);
    
    console.log('\n✅ Migration hoàn thành! Các bảng đã tạo:');
    result.rows.forEach(r => console.log('  -', r.table_name));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration thất bại:', err.message);
    process.exit(1);
  }
}

runMigration();
