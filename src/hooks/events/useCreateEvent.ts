import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CreateEventData = {
  name: string;
  slug: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  address?: string;
  capacity?: number;
  categories: string[];
  region: string;
  coverImage?: File;
  show_registrations_count?: boolean;
  registration_deadline_hours?: number | null;
};

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventData) => {
      let coverImageUrl: string | undefined;

      // Upload cover image if provided
      if (data.coverImage) {
        const fileExt = data.coverImage.name.split('.').pop();
        const fileName = `${data.slug}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-covers')
          .upload(fileName, data.coverImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-covers')
          .getPublicUrl(fileName);

        coverImageUrl = publicUrl;
      }

      // Create event
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          date: data.date,
          time: data.time,
          location: data.location,
          address: data.address,
          capacity: data.capacity || 100,
          categories: data.categories,
          region: data.region,
          cover_image_url: coverImageUrl,
          show_registrations_count: data.show_registrations_count ?? true,
          registration_deadline_hours: data.registration_deadline_hours ?? 4,
        })
        .select()
        .single();

      if (error) throw error;
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar evento: " + error.message);
    }
  });
}
