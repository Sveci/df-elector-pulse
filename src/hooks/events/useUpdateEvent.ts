import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UpdateEventData = {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  address?: string;
  capacity?: number;
  categories?: string[];
  region?: string;
  status?: 'active' | 'completed' | 'cancelled';
  coverImage?: File;
  show_registrations_count?: boolean;
  registration_deadline_hours?: number | null;
};

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateEventData) => {
      const { id, coverImage, ...updateData } = data;
      let coverImageUrl: string | undefined;

      // Upload new cover image if provided
      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop();
        const fileName = `${data.slug || id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-covers')
          .upload(fileName, coverImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-covers')
          .getPublicUrl(fileName);

        coverImageUrl = publicUrl;
      }

      // Update event
      const { data: event, error } = await supabase
        .from("events")
        .update({
          ...updateData,
          ...(coverImageUrl && { cover_image_url: coverImageUrl }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar evento: " + error.message);
    }
  });
}
