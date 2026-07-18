import { issueToken } from "../server/auth.js";
import type { WorkspaceRole } from "../src/platform-types.js";

const role = process.argv[2] as WorkspaceRole | undefined;
const id = process.argv[3];
const name = process.argv[4] || id;
const allowed: WorkspaceRole[] = ["reporter", "reviewer", "developer", "admin", "partner"];

if (!role || !allowed.includes(role) || !id) {
  console.error("Usage: npm run auth:token -- <role> <member-id> [display-name]");
  process.exit(2);
}

console.log(issueToken({ id, name, role, workspaceId: process.env.REDRESSCI_WORKSPACE_ID || "workspace-open-public-lab" }));
