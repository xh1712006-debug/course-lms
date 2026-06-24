const { AuditLog } = require('../../models/schema');

class PgAuditLogRepository {
  async log(userId, action, details = {}) {
    return await AuditLog.create(userId, action, details);
  }
}

module.exports = PgAuditLogRepository;
