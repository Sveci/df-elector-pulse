import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RegionMaterial {
  id: string;
  city_id: string;
  material_url: string;
  material_name: string;
  sms_template_slug: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  office_cities?: {
    id: string;
    nome: string;
    tipo: string;
  };
}

export function useRegionMaterials() {
  return useQuery({
    queryKey: ["region-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("region_materials")
        .select(`
          *,
          office_cities (
            id,
            nome,
            tipo
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RegionMaterial[];
    },
  });
}

export function useRegionMaterialByCity(cityId: string | null) {
  return useQuery({
    queryKey: ["region-material", cityId],
    queryFn: async () => {
      if (!cityId) return null;

      const { data, error } = await supabase
        .from("region_materials")
        .select(`
          *,
          office_cities (
            id,
            nome,
            tipo
          )
        `)
        .eq("city_id", cityId)
        .maybeSingle();

      if (error) throw error;
      return data as RegionMaterial | null;
    },
    enabled: !!cityId,
  });
}

export function useCreateRegionMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      city_id: string;
      material_url: string;
      material_name: string;
      sms_template_slug?: string;
      delay_minutes?: number;
      is_active?: boolean;
    }) => {
      const { error } = await supabase.from("region_materials").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["region-materials"] });
      toast.success("Material da região configurado com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao criar material:", error);
      toast.error("Erro ao configurar material da região");
    },
  });
}

export function useUpdateRegionMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        material_url: string;
        material_name: string;
        sms_template_slug: string;
        delay_minutes: number;
        is_active: boolean;
      }>;
    }) => {
      const { error } = await supabase
        .from("region_materials")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["region-materials"] });
      toast.success("Material atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar material:", error);
      toast.error("Erro ao atualizar material");
    },
  });
}

export function useDeleteRegionMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("region_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["region-materials"] });
      toast.success("Material removido com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao remover material:", error);
      toast.error("Erro ao remover material");
    },
  });
}

export function useUploadRegionMaterial() {
  return useMutation({
    mutationFn: async ({
      file,
      cityId,
    }: {
      file: File;
      cityId: string;
    }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${cityId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("region-materials")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("region-materials")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    },
    onError: (error) => {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do arquivo");
    },
  });
}
