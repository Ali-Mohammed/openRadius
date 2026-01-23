import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronLeft, ChevronRight, Wallet, User, History, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { customWalletApi } from '@/api/customWallets'
import userWalletApi from '@/api/userWallets'
import { workspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function Balances() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentWorkspaceId } = useWorkspace()

  // Initialize state from URL params
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'))
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [walletType, setWalletType] = useState<'all' | 'custom' | 'user'>(() => (searchParams.get('type') as any) || 'all')

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (walletType !== 'all') params.type = walletType
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, walletType])

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع' : 'IQD'
      case 'USD':
      default:
        return '$'
    }
  }

  // Helper to format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: customWalletsData, isLoading: isLoadingCustom } = useQuery({
    queryKey: ['custom-wallets', currentWorkspaceId, currentPage, pageSize, searchQuery],
    queryFn: () => customWalletApi.getAll({
      search: searchQuery || undefined,
      page: currentPage,
      pageSize: pageSize,
    }),
    enabled: !!currentWorkspaceId && (walletType === 'all' || walletType === 'custom'),
  })

  const { data: userWalletsData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user-wallets', currentWorkspaceId, currentPage, pageSize, searchQuery],
    queryFn: () => userWalletApi.getAll({
      search: searchQuery || undefined,
      page: currentPage,
      pageSize: pageSize,
    }),
    enabled: !!currentWorkspaceId && (walletType === 'all' || walletType === 'user'),
  })

  // Combine wallets data
  const allWallets = useMemo(() => {
    const wallets: Array<{
      id: number
      name: string
      type: 'custom' | 'user'
      currentBalance: number
      maxFillLimit?: number
      dailySpendingLimit?: number
      userId?: number
      username?: string
      status?: string
    }> = []

    if (walletType === 'all' || walletType === 'custom') {
      const customWallets = customWalletsData?.data || []
      wallets.push(...customWallets.map(w => ({
        id: w.id,
        name: w.name,
        type: 'custom' as const,
        currentBalance: w.currentBalance,
        maxFillLimit: w.maxFillLimit,
        dailySpendingLimit: w.dailySpendingLimit,
        status: w.status,
      })))
    }

    if (walletType === 'all' || walletType === 'user') {
      const userWallets = userWalletsData?.data || []
      wallets.push(...userWallets.map(w => ({
        id: w.id,
        name: w.username || `User ${w.userId}`,
        type: 'user' as const,
        currentBalance: w.currentBalance,
        maxFillLimit: w.maxFillLimit,
        dailySpendingLimit: w.dailySpendingLimit,
        userId: w.userId,
        username: w.username,
        status: w.status,
      })))
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return wallets.filter(w => 
        w.name.toLowerCase().includes(query) ||
        w.username?.toLowerCase().includes(query)
      )
    }

    return wallets
  }, [customWalletsData, userWalletsData, walletType, searchQuery])

  const isLoading = isLoadingCustom || isLoadingUser

  // Pagination
  const totalItems = allWallets.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedWallets = allWallets.slice(startIndex, endIndex)

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: paginatedWallets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Handlers
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Balances</h1>
          <p className="text-muted-foreground">
            View all wallet balances across the system
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search wallets..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-8"
                />
              </div>
              <Button onClick={handleSearch} variant="secondary">
                Search
              </Button>
            </div>

            <Select value={walletType} onValueChange={(value: any) => {
              setWalletType(value)
              setCurrentPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Wallet Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wallets</SelectItem>
                <SelectItem value="custom">Custom Wallets</SelectItem>
                <SelectItem value="user">User Wallets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div
            ref={parentRef}
            className="relative border rounded-md"
            style={{ height: '600px', overflow: 'auto' }}
          >
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Max Fill Limit</TableHead>
                  <TableHead className="text-right">Daily Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedWallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No wallets found
                    </TableCell>
                  </TableRow>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const wallet = paginatedWallets[virtualRow.index]
                    return (
                      <TableRow
                        key={`${wallet.type}-${wallet.id}`}
                        data-index={virtualRow.index}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start - virtualRow.index * virtualRow.size}px)`,
                        }}
                      >
                        <TableCell>
                          <Badge variant={wallet.type === 'custom' ? 'default' : 'secondary'}>
                            {wallet.type === 'custom' ? (
                              <><Wallet className="h-3 w-3 mr-1" /> Custom</>
                            ) : (
                              <><User className="h-3 w-3 mr-1" /> User</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{wallet.name}</TableCell>
                        <TableCell>{wallet.username || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={wallet.currentBalance < 0 ? 'text-destructive' : ''}>
                            {currencySymbol} {formatCurrency(wallet.currentBalance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {wallet.maxFillLimit ? `${currencySymbol} ${formatCurrency(wallet.maxFillLimit)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {wallet.dailySpendingLimit ? `${currencySymbol} ${formatCurrency(wallet.dailySpendingLimit)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {wallet.status ? (
                            <Badge variant={wallet.status === 'active' ? 'default' : 'secondary'}>
                              {wallet.status}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/billing/history?walletType=${wallet.type}&walletId=${wallet.id}`)}
                              title="View History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/billing/transactions?walletType=${wallet.type}&walletId=${wallet.id}`)}
                              title="View Transactions"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && totalItems > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} wallets
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Rows per page</p>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
