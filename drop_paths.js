const db = require('./config/db');

async function run() {
  try {
    await db.query(`DROP TABLE IF EXISTS path_enrollments, path_courses, learning_paths CASCADE;`);
    console.log("Deleted learning_paths tables.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
