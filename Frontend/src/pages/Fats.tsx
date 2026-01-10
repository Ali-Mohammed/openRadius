import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fatApi, type Fat } from '@/services/fatApi';
import { formatApiError } from '@/lib/api';
import { toast } from 'sonner';

export default function Fats() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fatToDelete, setFatToDelete] = useState<Fat | null>(null);

  const { data: fats, isLoading } = useQuery({
    queryKey: ['fats'],
    queryFn: () => fatApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fatApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fats'] });
      toast.success('FAT deleted successfully');
      setFatToDelete(null);
    },
    onError: (error) => {
      toast.error(formatApiError(error));
    },
  });

  const confirmDelete = () => {
    if (fatToDelete) {
      deleteMutation.mutate(fatToDelete.id);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Box className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('network.fats')}</h1>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>FDT</TableHead>
              <TableHead>OLT</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fats?.map((fat) => (
              <TableRow key={fat.id}>
                <TableCell className="font-medium">{fat.code}</TableCell>
                <TableCell>{fat.name || '-'}</TableCell>
                <TableCell>{fat.fdtCode}</TableCell>
                <TableCell>{fat.oltName}</TableCell>
                <TableCell>{fat.capacity}</TableCell>
                <TableCell>{fat.usedPorts}</TableCell>
                <TableCell>{fat.portCount}</TableCell>
                <TableCell className="max-w-xs truncate">{fat.address || '-'}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(fat.status)}>
                    {fat.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFatToDelete(fat)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!fatToDelete} onOpenChange={() => setFatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAT</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fatToDelete?.code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
