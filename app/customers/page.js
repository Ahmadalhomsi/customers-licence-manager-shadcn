"use client"

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomerTable } from '@/components/mainPage/CustomersTable'
import { CustomerModal } from '@/components/mainPage/CustomerModal'
import { DeleteConfirmModal } from '@/components/mainPage/DeleteConfirmModal'
import { ServiceModal } from '@/components/mainPage/ServiceModal'
import { ServicesViewModal } from '@/components/mainPage/ServicesViewModal'
import { Plus, Mail, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { toast } from "sonner"

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [customerModalVisible, setCustomerModalVisible] = useState(false)
  const [deleteCustomerConfirmVisible, setDeleteCustomerConfirmVisible] = useState(false)
  const [serviceModalVisible, setServiceModalVisible] = useState(false)
  const [servicesViewModalVisible, setServicesViewModalVisible] = useState(false)
  const [deleteServiceConfirmVisible, setDeleteServiceConfirmVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOnModal, setLoadingOnModal] = useState(true);
  const [sortConfig, setSortConfig] = useState(null);
  const [permissions, setPermissions] = useState(null);
  
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
  const [dateRangeFilter, setDateRangeFilter] = useState({
    from: undefined,
    to: undefined
  });

  // Utility function to reset all modal states
  const resetModalStates = () => {
    setCustomerModalVisible(false);
    setDeleteCustomerConfirmVisible(false);
    setServiceModalVisible(false);
    setServicesViewModalVisible(false);
    setDeleteServiceConfirmVisible(false);
    setSelectedCustomer(null);
    setSelectedService(null);
    setServices([]);
  };

  useEffect(() => {
    fetchAdminData();
    fetchCustomers();

    // Global keyboard shortcuts
    const handleKeyDown = (event) => {
      // Ctrl+F or Cmd+F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        document.querySelector('input[placeholder*="Müşteri ara"]')?.focus();
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
  }, []);

  // Trigger filtering when filter values change (including when changing to 'all')
  useEffect(() => {
    handleFilterChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateRangeFilter]);

  const handleDeleteCustomer = async () => {
    if (selectedCustomer) {
      try {
        await axios.delete(`/api/customers/${selectedCustomer.id}`);
        toast.success('Müşteri başarıyla silindi');
        fetchCustomers(pagination.page, searchTerm, sortBy, sortOrder);
        setDeleteCustomerConfirmVisible(false);
      } catch (error) {
        if (error.response?.status === 403) {
          toast.error('Yasak: Müşteri silme izniniz yok')
        } else if (error.response?.status === 400) {
          // This case should not occur now since we handle it in the modal
          const errorData = error.response?.data;
          toast.error(errorData?.error || 'Bu müşteriyi silmeden önce tüm hizmetlerini silmelisiniz');
        } else {
          toast.error('Müşteri silinirken bir hata oluştu');
          console.log('Error deleting customer:', error)
        }
      }
    }
  };

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


  const handleServiceSubmit = async (serviceFormData) => {
    try {
      if (selectedCustomer) {
        if (selectedService) {
          await axios.put(`/api/services/${selectedService.id}`, {
            ...serviceFormData,
            customerID: selectedCustomer.id
          });
        } else {
          await axios.post(`/api/services`, {
            ...serviceFormData,
            customerID: selectedCustomer.id
          });
        }
        setServiceModalVisible(false);
        if (servicesViewModalVisible) {
          await fetchServices(selectedCustomer.id);
        }
      }
      fetchCustomers(pagination.page, searchTerm, sortBy, sortOrder);
    } catch (error) {
      console.log('Error adding/updating service:', error);
    }
  };

  const sendSMTPemail = async () => {
    try {
      const res = await axios.post('/api/mailer')
      console.log('Email sent successfully');
    } catch (error) {
      console.log('Error sending email:', error);
    }
  }

  // Fetch functions remain the same
  async function fetchCustomers(page = 1, search = '', sortField = sortBy, order = sortOrder, limit = pageSize) {
    try {
      setLoading(true);
      
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

      // Add date filters if set
      if (dateRangeFilter?.from) {
        params.append('dateFrom', dateRangeFilter.from.toISOString());
      }
      if (dateRangeFilter?.to) {
        params.append('dateTo', dateRangeFilter.to.toISOString());
      }
      
      const response = await axios.get(`/api/customers?${params}`)
      if (response.status === 206) {
        toast.error('Yasak: Müşteri parolalarını görüntüleme izniniz yok')
      }
      
      // Update customers and pagination
      setCustomers(response.data.customers || [])
      const newPagination = response.data.pagination || {
        page: 1,
        limit: pageSize,
        total: 0,
        totalPages: 0
      }
      
      // Check if current page exceeds total pages and redirect to last page
      if (newPagination.totalPages > 0 && validPage > newPagination.totalPages) {
        // Recursively fetch the last valid page
        return fetchCustomers(newPagination.totalPages, search, sortField, order, limit);
      }
      
      setPagination(newPagination)
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Müşterileri görüntüleme izniniz yok')
      }
      else
        console.log('Müşterileri getirirken hata oluştu:', error)

    }
    setLoading(false)
  }

  async function fetchServices(customerId) {
    setLoadingOnModal(true);
    try {
      const response = await axios.get(`/api/services/customer/${customerId}`);
      // Sort services by creation date (newest first) to show new services at the top
      const sortedServices = response.data.sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
      setServices(sortedServices);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Hizmetleri görüntüleme izniniz yok')
      }
      else
        console.log('Error fetching services:', error)
    }
    setLoadingOnModal(false);
  }



  // Modal handlers remain similar
  const handleCustomerSubmit = async (formData) => {
    try {
      if (selectedCustomer) {
        try {
          await axios.put(`/api/customers/${selectedCustomer.id}`, formData);
          toast.success('Müşteri başarıyla güncellendi');
          fetchCustomers(pagination.page, searchTerm);
        } catch (error) {
          if (error.response?.status === 403) {
            toast.error('Yasak: Müşteri güncelleme izniniz yok')
          } else if (error.response?.status === 404) {
            toast.error('Müşteri bulunamadı')
          } else {
            toast.error('Müşteri güncellenirken bir hata oluştu')
            console.log('Error updating customer:', error)
          }
          return; // Don't close modal on error
        }
      } else {
        try {
          await axios.post('/api/customers', formData);
          toast.success('Müşteri başarıyla eklendi');
        } catch (error) {
          if (error.response?.status === 403) {
            toast.error('Yasak: Müşteri ekleme izniniz yok')
          } else {
            toast.error('Müşteri eklenirken bir hata oluştu')
            console.log('Error adding customer:', error)
          }
          return; // Don't close modal on error
        }
      }
      setCustomerModalVisible(false);
      setSelectedCustomer(null); // Reset selected customer after submission
      // add the customer to the list
      fetchCustomers(pagination.page, searchTerm);
    } catch (error) {
      console.log('Error submitting customer:', error);
      toast.error('Beklenmeyen bir hata oluştu');
    }
  };

  // Enhanced search handlers - now server-side with button/enter trigger
  const handleSearch = () => {
    // Always use server-side search with current filters
    fetchCustomers(1, searchTerm, sortBy, sortOrder, pageSize);
  };

  const handleFilterChange = () => {
    // Apply filters on server-side - user needs to click search or press enter
    fetchCustomers(1, searchTerm, sortBy, sortOrder, pageSize);
  };

  // Helper function to apply client-side filtering on fetched data (minimal, just for status/date)
  const getFilteredCustomers = () => {
    let filtered = customers;

    // Apply status filter (client-side for UI responsiveness)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const status = getCustomerStatus(customer);
        return status === statusFilter;
      });
    }

    // Apply date range filter (client-side for UI responsiveness) 
    if (dateRangeFilter?.from || dateRangeFilter?.to) {
      filtered = filtered.filter(customer => {
        const customerDate = new Date(customer.createdAt);
        
        if (dateRangeFilter?.from && dateRangeFilter?.to) {
          return customerDate >= dateRangeFilter.from && customerDate <= dateRangeFilter.to;
        } else if (dateRangeFilter?.from) {
          return customerDate >= dateRangeFilter.from;
        } else if (dateRangeFilter?.to) {
          return customerDate <= dateRangeFilter.to;
        }
        return true;
      });
    }

    return filtered;
  };

  // Helper function to get customer status
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

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDateRangeFilter({ from: undefined, to: undefined });
    // Reset to normal pagination
    fetchCustomers(1, searchTerm, sortBy, sortOrder, pageSize);
  };

  const handlePageChange = (newPage) => {
    // Validate page number
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchCustomers(newPage, searchTerm, sortBy, sortOrder);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPagination(prev => ({ ...prev, page: 1, limit: newPageSize }));
    fetchCustomers(1, searchTerm, sortBy, sortOrder, newPageSize);
  };

  return (
    <div className="w-full min-h-full pt-6 pb-6">
      <div className="flex flex-col gap-4 mb-4 px-4">
        <div className="flex gap-2">
          {permissions?.canEditCustomers && (
            <Button onClick={() => {
              setSelectedCustomer(null); // Ensure selectedCustomer is reset
              setCustomerModalVisible(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Müşteri Ekle
            </Button>
          )}
        </div>
      </div>

      <div className="px-4">
        <CustomerTable
          customers={customers}
          services={services}
          isLoading={loading}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateRangeFilter={dateRangeFilter}
          onDateRangeChange={setDateRangeFilter}
          onClearFilters={handleClearFilters}
          onEdit={(customer) => {
            setSelectedCustomer(customer)
            setCustomerModalVisible(true)
          }}
          onDelete={(customer) => {
            setSelectedCustomer(customer)
            setDeleteCustomerConfirmVisible(true)
          }}
          onAddService={(customer) => {
            setSelectedCustomer(customer);
            setSelectedService(null);  // Reset service selection
            setServiceModalVisible(true);
          }}
          onViewServices={(customer) => {
            fetchServices(customer.id)
            setSelectedCustomer(customer)
            setServicesViewModalVisible(true)
          }}
        />

        {/* Pagination Controls */}
        {pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {statusFilter !== 'all' || dateRangeFilter?.from || dateRangeFilter?.to ? (
                  `${customers.length} / ${pagination.total} kayıt gösteriliyor`
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
              
              {/* Page numbers */}
              {(() => {
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
                  
                  // Add pages in the middle range (avoid duplicating first and last)
                  for (let i = rangeStart; i <= rangeEnd; i++) {
                    if (i !== 1 && i !== total && !showPages.includes(i)) {
                      showPages.push(i);
                    }
                  }
                  
                  // Add ellipsis before last page if needed
                  if (rangeEnd < total - 1) {
                    showPages.push('...');
                  }
                  
                  // Always add last page if it's different from first page and not already added
                  if (total > 1 && !showPages.includes(total)) {
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
              })()}
              
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

      {/* Modals */}
      <CustomerModal
        visible={customerModalVisible}
        onClose={() => {
          setCustomerModalVisible(false);
          setSelectedCustomer(null); // Reset on close
        }}
        onSubmit={handleCustomerSubmit}
        selectedCustomer={selectedCustomer}
        customers={customers}
      />

      <DeleteConfirmModal
        visible={deleteCustomerConfirmVisible}
        onClose={() => {
          setDeleteCustomerConfirmVisible(false);
          setSelectedCustomer(null);
        }}
        onConfirm={handleDeleteCustomer}
        itemName={selectedCustomer?.name}
        itemType="customer"
        customer={selectedCustomer}
        onViewServices={(customer) => {
          // Close delete modal and open services view with a small delay to prevent modal conflicts
          setDeleteCustomerConfirmVisible(false);
          setTimeout(() => {
            setSelectedCustomer(customer);
            fetchServices(customer.id);
            setServicesViewModalVisible(true);
          }, 200); // Small delay to ensure delete modal is fully closed
        }}
      />

      <ServiceModal
        visible={serviceModalVisible}
        onClose={() => {
          setServiceModalVisible(false);
          setSelectedService(null);  // Clear service selection
        }}
        onSubmit={handleServiceSubmit}
        selectedCustomer={selectedCustomer}
        selectedService={selectedService}  // This should now be null for new services
      />

      <ServicesViewModal
        visible={servicesViewModalVisible}
        onClose={() => {
          setServicesViewModalVisible(false);
          setServices([]);
          setSelectedCustomer(null);
          // Add a small delay to ensure proper cleanup
          setTimeout(() => {
            // Additional cleanup can be done here if needed
          }, 100);
        }}
        services={services}
        loadingOnModal={loadingOnModal}
        selectedCustomer={selectedCustomer}
        onEditService={(service) => {
          setSelectedService(service); // Keep the service data including dates
          setServiceModalVisible(true);
        }}
        onDeleteService={async (service) => {
          setSelectedService(service)
          setDeleteServiceConfirmVisible(true)
          try {
            await axios.delete(`/api/services/${service.id}`)
            fetchServices(selectedCustomer.id)
            fetchCustomers(pagination.page, searchTerm, sortBy, sortOrder)
          } catch (error) {
            console.log('Error deleting service:', error)
          }
        }}
        onAddService={() => {
          setSelectedService(null)
          setServiceModalVisible(true)
        }}
      />
    </div>
  )
}