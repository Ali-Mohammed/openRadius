import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Pencil, Trash2, ArchiveRestore, Search, Wallet, Package, DollarSign, X, Check, Archive, RefreshCw, Receipt, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, Settings, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  restoreProfile,
  type BillingProfile,
  type CreateBillingProfileRequest,
  type BillingProfileWallet,
  type BillingProfileAddon,
} from '../api/billingProfiles';
import { radiusProfileApi } from '../api/radiusProfileApi';
import { getGroups } from '../api/groups';
import { addonApi, type Addon } from '../api/addons';
import { customWalletApi } from '../api/customWallets';
import userWalletApi from '../api/userWallets';
import { workspaceApi } from '../lib/api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { tablePreferenceApi } from '../api/tablePreferenceApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../components/ui/command';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { cn } from '../lib/utils';

const walletIconOptions = [
  { value: 'Wallet', label: 'Wallet', Icon: Wallet },
  { value: 'DollarSign', label: 'Dollar Sign', Icon: DollarSign },
  { value: 'Package', label: 'Package', Icon: Package },
];

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
];

export default function BillingProfiles() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspaceId = parseInt(id || '0');
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'));
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc');

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BillingProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    name: true,
    description: true,
    price: true,
    radiusProfile: true,
    billingGroup: true,
    wallets: true,
    addons: true,
    createdAt: true,
    updatedAt: false,
  };

  const DEFAULT_COLUMN_WIDTHS = {
    name: 180,
    description: 250,
    price: 120,
    radiusProfile: 160,
    billingGroup: 150,
    wallets: 120,
    addons: 120,
    createdAt: 140,
    updatedAt: 140,
    actions: 120,
  };

  const DEFAULT_COLUMN_ORDER = [
    'name',
    'description',
    'price',
    'radiusProfile',
    'billingGroup',
    'wallets',
    'addons',
    'createdAt',
    'updatedAt',
    'actions',
  ];

  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);

  // Track if preferences have been loaded
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load table preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('billing-profiles')
        if (preferences) {
          if (preferences.columnWidths) {
            setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(preferences.columnWidths) })
          }
          if (preferences.columnOrder) {
            setColumnOrder(JSON.parse(preferences.columnOrder))
          }
          if (preferences.columnVisibility) {
            setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(preferences.columnVisibility) })
          }
          if (preferences.sortField) {
            setSortField(preferences.sortField)
            setSortDirection((preferences.sortDirection as 'asc' | 'desc') || 'asc')
          }
        }
      } catch (error) {
        console.log('No saved preferences found', error)
      } finally {
        setPreferencesLoaded(true)
      }
    }

    loadPreferences()
  }, [])

  // Auto-save preferences when they change
  useEffect(() => {
    if (!preferencesLoaded) return

    const savePreferences = async () => {
      try {
        await tablePreferenceApi.savePreference({
          tableName: 'billing-profiles',
          columnWidths: JSON.stringify(columnWidths),
          columnOrder: JSON.stringify(columnOrder),
          columnVisibility: JSON.stringify(columnVisibility),
          sortField: sortField || undefined,
          sortDirection: sortDirection,
        })
        console.log('Table preferences saved successfully')
      } catch (error) {
        console.error('Failed to save table preferences:', error)
      }
    }

    const timeoutId = setTimeout(savePreferences, 1000)
    return () => clearTimeout(timeoutId)
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, currentWorkspaceId, preferencesLoaded])

  // Fetch workspace for currency
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  // Helper function to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع ' : 'IQD ';
      case 'USD':
      default:
        return '$';
    }
  };

  const currencySymbol = getCurrencySymbol(workspace?.currency);

  const [formData, setFormData] = useState<CreateBillingProfileRequest>({
    name: '',
    description: '',
    price: 0,
    radiusProfileId: 0,
    billingGroupId: 0,
    wallets: [],
    addons: [],
  });

  const [selectedRadiusProfiles, setSelectedRadiusProfiles] = useState<{profileId: number, number: number}[]>([]);
  const [selectedBillingGroups, setSelectedBillingGroups] = useState<number[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{addonId: number, price: number, number: number}[]>([]);
  const [radiusProfilePopoverOpen, setRadiusProfilePopoverOpen] = useState(false);
  const [billingGroupPopoverOpen, setBillingGroupPopoverOpen] = useState(false);
  const [addonPopoverOpen, setAddonPopoverOpen] = useState(false);
  const [selectAllGroups, setSelectAllGroups] = useState(false);

  const [wallets, setWallets] = useState<BillingProfileWallet[]>([]);
  const [addons, setAddons] = useState<BillingProfileAddon[]>([]);

  // Queries
  const { data: activeProfilesData, isLoading: isLoadingActive, isFetching: isFetchingActive } = useQuery({
    queryKey: ['billing-profiles', 'active', currentPage, pageSize, searchQuery, sortField, sortDirection],
    queryFn: () => getProfiles({ 
      search: searchQuery, 
      includeDeleted: false,
      page: currentPage,
      pageSize: pageSize,
    }),
  });

  const activeProfiles = useMemo(() => activeProfilesData?.data?.filter((p) => !p.isDeleted) || [], [activeProfilesData?.data]);
  const activePagination = activeProfilesData?.pagination;

  const { data: deletedProfilesData, isLoading: isLoadingDeleted, isFetching: isFetchingDeleted } = useQuery({
    queryKey: ['billing-profiles', 'deleted', currentPage, pageSize, searchQuery],
    queryFn: () => getProfiles({ 
      search: searchQuery, 
      includeDeleted: true,
      page: currentPage,
      pageSize: pageSize,
    }),
  });

  const deletedProfiles = useMemo(() => deletedProfilesData?.data?.filter((p) => p.isDeleted) || [], [deletedProfilesData?.data]);
  const deletedPagination = deletedProfilesData?.pagination;

  // Virtual scrolling for active profiles
  const rowVirtualizerActive = useVirtualizer({
    count: activeProfiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  });

  // Virtual scrolling for deleted profiles
  const rowVirtualizerDeleted = useVirtualizer({
    count: deletedProfiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  });

  const { data: radiusProfilesData, isLoading: isLoadingRadiusProfiles } = useQuery({
    queryKey: ['radius-profiles', currentWorkspaceId],
    queryFn: async () => {
      if (!currentWorkspaceId) {
        console.log('No workspace ID available');
        return { data: [], pagination: { currentPage: 1, pageSize: 50, totalRecords: 0, totalPages: 0 } };
      }
      console.log('Fetching radius profiles for workspace:', currentWorkspaceId);
      const result = await radiusProfileApi.getAll(1, 1000);
      console.log('Radius profiles result:', result);
      return result;
    },
    enabled: !!currentWorkspaceId,
  });

  const { data: billingGroupsData, isLoading: isLoadingBillingGroups } = useQuery({
    queryKey: ['billing-groups'],
    queryFn: async () => {
      console.log('Fetching billing groups');
      const result = await getGroups({ includeDeleted: false });
      console.log('Billing groups result:', result);
      return result;
    },
  });

  const { data: addonsData, isLoading: isLoadingAddons } = useQuery({
    queryKey: ['addons'],
    queryFn: () => addonApi.getAll({ includeDeleted: false }),
  });

  const { data: userWalletsData, isLoading: isLoadingUserWallets } = useQuery({
    queryKey: ['user-wallets'],
    queryFn: () => userWalletApi.getAll({ status: 'active' }),
  });

  const { data: customWalletsData, isLoading: isLoadingCustomWallets } = useQuery({
    queryKey: ['custom-wallets'],
    queryFn: () => customWalletApi.getAll({ status: 'active', pageSize: 1000 }),
  });


  // Mutations
  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to create billing profile';
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBillingProfileRequest }) =>
      updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update billing profile';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete billing profile');
      setDeleteConfirmId(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile restored successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to restore billing profile');
    },
  });

  // Handler functions
  const handleSort = useCallback((field: string) => {
    if (resizing) return
    
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }, [sortField, sortDirection, resizing])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

  const handleResize = useCallback((column: string, startX: number, startWidth: number) => {
    setResizing(column)
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(60, startWidth + diff)
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setTimeout(() => setResizing(null), 100)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleColumnDragStart = useCallback((e: React.DragEvent, column: string) => {
    if (column === 'actions') return
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
      dragImage.style.opacity = '0.5'
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, column: string) => {
    if (!draggingColumn || column === 'actions') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingColumn !== column) {
      setDragOverColumn(column)
    }
  }, [draggingColumn])

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    
    if (!draggingColumn || draggingColumn === targetColumn || targetColumn === 'actions') {
      setDraggingColumn(null)
      setDragOverColumn(null)
      return
    }

    setColumnOrder(prev => {
      const newOrder = [...prev]
      const dragIndex = newOrder.indexOf(draggingColumn)
      const dropIndex = newOrder.indexOf(targetColumn)
      
      newOrder.splice(dragIndex, 1)
      newOrder.splice(dropIndex, 0, draggingColumn)
      
      return newOrder
    })

    setDraggingColumn(null)
    setDragOverColumn(null)
  }, [draggingColumn])

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumn(null)
    setDragOverColumn(null)
  }, [])

  const handleResetColumns = () => {
    setResetColumnsDialogOpen(true)
  }

  const confirmResetColumns = async () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    
    try {
      await tablePreferenceApi.deletePreference('billing-profiles')
      toast.success('Table columns reset to defaults')
    } catch (error) {
      console.error('Failed to delete preferences:', error)
      toast.error('Columns reset but failed to clear saved preferences')
    }
    
    setResetColumnsDialogOpen(false)
  }

  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      pages.push(total)
    }
    
    return pages
  }, [])

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const handleOpenDialog = (profile?: BillingProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || '',
        price: profile.price || 0,
        radiusProfileId: profile.radiusProfileId,
        billingGroupId: profile.billingGroupId,
        wallets: profile.wallets || [],
        addons: profile.addons || [],
      });
      setWallets(profile.wallets || []);
      setSelectedRadiusProfiles([{profileId: profile.radiusProfileId, number: 1}]);
      
      // Check if "All Groups" is selected (billingGroupId === 0 or null)
      const isAllGroups = profile.billingGroupId === 0 || profile.billingGroupId === null;
      setSelectAllGroups(isAllGroups);
      setSelectedBillingGroups(isAllGroups ? [] : [profile.billingGroupId]);
      
      setSelectedAddons(
        profile.addons?.map(a => ({ addonId: a.id!, price: a.price, number: 1 })) || []
      );
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        radiusProfileId: 0,
        billingGroupId: 0,
        wallets: [],
        addons: [],
      });
      setWallets([]);
      setSelectedRadiusProfiles([]);
      setSelectedBillingGroups([]);
      setSelectAllGroups(false);
      setSelectedAddons([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      radiusProfileId: 0,
      billingGroupId: 0,
      wallets: [],
      addons: [],
    });
    setWallets([]);
    setSelectedRadiusProfiles([]);
    setSelectedBillingGroups([]);
    setSelectAllGroups(false);
    setSelectedAddons([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedRadiusProfiles.length === 0) {
      toast.error('Please select at least one radius profile');
      return;
    }

    // Validate all radius profiles have a number > 0
    const invalidProfile = selectedRadiusProfiles.find(rp => !rp.number || rp.number <= 0);
    if (invalidProfile) {
      toast.error('All radius profiles must have a number greater than 0');
      return;
    }
    if (!selectAllGroups && selectedBillingGroups.length === 0) {
      toast.error('Please select at least one billing group or "All Groups"');
      return;
    }

    // Validate all addons have a number > 0
    const invalidAddon = selectedAddons.find(addon => !addon.number || addon.number <= 0);
    if (invalidAddon) {
      toast.error('All addons must have a number greater than 0');
      return;
    }

    // Convert selectedAddons to BillingProfileAddon format
    const profileAddons = selectedAddons.map((sa, index) => {
      const addon = addonsData?.data?.find((a: Addon) => a.id === sa.addonId);
      return {
        title: addon?.name || '',
        description: addon?.description || '',
        price: sa.price,
        displayOrder: index,
      };
    });

    // For now, use the first selected radius profile and billing group as the main one
    // TODO: Backend might need to be updated to support multiple
    const data = { 
      ...formData, 
      radiusProfileId: selectedRadiusProfiles[0].profileId,
      billingGroupId: selectAllGroups ? 0 : selectedBillingGroups[0], // 0 means all groups
      wallets, 
      addons: profileAddons 
    };

    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate(id);
  };

  // Render column header with drag and drop
  const renderColumnHeader = (columnKey: string) => {
    const columnConfig: Record<string, { label: string, sortKey?: string, align?: string, draggable?: boolean }> = {
      name: { label: 'Name', sortKey: 'name' },
      description: { label: 'Description', sortKey: 'description' },
      price: { label: 'Price', sortKey: 'price', align: 'right' },
      radiusProfile: { label: 'Radius Profile', sortKey: 'radiusProfile' },
      billingGroup: { label: 'Billing Group' },
      wallets: { label: 'Wallets' },
      addons: { label: 'Addons' },
      createdAt: { label: 'Created At', sortKey: 'createdAt' },
      updatedAt: { label: 'Updated At', sortKey: 'updatedAt' },
      deletedAt: { label: 'Deleted At' },
      deletedBy: { label: 'Deleted By' },
      actions: { label: 'Actions', draggable: false },
    }

    const config = columnConfig[columnKey]
    if (!config) return null

    // Check if column is visible
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const isDraggable = config.draggable !== false && columnKey !== 'actions'
    const isSortable = !!config.sortKey
    const isDragging = draggingColumn === columnKey
    const isDragOver = dragOverColumn === columnKey

    const baseClasses = "h-12 px-4 font-semibold whitespace-nowrap select-none relative"
    const alignmentClass = config.align === 'right' ? 'text-right' : config.align === 'center' ? 'text-center' : ''
    const sortableClass = isSortable ? 'cursor-pointer' : ''
    const dragClasses = isDragging ? 'opacity-50' : isDragOver ? 'bg-blue-100 dark:bg-blue-900' : ''
    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-muted z-10' : ''
    
    return (
      <TableHead
        key={columnKey}
        className={`${baseClasses} ${alignmentClass} ${sortableClass} ${dragClasses} ${stickyClass}`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={isSortable ? () => handleSort(config.sortKey!) : undefined}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleColumnDragStart(e, columnKey) : undefined}
        onDragOver={isDraggable ? (e) => handleColumnDragOver(e, columnKey) : undefined}
        onDrop={isDraggable ? (e) => handleColumnDrop(e, columnKey) : undefined}
        onDragEnd={isDraggable ? handleColumnDragEnd : undefined}
      >
        {config.label}
        {isSortable && getSortIcon(config.sortKey!)}
        <div 
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onMouseDown={(e) => { 
            e.preventDefault()
            e.stopPropagation() 
            handleResize(columnKey, e.clientX, columnWidths[columnKey as keyof typeof columnWidths])
          }}
        />
      </TableHead>
    )
  }

  // Render table cell based on column order
  const renderTableCell = (columnKey: string, profile: BillingProfile) => {
    // Check if column is visible
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-background z-10' : ''
    const baseStyle = { width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }
    const opacityClass = profile.isDeleted ? 'opacity-60' : ''

    switch (columnKey) {
      case 'name':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 font-medium ${opacityClass}`} style={baseStyle}>
            {profile.name}
          </TableCell>
        )
      case 'description':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 max-w-md truncate ${opacityClass}`} style={baseStyle}>
            {profile.description || '-'}
          </TableCell>
        )
      case 'price':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 text-right ${opacityClass}`} style={baseStyle}>
            {profile.price ? (
              <span className="font-medium">{currencySymbol}{profile.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        )
      case 'radiusProfile':
        const radiusProfile = radiusProfilesData?.data?.find((rp: any) => rp.id === profile.radiusProfileId)
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {radiusProfile ? (
              <div className="flex flex-col">
                <span className="font-medium text-sm">{radiusProfile.name}</span>
                {radiusProfile.downrate && radiusProfile.uprate && (
                  <span className="text-xs text-muted-foreground">
                    {radiusProfile.downrate}/{radiusProfile.uprate} Mbps
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        )
      case 'billingGroup':
        const billingGroup = billingGroupsData?.data?.find((bg: any) => bg.id === profile.billingGroupId)
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {profile.billingGroupId === 0 || !billingGroup ? (
              <Badge variant="outline">All Groups</Badge>
            ) : (
              <Badge variant="secondary">{billingGroup.name}</Badge>
            )}
          </TableCell>
        )
      case 'wallets':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant="secondary">{profile.wallets?.length || 0} wallets</Badge>
          </TableCell>
        )
      case 'addons':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant="secondary">{profile.addons?.length || 0} addons</Badge>
          </TableCell>
        )
      case 'createdAt':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {formatDate(profile.createdAt)}
          </TableCell>
        )
      case 'updatedAt':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {formatDate(profile.updatedAt)}
          </TableCell>
        )
      case 'deletedAt':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {profile.deletedAt ? formatDate(profile.deletedAt) : '-'}
          </TableCell>
        )
      case 'deletedBy':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 ${opacityClass}`} style={baseStyle}>
            {profile.deletedBy || '-'}
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 text-right ${stickyClass}`} style={baseStyle}>
            <div className="flex justify-end gap-2">
              {!profile.isDeleted ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(profile)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(profile.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => handleRestore(profile.id)}>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Restore
                </Button>
              )}
            </div>
          </TableCell>
        )
      default:
        return null
    }
  }

  const addWallet = () => {
    setWallets([
      ...wallets,
      {
        walletType: 'user',
        userWalletId: undefined,
        customWalletId: undefined,
        percentage: 0,
        icon: '',
        color: '',
        direction: 'in',
      },
    ]);
  };

  const removeWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const updateWallet = (index: number, field: keyof BillingProfileWallet, value: any) => {
    const updated = [...wallets];
    updated[index] = { ...updated[index], [field]: value };
    setWallets(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Profiles</h1>
          <p className="text-sm text-muted-foreground">Configure billing profiles with radius profiles, billing groups, wallets, and addons</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(value) => {setActiveTab(value); setCurrentPage(1);}}>
            <TabsList>
              <TabsTrigger value="active">
                <Receipt className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search profiles..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['billing-profiles'] })} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Toggle columns">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.name}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.description}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, description: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Description
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.price}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, price: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Price
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.radiusProfile}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, radiusProfile: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Radius Profile
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.billingGroup}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, billingGroup: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Billing Group
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.wallets}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, wallets: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Wallets
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.addons}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, addons: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Addons
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.createdAt}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, createdAt: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Created At
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.updatedAt}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, updatedAt: checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  Updated At
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Table settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleResetColumns}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Columns
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={activeTab === 'deleted'}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {activeTab === 'active' ? (
            isLoadingActive ? (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      {columnOrder.filter(col => col !== 'deletedAt' && col !== 'deletedBy').map((col) => (
                        <TableHead key={col} className="h-12 px-4" style={{ width: `${columnWidths[col as keyof typeof columnWidths]}px` }}>
                          <Skeleton className="h-4 w-20" />
                        </TableHead>
                      ))}
                      <TableHead className="h-12 px-4 sticky right-0 bg-muted" style={{ width: `${columnWidths.actions}px` }}>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {columnOrder.filter(col => col !== 'deletedAt' && col !== 'deletedBy').map((col) => (
                          <TableCell key={col} className="h-12 px-4" style={{ width: `${columnWidths[col as keyof typeof columnWidths]}px` }}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                        <TableCell className="h-12 px-4 sticky right-0 bg-background" style={{ width: `${columnWidths.actions}px` }}>
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : activeProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Receipt className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No billing profiles yet</h3>
                <p className="text-sm text-muted-foreground mb-6">Get started by creating your first billing profile</p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Profile
                </Button>
              </div>
            ) : (
              <>
                <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
                  {isFetchingActive && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <div className="bg-background p-4 rounded-lg shadow-lg">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium">Refreshing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow className="hover:bg-muted">
                        {columnOrder.filter(col => col !== 'deletedAt' && col !== 'deletedBy').map(column => renderColumnHeader(column))}
                        {renderColumnHeader('actions')}
                      </TableRow>
                    </TableHeader>
                    <TableBody style={{ height: `${rowVirtualizerActive.getTotalSize()}px`, position: 'relative' }}>
                      {rowVirtualizerActive.getVirtualItems().map((virtualRow) => {
                        const profile = activeProfiles[virtualRow.index];
                        return (
                          <TableRow 
                            key={profile.id}
                            className="border-b"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            {columnOrder.filter(col => col !== 'deletedAt' && col !== 'deletedBy').map(column => renderTableCell(column, profile))}
                            {renderTableCell('actions', profile)}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )
          ) : (
            isLoadingDeleted ? (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      {[...columnOrder, 'deletedAt', 'deletedBy'].map((col) => (
                        <TableHead key={col} className="h-12 px-4" style={{ width: `${columnWidths[col as keyof typeof columnWidths] || 140}px` }}>
                          <Skeleton className="h-4 w-20" />
                        </TableHead>
                      ))}
                      <TableHead className="h-12 px-4 sticky right-0 bg-muted" style={{ width: `${columnWidths.actions}px` }}>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {[...columnOrder, 'deletedAt', 'deletedBy'].map((col) => (
                          <TableCell key={col} className="h-12 px-4" style={{ width: `${columnWidths[col as keyof typeof columnWidths] || 140}px` }}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                        <TableCell className="h-12 px-4 sticky right-0 bg-background" style={{ width: `${columnWidths.actions}px` }}>
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-20 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : deletedProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Archive className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No deleted profiles</h3>
                <p className="text-sm text-muted-foreground">Deleted profiles will appear here</p>
              </div>
            ) : (
              <>
                <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
                  {isFetchingDeleted && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <div className="bg-background p-4 rounded-lg shadow-lg">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium">Refreshing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow className="hover:bg-muted">
                        {columnOrder.map(column => renderColumnHeader(column))}
                        {renderColumnHeader('deletedAt')}
                        {renderColumnHeader('deletedBy')}
                        {renderColumnHeader('actions')}
                      </TableRow>
                    </TableHeader>
                    <TableBody style={{ height: `${rowVirtualizerDeleted.getTotalSize()}px`, position: 'relative' }}>
                      {rowVirtualizerDeleted.getVirtualItems().map((virtualRow) => {
                        const profile = deletedProfiles[virtualRow.index];
                        return (
                          <TableRow 
                            key={profile.id}
                            className="border-b"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                              display: 'table',
                              tableLayout: 'fixed',
                            }}
                          >
                            {columnOrder.map(column => renderTableCell(column, profile))}
                            {renderTableCell('deletedAt', profile)}
                            {renderTableCell('deletedBy', profile)}
                            {renderTableCell('actions', profile)}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )
          )}
        </CardContent>
        
        {/* Pagination - Always visible outside scroll area */}
        {activeTab === 'active' && activePagination && activePagination.totalPages > 0 && !isLoadingActive && (
          <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                          <SelectTrigger className="h-8 w-[70px] text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="200">200</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="h-4 w-px bg-border" />
                      <div className="text-sm text-muted-foreground font-medium">
                        Showing {formatNumber(activeProfiles.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + activeProfiles.length)} of {formatNumber(activePagination.totalRecords)} profiles
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {getPaginationPages(currentPage, activePagination.totalPages).map((page, idx) => (
                        page === '...' ? (
                          <Button
                            key={`ellipsis-${idx}`}
                            variant="ghost"
                            size="icon"
                            disabled
                            className="h-8 w-8 p-0 text-sm"
                          >
                            ...
                          </Button>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setCurrentPage(page as number)}
                            className="h-8 w-8 p-0 text-sm font-medium"
                          >
                            {page}
                          </Button>
                        )
                      ))}
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.min(activePagination.totalPages, p + 1))}
                        disabled={currentPage === activePagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(activePagination.totalPages)}
                        disabled={currentPage === activePagination.totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

        {activeTab === 'deleted' && deletedPagination && deletedPagination.totalPages > 0 && !isLoadingDeleted && (
          <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-[70px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm text-muted-foreground font-medium">
                Showing {formatNumber(deletedProfiles.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + deletedProfiles.length)} of {formatNumber(deletedPagination.totalRecords)} profiles
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {getPaginationPages(currentPage, deletedPagination.totalPages).map((page, idx) => (
                page === '...' ? (
                  <Button
                    key={`ellipsis-${idx}`}
                    variant="ghost"
                    size="icon"
                    disabled
                    className="h-8 w-8 p-0 text-sm"
                  >
                    ...
                  </Button>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setCurrentPage(page as number)}
                    className="h-8 w-8 p-0 text-sm font-medium"
                  >
                    {page}
                  </Button>
                )
              ))}
              
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(deletedPagination.totalPages, p + 1))}
                disabled={currentPage === deletedPagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(deletedPagination.totalPages)}
                disabled={currentPage === deletedPagination.totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
      </Card>

      {/* Reset Columns Dialog */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Table Columns</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column widths, order, and visibility to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetColumns}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the billing profile to trash. You can restore it later from the
              Deleted Profiles tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Edit Billing Profile' : 'Create Billing Profile'}
            </DialogTitle>
            <DialogDescription>
              Configure billing profile with radius profile, billing group, wallets, and addons
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Billing Groups Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Billing Groups *</CardTitle>
                    <CardDescription>
                      Select billing groups or choose "All Groups"
                    </CardDescription>
                  </div>
                  <Popover open={billingGroupPopoverOpen} onOpenChange={setBillingGroupPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingBillingGroups || selectAllGroups}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Group
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search billing groups..." />
                        <CommandEmpty>No billing group found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          <CommandItem
                            value="all-groups"
                            onSelect={() => {
                              setSelectAllGroups(true);
                              setSelectedBillingGroups([]);
                              setBillingGroupPopoverOpen(false);
                            }}
                          >
                            <strong>All Groups</strong>
                          </CommandItem>
                          {billingGroupsData?.data?.map((group: any) => (
                            <CommandItem
                              key={group.id}
                              value={group.name}
                              onSelect={() => {
                                if (!selectedBillingGroups.includes(group.id)) {
                                  setSelectedBillingGroups(prev => [...prev, group.id]);
                                  setSelectAllGroups(false);
                                }
                                setBillingGroupPopoverOpen(false);
                              }}
                            >
                              {group.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectAllGroups ? (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">All Groups</div>
                          <div className="text-sm text-muted-foreground">
                            This profile applies to all billing groups
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectAllGroups(false)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {selectedBillingGroups.map((groupId) => {
                      const group = billingGroupsData?.data?.find((g: any) => g.id === groupId);
                      return group ? (
                        <Card key={groupId}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{group.name}</div>
                                {group.description && (
                                  <div className="text-sm text-muted-foreground">{group.description}</div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBillingGroups(prev => prev.filter(id => id !== groupId))}
                              >
                              <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null;
                    })}
                    {selectedBillingGroups.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No billing groups selected. Click "Add Group" to select a billing group or choose "All Groups".
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Radius Profiles Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Radius Profiles *</CardTitle>
                    <CardDescription>
                      Select radius profiles to associate with this billing profile
                    </CardDescription>
                  </div>
                  <Popover open={radiusProfilePopoverOpen} onOpenChange={setRadiusProfilePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingRadiusProfiles}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Profile
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search radius profiles..." />
                        <CommandEmpty>No radius profile found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {radiusProfilesData?.data?.map((profile: any) => (
                            <CommandItem
                              key={profile.id}
                              value={profile.name}
                              onSelect={() => {
                                if (!selectedRadiusProfiles.find(rp => rp.profileId === profile.id)) {
                                  setSelectedRadiusProfiles(prev => [...prev, {profileId: profile.id, number: 1}]);
                                }
                                setRadiusProfilePopoverOpen(false);
                              }}
                            >
                              {profile.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedRadiusProfiles.map((rp, index) => {
                  const profile = radiusProfilesData?.data?.find((p: any) => p.id === rp.profileId);
                  return profile ? (
                    <Card key={rp.profileId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{profile.name}</div>
                            {profile.price && (
                              <div className="text-sm text-muted-foreground">
                                Price: {currencySymbol}{profile.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <Label className="text-xs mb-1">Number</Label>
                              <Input
                                type="number"
                                min="1"
                                value={rp.number}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  setSelectedRadiusProfiles(prev => 
                                    prev.map(item => 
                                      item.profileId === rp.profileId 
                                        ? {...item, number: value}
                                        : item
                                    )
                                  );
                                }}
                                className="w-20"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRadiusProfiles(prev => prev.filter(item => item.profileId !== rp.profileId))}
                              className="mt-5"
                            >
                             <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null;
                })}
                {selectedRadiusProfiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No radius profiles added yet. Click "Add Profile" to select a radius profile.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Wallets Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Wallets Configuration</CardTitle>
                    <CardDescription>
                      Add wallets with pricing for each wallet type
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addWallet}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Wallet
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {wallets.map((wallet, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-[180px_2fr_150px_140px_auto] gap-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={wallet.walletType || 'user'}
                            onValueChange={(value) => {
                              const updated = [...wallets];
                              updated[index] = { 
                                ...updated[index], 
                                walletType: value,
                                userWalletId: undefined,
                                customWalletId: undefined
                              };
                              setWallets(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User Wallet</SelectItem>
                              <SelectItem value="custom">Custom Wallet</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Wallet Selection - conditionally render based on type */}
                        <div className="space-y-2">
                          {wallet.walletType === 'user' ? (
                            <>
                              <Label>User Wallet</Label>
                              <Select
                                key={`user-${index}`}
                                value={wallet.userWalletId?.toString() || ''}
                                onValueChange={(value) => updateWallet(index, 'userWalletId', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user wallet" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingUserWallets ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                  ) : userWalletsData?.data && userWalletsData.data.length > 0 ? (
                                    userWalletsData.data.map((uw) => (
                                      <SelectItem key={uw.id} value={uw.id!.toString()}>
                                        {uw.userName} - {uw.customWalletName}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No user wallets available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          ) : (
                            <>
                              <Label>Custom Wallet</Label>
                              <Select
                                key={`custom-${index}`}
                                value={wallet.customWalletId?.toString() || ''}
                                onValueChange={(value) => updateWallet(index, 'customWalletId', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select custom wallet" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingCustomWallets ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                  ) : customWalletsData?.data && customWalletsData.data.length > 0 ? (
                                    customWalletsData.data.map((cw) => (
                                      <SelectItem key={cw.id} value={cw.id!.toString()}>
                                        {cw.name} - {cw.type}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No custom wallets available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Direction</Label>
                          <Select
                            value={wallet.direction || 'in'}
                            onValueChange={(value) => updateWallet(index, 'direction', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in">In</SelectItem>
                              <SelectItem value="out">Out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={wallet.percentage}
                            onChange={(e) =>
                              updateWallet(index, 'percentage', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2 self-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWallet(index)}
                            className="h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {wallets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No wallets added yet. Click "Add Wallet" to add a wallet configuration.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Addons Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Addons</CardTitle>
                    <CardDescription>Select addons and set custom pricing</CardDescription>
                  </div>
                  <Popover open={addonPopoverOpen} onOpenChange={setAddonPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingAddons}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Addon
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search addons..." />
                        <CommandEmpty>No addon found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {addonsData?.data?.map((addon: Addon) => (
                            <CommandItem
                              key={addon.id}
                              value={addon.name}
                              onSelect={() => {
                                if (!selectedAddons.find(a => a.addonId === addon.id)) {
                                  setSelectedAddons(prev => [...prev, { addonId: addon.id!, price: addon.price, number: 1 }]);
                                }
                                setAddonPopoverOpen(false);
                              }}
                            >
                              {addon.name} - ${addon.price}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedAddons.map((selectedAddon, index) => {
                  const addon = addonsData?.data?.find((a: Addon) => a.id === selectedAddon.addonId);
                  return addon ? (
                    <Card key={selectedAddon.addonId}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <Label>Addon</Label>
                            <Input value={addon.name} disabled />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label>Custom Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={selectedAddon.price}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                setSelectedAddons(prev =>
                                  prev.map((a, i) => i === index ? { ...a, price: newPrice } : a)
                                );
                              }}
                              placeholder={`Default: $${addon.price}`}
                            />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label>Number</Label>
                            <Input
                              type="number"
                              min="1"
                              value={selectedAddon.number}
                              onChange={(e) => {
                                const newNumber = parseInt(e.target.value) || 1;
                                setSelectedAddons(prev =>
                                  prev.map((a, i) => i === index ? { ...a, number: newNumber } : a)
                                );
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAddons(prev => prev.filter((_, i) => i !== index))}
                            className="mt-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground mt-2">{addon.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : null;
                })}
                {selectedAddons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No addons added yet. Click "Add Addon" to select from available addons.
                  </p>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProfile ? 'Update Profile' : 'Create Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
