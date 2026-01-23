/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/parser",
  fullyParallel: true,
  reporter: "list",
});
