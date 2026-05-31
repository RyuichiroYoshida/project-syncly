import { createHash } from "node:crypto";

export function hashEditPassword(password: string | undefined): string | null {
  if (password === undefined || password.length === 0) {
    return null;
  }

  return createHash("sha256").update(password).digest("hex");
}
