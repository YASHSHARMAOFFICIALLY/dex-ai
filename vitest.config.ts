import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/*/src/**/*.test.ts",
      "apps/*/fixtures/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
