import { BeatLoader } from 'react-spinners'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye, ChevronDown, ChevronUp, Info, Key, Copy, X, Search, Plus, RefreshCw, Archive, CalendarPlus } from 'lucide-react'
import { format } from "date-fns"
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from "@/lib/utils"
import { tr } from 'date-fns/locale'
import { copyToClipboard } from '@/lib/clipboard'

const statusColors = {
    active: 'bg-green-500/20 text-green-600 dark:text-green-400',
    upcoming: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    expired: 'bg-red-500/20 text-red-600 dark:text-red-400',
    inactive: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
    notStarted: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
}

const paymentTypeColors = {
    '1month': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    '6months': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    '1year': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    '2years': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    '3years': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'unlimited': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'custom': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

const paymentTypeLabels = {
    '1month': '1 Ay',
    '6months': '6 Ay',
    '1year': '1 Yıl',
    '2years': '2 Yıl',
    '3years': '3 Yıl',
    'unlimited': 'Sınırsız',
    'custom': 'Özel'
}

const UNLIMITED_END_DATE = new Date('9999-12-31T00:00:00.000Z')

const categoryColors = {
    'Adisyon Programı': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Digital Menü': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'Platform Entegrasyon': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    'QR Menu': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', // Legacy support
    'Kurye Sipariş Uygulaması': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    'Kurye Uygulaması': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300', // Legacy support
    'Patron Takip Uygulaması': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'Patron Uygulaması': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', // Legacy support
    'Garson Sipariş Uygulaması': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Android Caller ID Uygulaması': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Yazarkasa Pos Entegrasyonu': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
    'Yemek Sepeti': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Migros Yemek': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
    'Trendyol Yemek': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Getir Yemek': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
}

export function ServiceTable({
    services,
    customers,
    onEdit,
    onDelete,
    isLoading = false,
    onViewHistory,
    sortBy,
    sortOrder,
    onSort,
    // Add props for server-side filtering
    searchTerm,
    onSearchChange,
    onSearch, // Add search trigger prop
    statusFilter,
    onStatusChange,
    categoryFilter,
    onCategoryChange,
    dateRangeFilter,
    onDateRangeChange,
    endDateRangeFilter,
    onEndDateRangeChange,
    lastLoginDateRangeFilter,
    onLastLoginDateRangeChange,
    // Add clear filters prop
    onClearFilters,
    // Add bulk service modal prop
    onOpenBulkService,
    // Add bulk convert prop
    onBulkConvert,
    onBulkExtend,
    onBulkArchive,
    onBulkDelete,
    archiveActionLabel = 'Arşive taşı'
}) {
    // Remove client-side filter states - they'll come from props now

    const [selectedServiceIds, setSelectedServiceIds] = useState([]);

    // Check if any service has a deviceToken
    const hasDeviceTokens = services.some(service => service.deviceToken);

    // Get unique categories from services
    const availableCategories = [...new Set(services.map(service => service.category || 'Adisyon Programı'))];

    // Helper function to get text color for categories
    const getCategoryTextColor = (category) => {
        const colorMap = {
            'Adisyon Programı': 'text-blue-600',
            'Digital Menü': 'text-green-600',
            'Platform Entegrasyon': 'text-emerald-600',
            'QR Menu': 'text-green-600', // Legacy support
            'Kurye Sipariş Uygulaması': 'text-cyan-600',
            'Kurye Uygulaması': 'text-cyan-600', // Legacy support
            'Patron Takip Uygulaması': 'text-purple-600',
            'Patron Uygulaması': 'text-purple-600', // Legacy support
            'Garson Sipariş Uygulaması': 'text-indigo-600',
            'Android Caller ID Uygulaması': 'text-teal-600',
            'Yazarkasa Pos Entegrasyonu': 'text-slate-600',
            'Yemek Sepeti': 'text-red-600',
            'Migros Yemek': 'text-orange-600',
            'Trendyol Yemek': 'text-orange-600',
            'Getir Yemek': 'text-yellow-600'
        };
        return colorMap[category] || 'text-gray-600';
    };

    const getServiceStatus = (service) => {
        // First check if the service is explicitly set as inactive
        if (service.active === false) return 'inactive'
        
        const today = new Date()
        const startDate = new Date(service.startingDate)
        const endDate = new Date(service.endingDate)

        // If service hasn't started yet, it's not started
        if (today < startDate) {
            return 'notStarted'
        }
        
        // If service has already expired, it's expired
        if (today > endDate) {
            return 'expired'
        }
        
        // Check if service is expiring within 1 month (30 days)
        const oneMonthFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000))
        
        if (endDate <= oneMonthFromNow) {
            return 'upcoming'
        }
        
        return 'active'
    }

    const handleSort = (key) => {
        if (onSort) {
            onSort(key);
        }
    }

    const SortIcon = ({ column }) => {
        if (sortBy !== column) return <ChevronDown className="h-4 w-4 opacity-30" />
        return sortOrder === 'asc'
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
    }

    // Remove client-side filtering - data is already filtered server-side
    const filteredServices = services;

    const toggleSelectAll = () => {
        if (selectedServiceIds.length === filteredServices.length) {
            setSelectedServiceIds([]);
        } else {
            setSelectedServiceIds(filteredServices.map(s => s.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedServiceIds(prev => 
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const handleBulkConvertClick = () => {
        if (onBulkConvert) {
            const selected = services.filter(s => selectedServiceIds.includes(s.id));
            onBulkConvert(selected);
        }
    };

    const handleBulkExtendClick = () => {
        if (onBulkExtend) {
            const selected = services.filter((s) => selectedServiceIds.includes(s.id));
            onBulkExtend(selected);
        }
    };

    const handleBulkArchiveClick = async () => {
        if (!onBulkArchive) {
            return;
        }

        const selected = services.filter((s) => selectedServiceIds.includes(s.id));
        await onBulkArchive(selected);
        setSelectedServiceIds([]);
    };

    const handleBulkDeleteClick = async () => {
        if (!onBulkDelete) {
            return;
        }

        const selected = services.filter((s) => selectedServiceIds.includes(s.id));
        await onBulkDelete(selected);
        setSelectedServiceIds([]);
    };


    return (
        <TooltipProvider>
            <div className="space-y-4 relative">
                <div className="flex gap-2 flex-wrap items-center">
                    {/* Bulk Actions */}
                    {selectedServiceIds.length > 0 && (
                        <div className="flex items-center gap-2 mr-2 bg-muted/50 p-1 rounded-md">
                            <span className="text-sm font-medium px-2">{selectedServiceIds.length} seçildi</span>
                            <Button 
                                size="sm" 
                                onClick={handleBulkConvertClick}
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Seçilenleri Dönüştür
                            </Button>
                            {onBulkExtend && (
                                <Button
                                    size="sm"
                                    onClick={handleBulkExtendClick}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Lisans Uzat
                                </Button>
                            )}
                            {onBulkArchive && (
                                <Button
                                    size="sm"
                                    onClick={handleBulkArchiveClick}
                                    className="bg-slate-700 hover:bg-slate-800 text-white"
                                >
                                    <Archive className="mr-2 h-4 w-4" />
                                    {archiveActionLabel}
                                </Button>
                            )}
                            {onBulkDelete && (
                                <Button
                                    size="sm"
                                    onClick={handleBulkDeleteClick}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Seçilenleri Sil
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedServiceIds([])}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex gap-1 max-w-sm">
                        <Input
                            placeholder="Hizmet ara (ID, ad, açıklama...)..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
                            className="focus-visible:ring-2"
                        />
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onSearch?.()}
                            className="px-3"
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <Select value={statusFilter} onValueChange={onStatusChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Duruma göre filtrele" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="upcoming">Yaklaşan</SelectItem>
                            <SelectItem value="notStarted">Başlamadı</SelectItem>
                            <SelectItem value="expired">Süresi Dolmuş</SelectItem>
                            <SelectItem value="inactive">Pasif</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={categoryFilter} onValueChange={onCategoryChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Kategoriye göre filtrele" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kategoriler</SelectItem>
                            {availableCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                    <span className={getCategoryTextColor(category)}>
                                        {category}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !dateRangeFilter?.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRangeFilter?.from ? (
                                    dateRangeFilter.to ? (
                                        <>
                                            {format(dateRangeFilter.from, "dd MMMM yyyy", { locale: tr })} -{" "}
                                            {format(dateRangeFilter.to, "dd MMMM yyyy", { locale: tr })}
                                        </>
                                    ) : (
                                        format(dateRangeFilter.from, "dd MMMM yyyy", { locale: tr })
                                    )
                                ) : (
                                    <span>Başlangıç tarihine göre filtrele</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRangeFilter?.from}
                                selected={dateRangeFilter}
                                onSelect={onDateRangeChange}
                                numberOfMonths={2}
                                locale={tr}
                            />
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !endDateRangeFilter?.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDateRangeFilter?.from ? (
                                    endDateRangeFilter.to ? (
                                        <>
                                            {format(endDateRangeFilter.from, "dd MMMM yyyy", { locale: tr })} -{" "}
                                            {format(endDateRangeFilter.to, "dd MMMM yyyy", { locale: tr })}
                                        </>
                                    ) : (
                                        format(endDateRangeFilter.from, "dd MMMM yyyy", { locale: tr })
                                    )
                                ) : (
                                    <span>Bitiş tarihine göre filtrele</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={endDateRangeFilter?.from}
                                selected={endDateRangeFilter}
                                onSelect={onEndDateRangeChange}
                                numberOfMonths={2}
                                locale={tr}
                            />
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !lastLoginDateRangeFilter?.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {lastLoginDateRangeFilter?.from ? (
                                    lastLoginDateRangeFilter.to ? (
                                        <>
                                            {format(lastLoginDateRangeFilter.from, "dd MMMM yyyy", { locale: tr })} -{" "}
                                            {format(lastLoginDateRangeFilter.to, "dd MMMM yyyy", { locale: tr })}
                                        </>
                                    ) : (
                                        format(lastLoginDateRangeFilter.from, "dd MMMM yyyy", { locale: tr })
                                    )
                                ) : (
                                    <span>Son giriş tarihine göre filtrele</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={lastLoginDateRangeFilter?.from}
                                selected={lastLoginDateRangeFilter}
                                onSelect={onLastLoginDateRangeChange}
                                numberOfMonths={2}
                                locale={tr}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Clear Filters Button */}
                    {(statusFilter !== 'all' || categoryFilter !== 'all' || dateRangeFilter?.from || endDateRangeFilter?.from || lastLoginDateRangeFilter?.from) && (
                      <Button 
                        variant="outline" 
                        onClick={onClearFilters}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Filtreleri Temizle
                      </Button>
                    )}
                </div>

                <div className="relative rounded-lg border shadow-sm">
                    {isLoading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                            <BeatLoader color="#f26000" className="opacity-75" />
                        </div>
                    )}

                    <Table>
                        <TableHeader className="bg-background">
                            <TableRow>
                                <TableHead className="w-[50px] text-center p-2 pl-3">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-medium text-muted-foreground">Seçim</span>
                                        <Checkbox 
                                            checked={filteredServices.length > 0 && selectedServiceIds.length === filteredServices.length}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Tümünü seç"
                                        />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="w-[80px] cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center gap-1">
                                        ID
                                        <SortIcon column="id" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Hizmet Adı
                                        <SortIcon column="name" />
                                    </div>
                                </TableHead>
                                <TableHead>Açıklama</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('companyName')}
                                >
                                    <div className="flex items-center gap-1">
                                        İşletme Adı
                                        <SortIcon column="companyName" />                                        </div>
                                    </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('category')}
                                >
                                    <div className="flex items-center gap-1">
                                        Kategori
                                        <SortIcon column="category" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('customerID')}
                                >
                                    <div className="flex items-center gap-1">
                                        Müşteri
                                        <SortIcon column="customerID" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('paymentType')}
                                >
                                    <div className="flex items-center gap-1">
                                        Ödeme
                                        <SortIcon column="paymentType" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('createdAt')}
                                >
                                    <div className="flex items-center gap-1">
                                        Oluşturulma Tarihi
                                        <SortIcon column="createdAt" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('startingDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Tarihler
                                        <SortIcon column="startingDate" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('endingDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Durum
                                        <SortIcon column="endingDate" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('lastLoginDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Son Giriş Tarihi
                                        <SortIcon column="lastLoginDate" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('version')}
                                >
                                    <div className="flex items-center gap-1">
                                        Versiyon
                                        <SortIcon column="version" />
                                    </div>
                                </TableHead>
                                {hasDeviceTokens && (
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort('deviceToken')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Cihaz Token
                                            <SortIcon column="deviceToken" />
                                        </div>
                                    </TableHead>
                                )}
                                {onOpenBulkService && (
                                    <TableHead className="w-[60px]">
                                        <div className="flex items-center justify-center">
                                            Toplu
                                        </div>
                                    </TableHead>
                                )}
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {filteredServices.map((service) => {
                                const status = getServiceStatus(service)
                                const customer = service.customer || customers.find(c => c.id === service.customerID)
                                const isActive = status === 'active'

                                return (
                                    <TableRow key={service.id} className={`hover:bg-muted/50 transition-colors ${selectedServiceIds.includes(service.id) ? 'bg-muted/50' : ''}`}>
                                        <TableCell className="pl-4">
                                            <Checkbox 
                                                checked={selectedServiceIds.includes(service.id)}
                                                onCheckedChange={() => toggleSelect(service.id)}
                                                aria-label={`Select service ${service.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <span className="font-mono text-xs">
                                                            {service.id.toString().substring(0, 3)}...
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{service.id}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(service.id.toString(), "Servis ID kopyalandı!")}
                                                    className="h-6 w-6 p-0 hover:bg-gray-100"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{service.name}</TableCell>
                                        <TableCell>
                                            {service.description ? (
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-[300px]">{service.description}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {service.companyName || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge 
                                                className={`text-xs font-medium ${categoryColors[service.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`}
                                            >
                                                {service.category || 'Adisyon Programı'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{customer?.name || 'Bilinmeyen Müşteri'}</TableCell>
                                        <TableCell>
                                            <Badge className={paymentTypeColors[service.paymentType]}>
                                                {paymentTypeLabels[service.paymentType]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <time className="text-sm">
                                                {service.createdAt ? format(new Date(service.createdAt), 'dd/MM/yyyy') : '-'}
                                            </time>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <time className="text-sm">
                                                    {format(new Date(service.startingDate), 'dd/MM/yyyy')}
                                                </time>
                                                <time className="text-xs text-muted-foreground">
                                                    {service.paymentType === 'unlimited'
                                                        ? 'Sınırsız'
                                                        : format(new Date(service.endingDate), 'dd/MM/yyyy')}
                                                </time>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`${statusColors[status]} rounded-md px-2 py-1 text-xs font-medium`}>
                                                {status === 'active' ? 'Aktif' : 
                                                 status === 'upcoming' ? 'Yaklaşan' : 
                                                 status === 'expired' ? 'Süresi Dolmuş' :
                                                 status === 'inactive' ? 'Pasif' : 
                                                 status === 'notStarted' ? 'Başlamadı' : status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {service.lastLoginDate ? (
                                                <div className="flex flex-col">
                                                    <time className="text-sm">
                                                        {format(new Date(service.lastLoginDate), 'dd/MM/yyyy')}
                                                    </time>
                                                    <time className="text-xs text-muted-foreground">
                                                        {format(new Date(service.lastLoginDate), 'HH:mm')}
                                                    </time>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Hiç giriş yapılmamış</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {service.version ? (
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {service.version}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        {hasDeviceTokens && (
                                            <TableCell>
                                                {service.deviceToken ? (
                                                    <div className="flex items-center gap-2">
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div className="flex items-center gap-1">
                                                                    <Key className="h-4 w-4 text-emerald-500" />
                                                                    <span className="font-mono text-xs truncate max-w-[120px]">
                                                                        {service.deviceToken.substring(0, 8)}...
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="font-mono text-xs break-all max-w-[300px]">{service.deviceToken}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(service.deviceToken, "Device token kopyalandı!")}
                                                            className="h-6 w-6 p-0 hover:bg-gray-100"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                        )}
                                        {onOpenBulkService && (
                                            <TableCell className="text-center">
                                                {customer && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onOpenBulkService(customer, service)}
                                                        className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
                                                        title="Bu müşteri için toplu hizmet tanımla"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onViewHistory(service)}
                                                    className="h-8 w-8 p-0 hover:bg-purple-100 hover:text-purple-600"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEdit(service)}
                                                    className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onDelete(service)}
                                                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </TooltipProvider>
    )
}