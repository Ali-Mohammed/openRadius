import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Antenna } from 'lucide-react';
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
import { oltApi, type Olt } from '@/services/oltApi';
import { formatApiError } from '@/lib/api';
import { toast } from 'sonner';

export default function Olts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [oltToDelete, setOltToDelete] = useState<Olt | null>(null);

  const { data: olts, isLoading } = useQuery({
    queryKey: ['olts'],
    queryFn: () => oltApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => oltApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olts'] });
      toast.success('OLT deleted successfully');
      setOltToDelete(null);
    },
    onError: (error) => {
      toast.error(formatApiError(error));
    },
  });

  const confirmDelete = () => {
    if (oltToDelete) {
      deleteMutation.mutate(oltToDelete.id);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      faulty: 'bg-red-100 text-red-800',
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
          <Antenna className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('network.olts')}</h1>
        </div>
        <Link to="/network/olts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add OLT
          </Button>
        </Link>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Vendor/Model</TableHead>
              <TableHead>Management IP</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>PON Ports</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {olts?.map((olt) => (
              <TableRow key={olt.id}>
                <TableCell className="font-medium">
                  <Link 
                    to={`/network/olts/${olt.id}`}
                    className="hover:underline text-blue-600"
                  >
                    {olt.name}
                  </Link>
                </TableCell>
                <TableCell>{olt.vendor} / {olt.model}</TableCell>
                <TableCell className="font-mono text-sm">{olt.managementIp}</TableCell>
                <TableCell>{olt.siteName || '-'}</TableCell>
                <TableCell>{olt.ponPortCount}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(olt.status)}>
                    {olt.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Link to={`/network/olts/${olt.id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOltToDelete(olt)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!oltToDelete} onOpenChange={() => setOltToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete OLT</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{oltToDelete?.name}"? This action cannot be undone.
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
