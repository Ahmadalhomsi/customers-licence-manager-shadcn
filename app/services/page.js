"use client"

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceTable } from '@/components/servicesPage/ServicesTable'
import { ServiceModal2 } from '@/components/servicesPage/ServiceModal2'
import { BulkServiceModal } from '@/components/servicesPage/BulkServiceModal'
import { BulkConvertModal } from '@/components/servicesPage/BulkConvertModal'
import { DeleteConfirmModal } from '@/components/mainPage/DeleteConfirmModal'
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { RenewHistoryModal } from '@/components/RenewHistoryModal'
import { DeviceTokenConflictModal } from '@/components/servicesPage/DeviceTokenConflictModal'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'


export default function ServicesPage() {
  const [services, setServices] = useState([])
  const [serviceModalVisible, setServiceModalVisible] = useState(false)
  const [bulkServiceModalVisible, setBulkServiceModalVisible] = useState(false)
  const [bulkConvertModalVisible, setBulkConvertModalVisible] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])

  const [renewHistoryOpen, setRenewHistoryOpen] = useState(false)
  const [selectedServiceForHistory, setSelectedServiceForHistory] = useState(null)
  const [renewHistory, setRenewHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [permissions, setPermissions] = useState(null);
  const [selectedCustomerForBulk, setSelectedCustomerForBulk] = useState(null);
  const [selectedServiceForBulk, setSelectedServiceForBulk] = useState(null);
  const [selectedServicesForConvert, setSelectedServicesForConvert] = useState([]);
  const [deviceTokenConflictModalVisible, setDeviceTokenConflictModalVisible] = useState(false);

  // Pagination states
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  // Add additional filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState();
  const [endDateRangeFilter, setEndDateRangeFilter] = useState();
  const [lastLoginDateRangeFilter, setLastLoginDateRangeFilter] = useState();

  useEffect(() => {
    // Global keyboard shortcuts setup only
    const handleKeyDown = (event) => {
      // Ctrl+F or Cmd+F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        document.querySelector('input[placeholder*="Hizmet ara"]')?.focus();
      }
      // Ctrl+Enter or Cmd+Enter to search
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        // Use a simple function call here instead of handleSearch
        document.querySelector('input[placeholder*="Hizmet ara"] + button')?.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [])

  // Trigger filtering when filter values change (including when changing to 'all')
  useEffect(() => {
    handleFilterChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, dateRangeFilter, endDateRangeFilter, lastLoginDateRangeFilter]);

  const fetchAdminData = async () => {
    try {
      const res = await fetch("/api/auth/me");

      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    }
  };

  const fetchServices = useCallback(async (page = 1, search = '', sortField = sortBy, order = sortOrder, limit = pageSize) => {
    try {
      setLoading(true)
      
      // Validate page parameter
      const validPage = Math.max(1, parseInt(page) || 1);
      
      const params = new URLSearchParams({
        page: validPage.toString(),
        limit: limit.toString(),
        search,
        sortBy: sortField,
        sortOrder: order
      });

      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      // Add category filter if not 'all'
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      // Add date filters if set
      if (dateRangeFilter?.from) {
        params.append('startDateFrom', dateRangeFilter.from.toISOString());
      }
      if (dateRangeFilter?.to) {
        params.append('startDateTo', dateRangeFilter.to.toISOString());
      }
      if (endDateRangeFilter?.from) {
        params.append('endDateFrom', endDateRangeFilter.from.toISOString());
      }
      if (endDateRangeFilter?.to) {
        params.append('endDateTo', endDateRangeFilter.to.toISOString());
      }
      
      // Add last login date filters if set
      if (lastLoginDateRangeFilter?.from) {
        params.append('lastLoginDateFrom', lastLoginDateRangeFilter.from.toISOString());
      }
      if (lastLoginDateRangeFilter?.to) {
        params.append('lastLoginDateTo', lastLoginDateRangeFilter.to.toISOString());
      }
      
      const response = await axios.get(`/api/services?${params}`)
      
      // Update services and pagination
      setServices(response.data.services || [])
      const newPagination = response.data.pagination || {
        page: 1,
        limit: pageSize,
        total: 0,
        totalPages: 0
      }
      
      // Check if current page exceeds total pages and redirect to last page
      if (newPagination.totalPages > 0 && validPage > newPagination.totalPages) {
        // Recursively fetch the last valid page
        return fetchServices(newPagination.totalPages, search, sortField, order, limit);
      }
      
      setPagination(newPagination)
    } catch (error) {
      if (error.response.status === 403)
        toast.error('Yasak: Hizmet görüntüleme izniniz yok')
    }
    setLoading(false)
  }, [sortBy, sortOrder, pageSize, statusFilter, categoryFilter, dateRangeFilter, endDateRangeFilter, lastLoginDateRangeFilter])

  // Enhanced search handlers - now server-side with button/enter trigger
  const handleSearch = useCallback(() => {
    // Always use server-side search with current filters
    fetchServices(1, searchTerm, sortBy, sortOrder, pageSize);
  }, [fetchServices, searchTerm, sortBy, sortOrder, pageSize]);

  // Initial data loading - run once on mount
  useEffect(() => {
    const initialLoad = async () => {
      try {
        setLoading(true)
        
        const params = new URLSearchParams({
          page: '1',
          limit: '20', // Use default page size for initial load
          search: '',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });
        
        const response = await axios.get(`/api/services?${params}`)
        setServices(response.data.services || [])
        setPagination(response.data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        })
        
        setLoading(false)
      } catch (error) {
        console.error('Error loading initial services:', error)
        setLoading(false)
      }
    }
    
    initialLoad()
    fetchCustomers()
    fetchAdminData();
  }, [])

  // Setup keyboard shortcuts after functions are defined
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+F or Cmd+F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        document.querySelector('input[placeholder*="Hizmet ara"]')?.focus();
      }
      // Ctrl+Enter or Cmd+Enter to search
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSearch])

  const fetchCustomers = async () => {
    try {
      // Fetch all customers without pagination limit for the modal
      const response = await axios.get('/api/customers?limit=1000')
      // Handle the new pagination response structure
      setCustomers(response.data.customers || response.data || [])
    } catch (error) {
      if (error.response?.status === 403)
        toast.error('Yasak: Müşterileri görüntüleme izniniz yok')
      else
        console.log('Error fetching customers:', error)
    }
  }

  const fetchRenewHistory = async (serviceId) => {
    try {
      setLoadingHistory(true)
      const response = await axios.get(`/api/renew-histories/${serviceId}`)
      setRenewHistory(response.data)
    } catch (error) {
      if (error.response.status === 403)
        toast.error('Yasak: Yenileme geçmişini görüntüleme izniniz yok')
      else
        console.log('Error fetching renew history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDelete = async () => {
    if (selectedService) {
      try {
        await axios.delete(`/api/services/${selectedService.id}`)
        fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
        setDeleteConfirmVisible(false)
      } catch (error) {
        console.log('Error deleting service:', error)
      }
    }
  }

  const handleSubmit = async (formData) => {
    try {
      if (selectedService) {
        await axios.put(`/api/services/${selectedService.id}`, formData)
      } else {
        await axios.post('/api/services', formData)
      }
      await fetchServices(pagination.page, searchTerm, sortBy, sortOrder) // Ensure fetch completes before closing modal
      setServiceModalVisible(false)
      setSelectedService(null)
    } catch (error) {
      console.log('Error submitting service:', error)
      alert('Failed to save service. Please try again.') // User feedback
    }
  }

  const handleBulkSubmit = async (servicesData) => {
    try {
      // Use the bulk API endpoint for better performance and transaction safety
      const response = await axios.post('/api/services/bulk', { services: servicesData })
      
      // Refresh the services list
      await fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
      setBulkServiceModalVisible(false)
      setSelectedCustomerForBulk(null) // Reset selected customer
      
      return response.data
    } catch (error) {
      console.error('Error in bulk service creation:', error)
      throw error // Re-throw to be handled by the modal
    }
  }

  const handleOpenBulkServiceForCustomer = (customer, service = null) => {
    setSelectedCustomerForBulk(customer)
    setSelectedServiceForBulk(service)
    setBulkServiceModalVisible(true)
  }

  const handleBulkConvert = (selectedServices) => {
    setSelectedServicesForConvert(selectedServices);
    setBulkConvertModalVisible(true);
  };

  const handleBulkArchive = async (selectedServices) => {
    if (!selectedServices?.length) return;

    try {
      await axios.put('/api/services/archive', {
        serviceIds: selectedServices.map((service) => service.id),
        archived: true
      });

      toast.success(`${selectedServices.length} hizmet arşive taşındı`);
      fetchServices(pagination.page, searchTerm, sortBy, sortOrder);
    } catch (error) {
      console.error('Error archiving services:', error);
      toast.error('Hizmetler arşive taşınırken hata oluştu');
    }
  };

  const handleBulkDelete = async (selectedServices) => {
    if (!selectedServices?.length) return;

    const confirmed = window.confirm(`${selectedServices.length} hizmet kalici olarak silinsin mi?`);
    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(
        selectedServices.map((service) => axios.delete(`/api/services/${service.id}`))
      );

      toast.success(`${selectedServices.length} hizmet silindi`);
      fetchServices(pagination.page, searchTerm, sortBy, sortOrder);
    } catch (error) {
      console.error('Error deleting services:', error);
      toast.error('Seçili hizmetler silinirken hata oluştu');
    }
  };

  const handleFilterChange = () => {
    // Apply filters on server-side - user needs to click search or press enter for search
    fetchServices(1, searchTerm, sortBy, sortOrder, pageSize);
  };

  // Helper function to apply client-side filtering on fetched data (minimal, just for status/category/dates)
  const getFilteredServices = () => {
    let filtered = services;

    // Apply status filter (client-side for UI responsiveness)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => {
        const status = getServiceStatus(service);
        return status === statusFilter;
      });
    }

    // Apply category filter (client-side for UI responsiveness)
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => {
        const serviceCategory = service.category || 'Adisyon Programı';
        return serviceCategory === categoryFilter;
      });
    }

    // Apply start date filter (client-side for UI responsiveness)
    if (dateRangeFilter?.from || dateRangeFilter?.to) {
      filtered = filtered.filter(service => {
        const serviceStart = new Date(service.startingDate);
        
        if (dateRangeFilter?.from && dateRangeFilter?.to) {
          return serviceStart >= dateRangeFilter.from && serviceStart <= dateRangeFilter.to;
        } else if (dateRangeFilter?.from) {
          return serviceStart >= dateRangeFilter.from;
        } else if (dateRangeFilter?.to) {
          return serviceStart <= dateRangeFilter.to;
        }
        return true;
      });
    }

    // Apply end date filter (client-side for UI responsiveness)
    if (endDateRangeFilter?.from || endDateRangeFilter?.to) {
      filtered = filtered.filter(service => {
        const serviceEnd = new Date(service.endingDate);
        
        if (endDateRangeFilter?.from && endDateRangeFilter?.to) {
          return serviceEnd >= endDateRangeFilter.from && serviceEnd <= endDateRangeFilter.to;
        } else if (endDateRangeFilter?.from) {
          return serviceEnd >= endDateRangeFilter.from;
        } else if (endDateRangeFilter?.to) {
          return serviceEnd <= endDateRangeFilter.to;
        }
        return true;
      });
    }

    // Apply last login date filter (client-side for UI responsiveness)
    if (lastLoginDateRangeFilter?.from || lastLoginDateRangeFilter?.to) {
      filtered = filtered.filter(service => {
        if (!service.lastLoginDate) {
          // If service has no last login date, it should only be included if we're filtering for services with no login
          return false;
        }
        
        const serviceLastLogin = new Date(service.lastLoginDate);
        
        if (lastLoginDateRangeFilter?.from && lastLoginDateRangeFilter?.to) {
          return serviceLastLogin >= lastLoginDateRangeFilter.from && serviceLastLogin <= lastLoginDateRangeFilter.to;
        } else if (lastLoginDateRangeFilter?.from) {
          return serviceLastLogin >= lastLoginDateRangeFilter.from;
        } else if (lastLoginDateRangeFilter?.to) {
          return serviceLastLogin <= lastLoginDateRangeFilter.to;
        }
        return true;
      });
    }

    return filtered;
  };

  // Helper function to get service status
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
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setDateRangeFilter(undefined);
    setEndDateRangeFilter(undefined);
    setLastLoginDateRangeFilter(undefined);
    // Reset to normal pagination
    fetchServices(1, searchTerm, sortBy, sortOrder, pageSize);
  };

  // Sorting handler
  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    fetchServices(pagination.page, searchTerm, field, newOrder);
  };

  const handlePageChange = (newPage) => {
    // Validate page number
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchServices(newPage, searchTerm, sortBy, sortOrder);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPagination(prev => ({ ...prev, page: 1, limit: newPageSize }));
    fetchServices(1, searchTerm, sortBy, sortOrder, newPageSize);
  };

  // Memoized pagination component to prevent re-renders
  const renderPaginationNumbers = () => {
    const showPages = [];
    const current = pagination.page;
    const total = pagination.totalPages;
    
    if (total <= 7) {
      // If 7 or fewer pages, show all
      for (let i = 1; i <= total; i++) {
        showPages.push(i);
      }
    } else {
      // Complex pagination logic for more than 7 pages
      const delta = 2; // Number of pages to show around current page
      
      // Always add first page
      showPages.push(1);
      
      // Calculate the range around current page
      const rangeStart = Math.max(2, current - delta);
      const rangeEnd = Math.min(total - 1, current + delta);
      
      // Add ellipsis after first page if needed
      if (rangeStart > 2) {
        showPages.push('...');
      }
      
      // Add pages in the middle range
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (i !== 1 && i !== total) { // Don't duplicate first or last page
          showPages.push(i);
        }
      }
      
      // Add ellipsis before last page if needed
      if (rangeEnd < total - 1) {
        showPages.push('...');
      }
      
      // Always add last page if it's different from first page
      if (total > 1) {
        showPages.push(total);
      }
    }
    
    return showPages.map((page, index) => {
      if (page === '...') {
        return <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>;
      }
      return (
        <Button
          key={`page-${page}`}
          variant={page === current ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageChange(page)}
          className="w-8 h-8 p-0"
        >
          {page}
        </Button>
      );
    });
  };

  return (
    <div className="w-full min-h-full pt-6 pb-6">
      <div className="flex flex-col gap-4 mb-4 px-4">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/services/archive">Arşiv</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeviceTokenConflictModalVisible(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" /> Token Çakışma Tara
          </Button>
          {permissions?.canEditServices && (
            <>
              <Button onClick={() => {
                setSelectedService(null)
                setServiceModalVisible(true)
              }}>
                <Plus className="mr-2 h-4 w-4" /> Hizmet Ekle
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedCustomerForBulk(null) // Reset any pre-selected customer
                  setBulkServiceModalVisible(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Toplu Hizmet Tanımla
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-4">
        <ServiceTable
          services={services}
          customers={customers}
          isLoading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          dateRangeFilter={dateRangeFilter}
          onDateRangeChange={setDateRangeFilter}
          endDateRangeFilter={endDateRangeFilter}
          onEndDateRangeChange={setEndDateRangeFilter}
          lastLoginDateRangeFilter={lastLoginDateRangeFilter}
          onLastLoginDateRangeChange={setLastLoginDateRangeFilter}
          onClearFilters={handleClearFilters}
          onEdit={(service) => {
            setSelectedService(service)
            setServiceModalVisible(true)
          }}
          onDelete={(service) => {
            setSelectedService(service)
            setDeleteConfirmVisible(true)
          }}
          onViewHistory={(service) => {
            setSelectedServiceForHistory(service)
            fetchRenewHistory(service.id)
            setRenewHistoryOpen(true)
          }}
          onOpenBulkService={handleOpenBulkServiceForCustomer}
          onBulkConvert={handleBulkConvert}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
          archiveActionLabel="Arşive taşı"
        />

        {/* Pagination Controls - Fixed with working algorithm from logs page */}
        {pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {statusFilter !== 'all' || categoryFilter !== 'all' || dateRangeFilter?.from || endDateRangeFilter?.from || lastLoginDateRangeFilter?.from ? (
                  `${services.length} / ${pagination.total} kayıt gösteriliyor`
                ) : (
                  `Toplam ${pagination.total} kayıt, sayfa ${pagination.page} / ${pagination.totalPages}`
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Fixed Page numbers - using memoized function */}
              {renderPaginationNumbers()}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ServiceModal2
        visible={serviceModalVisible}
        onClose={() => {
          setServiceModalVisible(false)
          setSelectedService(null)
        }}
        onSubmit={handleSubmit}
        selectedService={selectedService}
        customers={customers}
        onRefreshCustomers={fetchCustomers}
      />

      <BulkServiceModal
        visible={bulkServiceModalVisible}
        onClose={() => {
          setBulkServiceModalVisible(false)
          setSelectedCustomerForBulk(null) // Reset selected customer when closing
          setSelectedServiceForBulk(null) // Reset selected service when closing
        }}
        onSubmit={handleBulkSubmit}
        customers={customers}
        selectedCustomer={selectedCustomerForBulk}
        selectedService={selectedServiceForBulk}
      />

      <BulkConvertModal
        visible={bulkConvertModalVisible}
        onClose={() => setBulkConvertModalVisible(false)}
        selectedServices={selectedServicesForConvert}
        customers={customers}
        onRefreshCustomers={fetchCustomers}
        onSuccess={() => fetchServices(pagination.page, searchTerm, sortBy, sortOrder)}
      />

      <DeleteConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDelete}
        itemName={selectedService?.name}
        itemType="service"
      />

      <DeviceTokenConflictModal
        visible={deviceTokenConflictModalVisible}
        onClose={() => setDeviceTokenConflictModalVisible(false)}
      />

      <RenewHistoryModal
        visible={renewHistoryOpen}
        onClose={() => {
          setRenewHistoryOpen(false)
          setSelectedServiceForHistory(null)
        }}
        renewHistory={renewHistory}
        loadingOnModal={loadingHistory}
        selectedService={selectedServiceForHistory}
        onDeleteRenewal={async (renewal) => {
          try {
            await axios.delete(`/api/renew-histories/${renewal.id}`)
            fetchRenewHistory(selectedServiceForHistory.id)
          } catch (error) {
            console.log('Error deleting renewal:', error)
          }
        }}
      />
    </div>
  )
}