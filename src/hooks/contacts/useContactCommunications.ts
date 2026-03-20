import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactWhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  error_message: string | null;
}

export interface ContactSMSMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  error_message: string | null;
}

export interface ContactEmailLog {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  template_name?: string;
}

export interface ContactCommunications {
  whatsapp: ContactWhatsAppMessage[];
  sms: ContactSMSMessage[];
  email: ContactEmailLog[];
}

export function useContactCommunications(contactId: string | undefined, contactPhone?: string, contactEmail?: string) {
  return useQuery({
    queryKey: ["contact_communications", contactId, contactPhone, contactEmail],
    queryFn: async (): Promise<ContactCommunications> => {
      if (!contactId) return { whatsapp: [], sms: [], email: [] };

      // Fetch WhatsApp messages by contact_id first
      let whatsappMessages: ContactWhatsAppMessage[] = [];

      const { data: msgById, error: whatsappError } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (whatsappError) {
        console.error("Error fetching WhatsApp messages by contact_id:", whatsappError);
      }

      whatsappMessages = (msgById || []) as ContactWhatsAppMessage[];

      // If no messages found by contact_id and we have a phone, try searching by phone
      if (whatsappMessages.length === 0 && contactPhone) {
        const normalizedPhone = contactPhone.replace(/\D/g, '');
        const phoneSuffix = normalizedPhone.slice(-8); // Last 8 digits for matching

        const { data: msgByPhone, error: phoneError } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .ilike("phone", `%${phoneSuffix}%`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (phoneError) {
          console.error("Error fetching WhatsApp messages by phone:", phoneError);
        } else {
          whatsappMessages = (msgByPhone || []) as ContactWhatsAppMessage[];
        }
      }

      // Fetch SMS messages by contact_id first
      let smsMessages: ContactSMSMessage[] = [];

      const { data: smsById, error: smsError } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (smsError) {
        console.error("Error fetching SMS messages by contact_id:", smsError);
      }

      smsMessages = (smsById || []) as ContactSMSMessage[];

      // If no SMS found by contact_id and we have a phone, try searching by phone
      if (smsMessages.length === 0 && contactPhone) {
        const normalizedPhone = contactPhone.replace(/\D/g, '');
        const phoneSuffix = normalizedPhone.slice(-8);

        const { data: smsByPhone, error: smsPhoneError } = await supabase
          .from("sms_messages")
          .select("*")
          .ilike("phone", `%${phoneSuffix}%`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (smsPhoneError) {
          console.error("Error fetching SMS messages by phone:", smsPhoneError);
        } else {
          smsMessages = (smsByPhone || []) as ContactSMSMessage[];
        }
      }

      // Fetch Email logs by contact_id first
      let emailLogs: ContactEmailLog[] = [];

      const { data: emailById, error: emailError } = await supabase
        .from("email_logs")
        .select(`
          id,
          to_email,
          subject,
          status,
          sent_at,
          created_at,
          error_message,
          template_id,
          email_templates (
            nome
          )
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (emailError) {
        console.error("Error fetching email logs by contact_id:", emailError);
      }

      emailLogs = (emailById || []).map((log: any) => ({
        ...log,
        template_name: log.email_templates?.nome || null,
      })) as ContactEmailLog[];

      // If no emails found by contact_id and we have an email, try searching by email address
      if (emailLogs.length === 0 && contactEmail) {
        const { data: emailByAddress, error: emailAddressError } = await supabase
          .from("email_logs")
          .select(`
            id,
            to_email,
            subject,
            status,
            sent_at,
            created_at,
            error_message,
            template_id,
            email_templates (
              nome
            )
          `)
          .eq("to_email", contactEmail)
          .order("created_at", { ascending: false })
          .limit(50);

        if (emailAddressError) {
          console.error("Error fetching email logs by email address:", emailAddressError);
        } else {
          emailLogs = (emailByAddress || []).map((log: any) => ({
            ...log,
            template_name: log.email_templates?.nome || null,
          })) as ContactEmailLog[];
        }
      }

      return {
        whatsapp: whatsappMessages,
        sms: smsMessages,
        email: emailLogs,
      };
    },
    enabled: !!contactId,
  });
}
