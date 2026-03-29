import { supabase } from "@/integrations/supabase/client";

const DEDUP_DAYS = 7;

interface Recipient {
  id: string;
  phone: string;
  nome?: string;
  [key: string]: any;
}

interface DeduplicationResult {
  uniqueRecipients: Recipient[];
  duplicateCount: number;
  duplicatePhones: string[];
}

/**
 * Filters out recipients who already received the same SMS template
 * in the last 7 days (checks both sms_messages and scheduled_messages).
 */
export async function deduplicateSMSRecipients(
  recipients: Recipient[],
  templateSlug: string
): Promise<DeduplicationResult> {
  if (!recipients.length || !templateSlug) {
    return { uniqueRecipients: recipients, duplicateCount: 0, duplicatePhones: [] };
  }

  const phones = recipients.map((r) => r.phone).filter(Boolean);
  if (phones.length === 0) {
    return { uniqueRecipients: recipients, duplicateCount: 0, duplicatePhones: [] };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - DEDUP_DAYS);
  const sinceISO = sinceDate.toISOString();

  // Query both tables in parallel for phones that already received this template
  const [smsResult, scheduledResult] = await Promise.all([
    supabase
      .from("sms_messages")
      .select("phone")
      .in("phone", phones)
      .gte("created_at", sinceISO)
      .in("status", ["sent", "delivered", "queued", "pending"]),
    supabase
      .from("scheduled_messages")
      .select("recipient_phone")
      .eq("message_type", "sms")
      .eq("template_slug", templateSlug)
      .in("recipient_phone", phones)
      .gte("created_at", sinceISO)
      .in("status", ["pending", "processing", "sent"]),
  ]);

  const sentPhones = new Set<string>();

  // sms_messages doesn't store template_slug, so we check by phone only
  // (this is a broader check but safer)
  if (smsResult.data) {
    smsResult.data.forEach((row) => {
      if (row.phone) sentPhones.add(row.phone);
    });
  }

  if (scheduledResult.data) {
    scheduledResult.data.forEach((row) => {
      if (row.recipient_phone) sentPhones.add(row.recipient_phone);
    });
  }

  const uniqueRecipients = recipients.filter((r) => !sentPhones.has(r.phone));
  const duplicatePhones = recipients
    .filter((r) => sentPhones.has(r.phone))
    .map((r) => r.phone);

  return {
    uniqueRecipients,
    duplicateCount: duplicatePhones.length,
    duplicatePhones,
  };
}
