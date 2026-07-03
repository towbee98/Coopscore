import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";

export async function logAction(
  cooperativeId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: unknown,
): Promise<void> {
  await db.insert(auditLogs).values({
    cooperativeId,
    entityType,
    entityId,
    action,
    metadata: metadata ?? null,
  });
}
