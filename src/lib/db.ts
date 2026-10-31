import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  seedPromise?: Promise<void> | null;
  memoryServer?: {
    getUri: () => string;
    stop: () => Promise<boolean>;
  } | null;
  seeded?: boolean;
  seedVersion?: number;
}

const CURRENT_SEED_VERSION = 4;

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
  seedPromise: null,
  memoryServer: null,
  seeded: false,
};

globalThis.__mongooseCache = cached;

function isPlaceholderUri(uri: string | undefined): boolean {
  if (!uri || uri.trim() === "") return true;
  return uri.includes("<username>") || uri.includes("<password>");
}

/**
 * Connects to MongoDB using `MONGODB_URI` if configured, or automatically
 * falls back to an embedded `MongoMemoryServer` instance for zero-config
 * local evaluation and automated testing.
 *
 * Uses a synchronous promise lock (`cached.promise` and `cached.seedPromise`)
 * so concurrent Next.js Server Component renders (e.g., `RootLayout` + `Page`)
 * never spawn duplicate connections or race during initial seeding.
 */
export async function connectToDatabase(options?: {
  skipSeed?: boolean;
  customUri?: string;
}): Promise<typeof mongoose> {
  if (!cached.conn || mongoose.connection.readyState !== 1) {
    if (!cached.promise) {
      cached.promise = (async () => {
        const envUri = options?.customUri || process.env.MONGODB_URI;
        let targetUri = envUri;

        if (isPlaceholderUri(targetUri)) {
          if (!cached.memoryServer) {
            const { MongoMemoryServer } = await import("mongodb-memory-server");
            cached.memoryServer = await MongoMemoryServer.create();
          }
          targetUri = cached.memoryServer.getUri();
        }

        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(targetUri as string, {
            bufferCommands: false,
          });
        }

        return mongoose;
      })().catch((err) => {
        cached.promise = null;
        throw err;
      });
    }

    cached.conn = await cached.promise;
  }

  if (
    !options?.skipSeed &&
    (!cached.seeded || cached.seedVersion !== CURRENT_SEED_VERSION) &&
    process.env.NODE_ENV !== "test"
  ) {
    if (!cached.seedPromise) {
      cached.seedPromise = (async () => {
        const { ensureInitialSeedData } = await import("@/lib/seed");
        await ensureInitialSeedData();
        cached.seeded = true;
        cached.seedVersion = CURRENT_SEED_VERSION;
      })().catch((err) => {
        cached.seedPromise = null;
        throw err;
      });
    }
    await cached.seedPromise;
  }

  return cached.conn;
}

/**
 * Disconnects and cleans up database connections (used in test teardown).
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (cached.memoryServer) {
    await cached.memoryServer.stop();
    cached.memoryServer = null;
  }
  cached.conn = null;
  cached.promise = null;
  cached.seedPromise = null;
  cached.seeded = false;
}
