import { supabase } from "@/integrations/supabase/client";

const DEDUP_DAYS = 7;
const QUERY_CHUNK_SIZE = 400;

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

const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
};

const buildPhoneVariants = (normalizedPhone: string): string[] => {
  if (!normalizedPhone) return [];
  const countryPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;
  return [normalizedPhone, countryPhone, `+${countryPhone}`];
};

const chunkArray = <T,>(arr: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
};

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

  const normalizedRecipientPhones = Array.from(
    new Set(recipients.map((r) => normalizePhone(r.phone)).filter(Boolean))
  );

  if (normalizedRecipientPhones.length === 0) {
    return { uniqueRecipients: recipients, duplicateCount: 0, duplicatePhones: [] };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - DEDUP_DAYS);
  const sinceISO = sinceDate.toISOString();

  const phonesToSearch = Array.from(
    new Set(normalizedRecipientPhones.flatMap((phone) => buildPhoneVariants(phone)))
  );

  const phoneChunks = chunkArray(phonesToSearch, QUERY_CHUNK_SIZE);

  const [smsResults, scheduledResults] = await Promise.all([
    Promise.all(
      phoneChunks.map((chunk) =>
        supabase
          .from("sms_messages")
          .select("phone")
          .in("phone", chunk)
          .gte("created_at", sinceISO)
          .in("status", ["sent", "delivered", "queued", "pending"])
      )
    ),
    Promise.all(
      phoneChunks.map((chunk) =>
        supabase
          .from("scheduled_messages")
          .select("recipient_phone")
          .eq("message_type", "sms")
          .eq("template_slug", templateSlug)
          .in("recipient_phone", chunk)
          .gte("created_at", sinceISO)
          .in("status", ["pending", "processing", "sent"])
      )
    ),
  ]);

  const sentPhonesNormalized = new Set<string>();

  smsResults.forEach((result) => {
    result.data?.forEach((row) => {
      const phone = normalizePhone(row.phone);
      if (phone) sentPhonesNormalized.add(phone);
    });
  });

  scheduledResults.forEach((result) => {
    result.data?.forEach((row) => {
      const phone = normalizePhone(row.recipient_phone);
      if (phone) sentPhonesNormalized.add(phone);
    });
  });

  const uniqueRecipients = recipients.filter((r) => !sentPhonesNormalized.has(normalizePhone(r.phone)));
  const duplicatePhones = recipients
    .filter((r) => sentPhonesNormalized.has(normalizePhone(r.phone)))
    .map((r) => r.phone);

  return {
    uniqueRecipients,
    duplicateCount: duplicatePhones.length,
    duplicatePhones,
  };
}
