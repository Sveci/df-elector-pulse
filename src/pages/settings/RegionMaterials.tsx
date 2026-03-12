import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Upload, FileText, Trash2, Edit, ExternalLink, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";
import { useSMSTemplates } from "@/hooks/useSMSTemplates";
import {
  useRegionMaterials,
  useCreateRegionMaterial,
  useUpdateRegionMaterial,
  useDeleteRegionMaterial,
  useUploadRegionMaterial,
  RegionMaterial,
} from "@/hooks/useRegionMaterials";
import { useIntegrationsSettings, useUpdateIntegrationsSettings } from "@/hooks/useIntegrationsSettings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RegionMaterials = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RegionMaterial | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [materialName, setMaterialName] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [smsTemplateSlug, setSmsTemplateSlug] = useState("material-regiao-sms");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [isActive, setIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Queries
  const { data: cities, isLoading: citiesLoading } = useOfficeCities();
  const { data: materials, isLoading: materialsLoading } = useRegionMaterials();
  const { data: templates } = useSMSTemplates();
  const { data: integrationsSettings } = useIntegrationsSettings();

  // Mutations
  const createMaterial = useCreateRegionMaterial();
  const updateMaterial = useUpdateRegionMaterial();
  const deleteMaterial = useDeleteRegionMaterial();
  const uploadMaterial = useUploadRegionMaterial();
  const updateSettings = useUpdateIntegrationsSettings();

  // Get cities that don't have materials yet
  const citiesWithMaterial = new Set(materials?.map((m) => m.city_id) || []);
  const availableCities = cities?.filter((c) => !citiesWithMaterial.has(c.id)) || [];

  const handleOpenDialog = (material?: RegionMaterial) => {
    if (material) {
      setEditingMaterial(material);
      setSelectedCityId(material.city_id);
      setMaterialName(material.material_name);
      setSmsTemplateSlug(material.sms_template_slug);
      setDelayMinutes(material.delay_minutes);
      setIsActive(material.is_active);
      setMaterialFile(null);
    } else {
      setEditingMaterial(null);
      setSelectedCityId("");
      setMaterialName("");
      setSmsTemplateSlug("material-regiao-sms");
      setDelayMinutes(integrationsSettings?.region_material_default_delay_minutes || 60);
      setIsActive(true);
      setMaterialFile(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMaterial(null);
    setMaterialFile(null);
  };

  const handleSubmit = async () => {
    if (!materialName.trim()) return;
    
    setIsUploading(true);
    try {
      let materialUrl = editingMaterial?.material_url || "";

      // Upload new file if selected
      if (materialFile && selectedCityId) {
        materialUrl = await uploadMaterial.mutateAsync({
          file: materialFile,
          cityId: selectedCityId,
        });
      }

      if (editingMaterial) {
        // Update existing
        await updateMaterial.mutateAsync({
          id: editingMaterial.id,
          data: {
            material_name: materialName,
            ...(materialUrl && { material_url: materialUrl }),
            sms_template_slug: smsTemplateSlug,
            delay_minutes: delayMinutes,
            is_active: isActive,
          },
        });
      } else {
        // Create new
        if (!selectedCityId || !materialUrl) return;
        await createMaterial.mutateAsync({
          city_id: selectedCityId,
          material_url: materialUrl,
          material_name: materialName,
          sms_template_slug: smsTemplateSlug,
          delay_minutes: delayMinutes,
          is_active: isActive,
        });
      }

      handleCloseDialog();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteMaterial.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleToggleActive = async (material: RegionMaterial) => {
    await updateMaterial.mutateAsync({
      id: material.id,
      data: { is_active: !material.is_active },
    });
  };

  const handleDefaultDelayChange = async (minutes: number) => {
    await updateSettings.mutateAsync({
      region_material_default_delay_minutes: minutes,
    });
  };

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const isLoading = citiesLoading || materialsLoading;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Materiais por Região</h1>
          <p className="text-muted-foreground">
            Configure materiais exclusivos para cada RA que serão enviados automaticamente após a verificação do líder
          </p>
        </div>
      </div>

      {/* Global Settings Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configuração Global
          </CardTitle>
          <CardDescription>
            Tempo padrão de espera após a verificação do líder para enviar o material
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="default-delay" className="whitespace-nowrap">Delay padrão:</Label>
            <Select
              value={String(integrationsSettings?.region_material_default_delay_minutes || 60)}
              onValueChange={(v) => handleDefaultDelayChange(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="180">3 horas</SelectItem>
                <SelectItem value="360">6 horas</SelectItem>
                <SelectItem value="720">12 horas</SelectItem>
                <SelectItem value="1440">24 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Materiais Configurados
            </CardTitle>
            <CardDescription>
              {materials?.length || 0} regiões com material configurado
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={availableCities.length === 0}>
            <Upload className="h-4 w-4 mr-2" />
            Adicionar Material
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : materials && materials.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Região</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                          {material.office_cities?.tipo}
                        </Badge>
                        <span className="font-medium">{material.office_cities?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{material.material_name}</span>
                        <a
                          href={material.material_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{formatDelay(material.delay_minutes)}</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={material.is_active}
                        onCheckedChange={() => handleToggleActive(material)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(material)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(material.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum material configurado</p>
              <p className="text-sm">Clique em "Adicionar Material" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? "Editar Material" : "Adicionar Material"}
            </DialogTitle>
            <DialogDescription>
              Configure o material que será enviado para líderes desta região
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Region Select */}
            {!editingMaterial && (
              <div className="space-y-2">
                <Label htmlFor="city">Região</Label>
                <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a RA" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.nome} ({city.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Material Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Material</Label>
              <Input
                id="name"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="Ex: Guia de Liderança Taguatinga"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">
                {editingMaterial ? "Substituir Arquivo (opcional)" : "Arquivo do Material"}
              </Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.zip,.rar"
                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
              />
              {editingMaterial && (
                <p className="text-xs text-muted-foreground">
                  Arquivo atual: {editingMaterial.material_name}
                </p>
              )}
            </div>

            {/* SMS Template */}
            <div className="space-y-2">
              <Label htmlFor="template">Template SMS</Label>
              <Select value={smsTemplateSlug} onValueChange={setSmsTemplateSlug}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates?.filter(t => t.is_active).map((template) => (
                    <SelectItem key={template.slug} value={template.slug}>
                      {template.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="material-regiao-sms">Material Região (padrão)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <Label htmlFor="delay">Tempo de Espera</Label>
              <Select value={String(delayMinutes)} onValueChange={(v) => setDelayMinutes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="180">3 horas</SelectItem>
                  <SelectItem value="360">6 horas</SelectItem>
                  <SelectItem value="720">12 horas</SelectItem>
                  <SelectItem value="1440">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Envio ativo</Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isUploading ||
                !materialName.trim() ||
                (!editingMaterial && (!selectedCityId || !materialFile))
              }
            >
              {isUploading ? "Salvando..." : editingMaterial ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este material? Os líderes desta região não receberão mais o envio automático.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RegionMaterials;
