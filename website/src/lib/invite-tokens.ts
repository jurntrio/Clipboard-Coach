import { createHash, randomUUID } from "crypto";

export function createInviteToken() {
  return randomUUID();
}

export function hashInviteToken(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}
