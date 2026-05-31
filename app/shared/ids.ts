import { randomBytes } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function createUlid(): string {
  const time = Date.now();
  const bytes = randomBytes(16);

  let timePart = "";
  let remainingTime = time;
  for (let i = 0; i < 10; i += 1) {
    timePart = ENCODING[remainingTime % 32] + timePart;
    remainingTime = Math.floor(remainingTime / 32);
  }

  let randomPart = "";
  for (let i = 0; i < 16; i += 1) {
    randomPart += ENCODING[bytes[i] & 31];
  }

  return timePart + randomPart;
}
