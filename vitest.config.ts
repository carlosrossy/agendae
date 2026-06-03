import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@/domain": path.resolve(__dirname, "./src/domain"),
      "@/application": path.resolve(__dirname, "./src/application"),
      "@/infrastructure": path.resolve(__dirname, "./src/infrastructure"),
      "@/presentation": path.resolve(__dirname, "./src/presentation"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});