import * as Crypto from 'expo-crypto';

import { recurringOccurrenceKey, uuidFromSha1Hex } from '@/lib/ids';

/** Random UUID generated on the device, so rows can be created offline and synced later without id clashes. */
export function newId(): string {
  return Crypto.randomUUID();
}

/** Deterministic id for the transaction a recurring bill posts on a given due date. */
export async function recurringTransactionId(ruleId: string, dueDate: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, recurringOccurrenceKey(ruleId, dueDate));
  return uuidFromSha1Hex(hex);
}
