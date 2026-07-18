import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { WorkspaceRole } from "../src/platform-types.js";

export interface Identity {
  id: string;
  name: string;
  role: WorkspaceRole;
  workspaceId: string;
}

const secret = process.env.REDRESSCI_AUTH_SECRET || "redressci-local-demo-secret-change-in-production";
if (process.env.REDRESSCI_AUTH_REQUIRED === "1" && !process.env.REDRESSCI_AUTH_SECRET) {
  throw new Error("REDRESSCI_AUTH_SECRET is required when REDRESSCI_AUTH_REQUIRED=1.");
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function issueToken(identity: Identity, ttlSeconds = 8 * 60 * 60) {
  const payload = encode({ ...identity, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyToken(token: string): Identity | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: decoded.id, name: decoded.name, role: decoded.role, workspaceId: decoded.workspaceId };
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request { identity?: Identity }
  }
}

export function attachIdentity(request: Request, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) request.identity = verifyToken(token) || undefined;
  else if (process.env.REDRESSCI_AUTH_REQUIRED !== "1") request.identity = {
      id: "member-admin",
      name: "Demo administrator",
      role: "admin",
      workspaceId: "workspace-open-public-lab",
    };
  next();
}

export function requireRole(...roles: WorkspaceRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.identity || !roles.includes(request.identity.role)) {
      return response.status(403).json({ error: `This action requires one of these roles: ${roles.join(", ")}.` });
    }
    next();
  };
}
