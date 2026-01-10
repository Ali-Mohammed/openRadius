import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Cable, Trash2 } from 'lucide-react';
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
import { fdtApi, type Fdt } from '@/services/fdtApi';
import { formatApiError } from '@/lib/api';
import { toast } from 'sonner';

export default function Fdts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fdtToDelete, setFdtToDelete] = useState<Fdt | null>(null);

  const { data: fdts, isLoading } = useQuery({
    queryKey: ['fdts'],
    queryFn: () => fdtApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fdtApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fdts'] });
      toast.success('FDT deleted successfully');
      setFdtToDelete(null);
    },
    onError: (error) => {
      toast.error(formatApiError(error));
    },
  });

  const confirmDelete = () => {
    if (fdtToDelete) {
      deleteMutation.mutate(fdtToDelete.id);
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
          <Cable className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('network.fdts')}</h1>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>OLT</TableHead>
              <TableHead>PON Port</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>FATs</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fdts?.map((fdt) => (
              <TableRow key={fdt.id}>
                <TableCell className="font-medium">{fdt.code}</TableCell>
                <TableCell>{fdt.name || '-'}</TableCell>
                <TableCell>{fdt.oltName}</TableCell>
                <TableCell>{fdt.ponPortSlot}/{fdt.ponPortPort}</TableCell>
                <TableCell>{fdt.capacity}</TableCell>
                <TableCell>{fdt.usedPorts}</TableCell>
                <TableCell>{fdt.fatCount}</TableCell>
                <TableCell>{fdt.zone || '-'}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(fdt.status)}>
                    {fdt.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFdtToDelete(fdt)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!fdtToDelete} onOpenChange={() => setFdtToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FDT</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fdtToDelete?.code}"? This action cannot be undone.
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
