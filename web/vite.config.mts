import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
const isPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  base: isPagesBuild ? "/logiccraft/" : "/",
});
