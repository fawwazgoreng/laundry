import { defineConfig, devices } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:4173";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 1,
    reporter: [["list"]],
    timeout: 60_000,
    use: {
        baseURL: WEB_URL,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: [
        {
            command: "bun run src/index.ts",
            url: `${BACKEND_URL}/health`,
            reuseExistingServer: false,
            cwd: "../backend",
            timeout: 30_000,
            env: {
                PORT: "3000",
                DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/laundry",
                CORS_ORIGIN: WEB_URL,
            },
        },
        {
            command: "bun run preview -- --port 4173 --strictPort",
            url: WEB_URL,
            reuseExistingServer: false,
            cwd: ".",
            timeout: 30_000,
        },
    ],
});