import { useState } from 'react';
import { BeatLoader } from 'react-spinners';
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
import { Button } from '@/components/ui/button'
import { Calendar } from "@/components/ui/calendar"
import { Edit, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronUp, CalendarIcon, X, Search } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { tr } from "date-fns/locale"


export function CustomerTable({
  customers,
  onEdit,
  onDelete,
  onAddService,
  onViewServices,
  isLoading = false,
  // Add props for server-side filtering
  searchTerm,
  onSearchChange,
  onSearch, // Add search trigger prop
  statusFilter,
  onStatusChange,
  dateRangeFilter,
  onDateRangeChange,
  // Add clear filters prop
  onClearFilters
}) {
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const statusTranslations = {
    active: 'Aktif',
    inactive: 'Pasif',
    overdue: 'Süresi Dolmuş',
    all: 'Tüm durumlar'
  };

  const getStatusText = (status) => {
    return statusTranslations[status] || status;
  };

  const togglePasswordVisibility = (customerId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <ChevronDown className="h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ?
      <ChevronUp className="h-4 w-4" /> :
      <ChevronDown className="h-4 w-4" />;
  };

  const sortCustomers = (customers) => {
    if (!sortConfig.key) {
      // Default sort by creation date (newest first) when no sort is applied
      return [...customers].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    return [...customers].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle null or undefined signBoard values for sorting
      if (sortConfig.key === 'signBoard') {
        aValue = a.signBoard || '';
        bValue = b.signBoard || '';
      }

      if (sortConfig.key === 'status') {
        aValue = getCustomerStatus(a);
        bValue = getCustomerStatus(b);
      }

      if (sortConfig.key === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLocaleLowerCase('tr-TR');
        bValue = bValue.toLocaleLowerCase('tr-TR');
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const statusColors = {
    active: 'bg-green-500/20 text-green-600 dark:text-green-400',
    inactive: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
    overdue: 'bg-red-500/20 text-red-600 dark:text-red-400',
  };

  const actionButtonColors = {
    edit: 'hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400',
    delete: 'hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
    add: 'hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400',
    view: 'hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400',
  };

  const getCustomerStatus = (customer) => {
    const today = new Date();
    let hasActive = false;
    let hasOverdue = false;

    if (customer.services?.length > 0) {
      for (const service of customer.services) {
        const startDate = new Date(service.startingDate);
        const endDate = new Date(service.endingDate);

        if (startDate <= today && today <= endDate) hasActive = true;
        if (endDate < today) hasOverdue = true;
      }
    }

    if (hasActive) return 'active';
    if (hasOverdue) return 'overdue';
    return 'inactive';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: tr });
  };

  // Remove client-side filtering - data is already filtered server-side
  const filteredCustomers = sortCustomers(customers);


  return (
    <div className="space-y-4 relative">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 max-w-sm">
          <Input
            placeholder="Müşteri ara (ID, ad, email, telefon...)..."
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
            <SelectValue placeholder="Durum filtrele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{statusTranslations.all}</SelectItem>
            <SelectItem value="active">{statusTranslations.active}</SelectItem>
            <SelectItem value="inactive">{statusTranslations.inactive}</SelectItem>
            <SelectItem value="overdue">{statusTranslations.overdue}</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[260px] justify-start text-left font-normal",
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
                <span>Bir tarih aralığı seç</span>
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

        {/* Clear Filters Button */}
        {(statusFilter !== 'all' || dateRangeFilter?.from) && (
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
              <TableHead
                className="w-[200px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Müşteri adı
                  <SortIcon column="name" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('signBoard')}
              >
                <div className="flex items-center gap-1">
                  Tabela Adı
                  <SortIcon column="signBoard" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Durum
                  <SortIcon column="status" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center gap-1">
                  Email
                  <SortIcon column="email" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center gap-1">
                  Telefon
                  <SortIcon column="phone" />
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
              <TableHead className="w-[200px]">
                Şifre
              </TableHead>
              <TableHead className="text-right">
                İşlemler
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredCustomers.map((customer) => {
              const status = getCustomerStatus(customer);
              return (
                <TableRow
                  key={customer.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{customer.name}</span>
                      {customer.services?.length > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          title={`${customer.services.length} hizmet`}
                        >
                          {customer.services.length}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground/80">{customer.signBoard || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${statusColors[status]} rounded-md px-2 py-1 text-xs font-medium`}
                    >
                      {getStatusText(status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80">{customer.email}</TableCell>
                  <TableCell className="text-foreground/80">{customer.phone}</TableCell>
                  <TableCell className="text-foreground/80">{formatDate(customer.createdAt)}</TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {visiblePasswords[customer.id] ? customer.password : '••••••••'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePasswordVisibility(customer.id)}
                        className="h-6 w-6 p-0 hover:bg-foreground/10"
                      >
                        {visiblePasswords[customer.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(customer)}
                      className={`h-8 w-8 p-0 ${actionButtonColors.edit}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(customer)}
                      className={`h-8 w-8 p-0 ${actionButtonColors.delete} ${
                        customer.services?.length > 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={
                        customer.services?.length > 0 
                          ? `Bu müşteriyi silmek için önce ${customer.services.length} hizmetini silmelisiniz`
                          : 'Müşteriyi sil'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddService(customer)}
                      className={`h-8 w-8 p-0 ${actionButtonColors.add}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewServices(customer)}
                      className={`h-8 w-8 p-0 ${actionButtonColors.view}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}