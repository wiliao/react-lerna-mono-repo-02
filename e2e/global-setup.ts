// e2e/global-setup.ts
import { execSync } from "child_process";

export default async function globalSetup() {
  console.log("🌱 Seeding database before E2E tests...");
  execSync("npm run seed --workspace=packages/app", { stdio: "inherit" });
  console.log("✅ Database seeded");
}
