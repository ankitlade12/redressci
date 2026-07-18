import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface StoredArtifact {
  id: string;
  name: string;
  type: string;
  bytes: number;
  sha256: string;
  storageRegion: string;
  encrypted: true;
  createdAt: string;
}

function encryptionKey() {
  const source = process.env.REDRESSCI_STORAGE_KEY || "redressci-demo-storage-key-change-in-production";
  return createHash("sha256").update(source).digest();
}

export function storeEncryptedArtifact(root: string, input: { id: string; name: string; type: string; data: Buffer; region?: string }): StoredArtifact {
  const dir = path.join(root, "data", "encrypted");
  mkdirSync(dir, { recursive: true });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(input.data), cipher.final()]);
  const tag = cipher.getAuthTag();
  writeFileSync(path.join(dir, `${input.id}.bin`), Buffer.concat([iv, tag, ciphertext]), { mode: 0o600 });
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    bytes: input.data.byteLength,
    sha256: createHash("sha256").update(input.data).digest("hex"),
    storageRegion: input.region || process.env.REDRESSCI_STORAGE_REGION || "us",
    encrypted: true,
    createdAt: new Date().toISOString(),
  };
}

export function readEncryptedArtifact(root: string, id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid artifact identifier.");
  const payload = readFileSync(path.join(root, "data", "encrypted", `${id}.bin`));
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}
