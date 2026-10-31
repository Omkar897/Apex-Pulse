import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 120000,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/services/**/*.ts",
        "src/models/**/*.ts",
      ],
      exclude: [
        "src/types/**/*.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
