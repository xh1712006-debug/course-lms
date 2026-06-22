const Redis = require('ioredis');
require('dotenv').config();

// Khởi tạo Redis client
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('[Redis] Không thể kết nối tới máy chủ Redis. Hệ thống sẽ tiếp tục hoạt động không có cache.');
      return null;
    }
    return Math.min(times * 1000, 2000);
  }
});

// Lưu các hàm gốc của ioredis
redis._originalGet = redis.get;
redis._originalSet = redis.set;
redis._originalDel = redis.del;

/**
 * Ghi đè hàm GET - Đảm bảo an toàn khi Redis mất kết nối (Không crash ứng dụng)
 */
redis.get = async function (key) {
  try {
    if (redis.status !== 'ready') {
      return null;
    }
    return await redis._originalGet(key);
  } catch (err) {
    console.warn(`[Redis Warning] Lỗi GET key "${key}":`, err.message);
    return null;
  }
};

/**
 * Ghi đè hàm SET - Đảm bảo an toàn khi Redis mất kết nối
 * Hỗ trợ chuyển đổi cấu hình TTL từ dạng đối tượng (của connect-redis v7) sang dạng tham số của ioredis
 */
redis.set = async function (key, value, ...args) {
  try {
    if (redis.status !== 'ready') {
      return null;
    }

    // Xử lý chuyển đổi tham số từ connect-redis v7: { expiration: { type: "EX", value: ttl } }
    let finalArgs = args;
    if (args[0] && typeof args[0] === 'object' && args[0].expiration) {
      const { type, value: ttlVal } = args[0].expiration;
      finalArgs = [type, ttlVal];
    }

    const formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    return await redis._originalSet(key, formattedValue, ...finalArgs);
  } catch (err) {
    console.warn(`[Redis Warning] Lỗi SET key "${key}":`, err.message);
    return null;
  }
};

/**
 * Ghi đè hàm DEL - Đảm bảo an toàn khi Redis mất kết nối
 */
redis.del = async function (key) {
  try {
    if (redis.status !== 'ready') {
      return null;
    }
    return await redis._originalDel(key);
  } catch (err) {
    console.warn(`[Redis Warning] Lỗi DEL key "${key}":`, err.message);
    return null;
  }
};

/**
 * Hỗ trợ phương thức mGet (camelCase) cho connect-redis v7
 */
redis.mGet = async function (keys) {
  try {
    if (redis.status !== 'ready') {
      return [];
    }
    return await redis.mget(keys);
  } catch (err) {
    console.warn('[Redis Warning] Lỗi mGet:', err.message);
    return [];
  }
};

/**
 * Hỗ trợ scanIterator cho các phương thức thống kê session của connect-redis v7
 */
redis.scanIterator = function (options) {
  const match = options?.MATCH || '*';
  const count = options?.COUNT || 100;
  return (async function* () {
    if (redis.status !== 'ready') {
      return;
    }
    let cursor = '0';
    do {
      try {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', count);
        cursor = newCursor;
        yield keys;
      } catch (err) {
        console.warn('[Redis Warning] Lỗi scanIterator:', err.message);
        break;
      }
    } while (cursor !== '0');
  })();
};

/**
 * Phương thức nâng cao getOrSet (Cache-aside Pattern)
 */
redis.getOrSet = async function (key, dbCallback, ttlInSeconds = 3600) {
  const cachedData = await redis.get(key);
  if (cachedData) {
    try {
      console.log(`[Redis Cache HIT] Khóa "${key}" lấy dữ liệu từ Cache.`);
      return JSON.parse(cachedData);
    } catch (e) {
      return cachedData;
    }
  }

  console.log(`[Redis Cache MISS] Khóa "${key}" không tồn tại. Đang truy xuất PostgreSQL...`);
  const freshData = await dbCallback();

  if (freshData !== undefined && freshData !== null) {
    await redis.set(key, freshData, 'EX', ttlInSeconds);
  }

  return freshData;
};

/**
 * Xóa cache theo mẫu Wildcard (Ví dụ: 'courses:*')
 */
redis.delPattern = async function (pattern) {
  try {
    if (redis.status !== 'ready') {
      return;
    }
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[Redis Cache] Đã xóa ${keys.length} keys khớp với mẫu "${pattern}":`, keys);
    }
  } catch (err) {
    console.warn(`[Redis Warning] Lỗi xóa các key khớp mẫu "${pattern}":`, err.message);
  }
};

redis.on('connect', () => {
  console.log('[Redis] Đã kết nối máy chủ Cache thành công.');
});

redis.on('error', (err) => {
  console.error('[Redis] Lỗi hệ thống Cache Redis:', err.message);
});

module.exports = redis;
