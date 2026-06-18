import {
	createBunRedisCache,
	type RuntimeCacheConfig,
} from "../../back/back-core/src/server/bunRedisCache";

export type { RuntimeCacheConfig };

export const createValkeyCache = createBunRedisCache;
