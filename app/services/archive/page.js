"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ServiceTable } from '@/components/servicesPage/ServicesTable'
import { ServiceModal2 } from '@/components/servicesPage/ServiceModal2'
import { DeleteConfirmModal } from '@/components/mainPage/DeleteConfirmModal'
import { ChevronLeft } from 'lucide-react'
import { RenewHistoryModal } from '@/components/RenewHistoryModal'
import { toast } from 'sonner'

export default function ServicesArchivePage() {
  const router = useRouter()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [availableCategories, setAvailableCategories] = useState([])

  const [serviceModalVisible, setServiceModalVisible] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [selectedService, setSelectedService] = useState(null)

  const [renewHistoryOpen, setRenewHistoryOpen] = useState(false)
  const [selectedServiceForHistory, setSelectedServiceForHistory] = useState(null)
  const [renewHistory, setRenewHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('endingDate')
  const [sortOrder, setSortOrder] = useState('desc')
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateRangeFilter, setDateRangeFilter] = useState()
  const [endDateRangeFilter, setEndDateRangeFilter] = useState()
  const [lastLoginDateRangeFilter, setLastLoginDateRangeFilter] = useState()

  // Distinct categories across all archive pages (for the filter dropdown).
  // Only refetched after data-changing actions.
  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get('/api/services/categories?archive=true')
      setAvailableCategories(response.data.categories || [])
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Hizmet görüntüleme izniniz yok')
      }
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/customers?limit=1000')
      setCustomers(response.data.customers || response.data || [])
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Müşterileri görüntüleme izniniz yok')
      }
    }
  }

  const fetchServices = useCallback(async (page = 1, search = '', sortField = sortBy, order = sortOrder, limit = pageSize) => {
    try {
      setLoading(true)

      const validPage = Math.max(1, parseInt(page) || 1)
      const params = new URLSearchParams({
        page: validPage.toString(),
        limit: limit.toString(),
        search,
        sortBy: sortField,
        sortOrder: order,
        archive: 'true'
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }

      if (dateRangeFilter?.from) {
        params.append('startDateFrom', dateRangeFilter.from.toISOString())
      }
      if (dateRangeFilter?.to) {
        params.append('startDateTo', dateRangeFilter.to.toISOString())
      }
      if (endDateRangeFilter?.from) {
        params.append('endDateFrom', endDateRangeFilter.from.toISOString())
      }
      if (endDateRangeFilter?.to) {
        params.append('endDateTo', endDateRangeFilter.to.toISOString())
      }
      if (lastLoginDateRangeFilter?.from) {
        params.append('lastLoginDateFrom', lastLoginDateRangeFilter.from.toISOString())
      }
      if (lastLoginDateRangeFilter?.to) {
        params.append('lastLoginDateTo', lastLoginDateRangeFilter.to.toISOString())
      }

      const response = await axios.get(`/api/services?${params}`)
      setServices(response.data.services || [])
      setPagination(response.data.pagination || {
        page: 1,
        limit,
        total: 0,
        totalPages: 0
      })
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Hizmet görüntüleme izniniz yok')
      }
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortOrder, pageSize, statusFilter, categoryFilter, dateRangeFilter, endDateRangeFilter, lastLoginDateRangeFilter])

  useEffect(() => {
    fetchServices(1)
    fetchCustomers()
  }, [fetchServices])

  const handleSearch = useCallback(() => {
    fetchServices(1, searchTerm, sortBy, sortOrder, pageSize)
  }, [fetchServices, searchTerm, sortBy, sortOrder, pageSize])

  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortOrder(newOrder)
    fetchServices(pagination.page, searchTerm, field, newOrder)
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    fetchServices(newPage, searchTerm, sortBy, sortOrder)
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setPagination(prev => ({ ...prev, page: 1, limit: newPageSize }))
    fetchServices(1, searchTerm, sortBy, sortOrder, newPageSize)
  }

  const handleClearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setDateRangeFilter(undefined)
    setEndDateRangeFilter(undefined)
    setLastLoginDateRangeFilter(undefined)
    fetchServices(1, searchTerm, sortBy, sortOrder, pageSize)
  }

  const handleBulkUnarchive = async (selectedServices) => {
    if (!selectedServices?.length) return

    try {
      await axios.put('/api/services/archive', {
        serviceIds: selectedServices.map((service) => service.id),
        archived: false
      })

      toast.success(`${selectedServices.length} hizmet arşivden çıkarıldı`)
      fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
      fetchCategories()
    } catch (error) {
      console.error('Error unarchiving services:', error)
      toast.error('Hizmetler arşivden çıkarılırken hata oluştu')
    }
  }

  const handleBulkDelete = async (selectedServices) => {
    if (!selectedServices?.length) return

    const confirmed = window.confirm(`${selectedServices.length} arşiv hizmeti kalici olarak silinsin mi?`)
    if (!confirmed) {
      return
    }

    try {
      await Promise.all(
        selectedServices.map((service) => axios.delete(`/api/services/${service.id}`))
      )

      toast.success(`${selectedServices.length} arşiv hizmeti silindi`)
      fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
      fetchCategories()
    } catch (error) {
      console.error('Error deleting archived services:', error)
      toast.error('Arşiv hizmetleri silinirken hata oluştu')
    }
  }

  const fetchRenewHistory = async (serviceId) => {
    try {
      setLoadingHistory(true)
      const response = await axios.get(`/api/renew-histories/${serviceId}`)
      setRenewHistory(response.data)
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Yasak: Yenileme geçmişini görüntüleme izniniz yok')
      }
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSubmit = async (formData) => {
    try {
      if (selectedService) {
        await axios.put(`/api/services/${selectedService.id}`, formData)
      }
      await fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
      fetchCategories()
      setServiceModalVisible(false)
      setSelectedService(null)
    } catch (error) {
      console.log('Error updating archived service:', error)
      toast.error('Hizmet güncellenirken hata oluştu')
    }
  }

  const handleDelete = async () => {
    if (!selectedService) return

    try {
      await axios.delete(`/api/services/${selectedService.id}`)
      fetchServices(pagination.page, searchTerm, sortBy, sortOrder)
      fetchCategories()
      setDeleteConfirmVisible(false)
    } catch (error) {
      console.log('Error deleting service:', error)
    }
  }

  const renderPaginationNumbers = () => {
    const showPages = []
    const current = pagination.page
    const total = pagination.totalPages

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        showPages.push(i)
      }
    } else {
      const delta = 2
      showPages.push(1)

      const rangeStart = Math.max(2, current - delta)
      const rangeEnd = Math.min(total - 1, current + delta)

      if (rangeStart > 2) {
        showPages.push('...')
      }

      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (i !== 1 && i !== total) {
          showPages.push(i)
        }
      }

      if (rangeEnd < total - 1) {
        showPages.push('...')
      }

      if (total > 1) {
        showPages.push(total)
      }
    }

    return showPages.map((page, index) => {
      if (page === '...') {
        return <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
      }
      return (
        <Button
          key={`page-${page}`}
          variant={page === current ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePageChange(page)}
          className="w-8 h-8 p-0"
        >
          {page}
        </Button>
      )
    })
  }

  return (
    <div className="w-full min-h-full pt-6 pb-6">
      <div className="flex flex-col gap-4 mb-4 px-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/services')}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Aktif Hizmetlere Dön
          </Button>
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
          availableCategories={availableCategories}
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
          onBulkArchive={handleBulkUnarchive}
          onBulkDelete={handleBulkDelete}
          archiveActionLabel="Arşivden çıkar"
        />

        {pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Toplam {pagination.total} arşiv kaydı, sayfa {pagination.page} / {pagination.totalPages}
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

            <div className="flex items-center gap-1">{renderPaginationNumbers()}</div>
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

      <DeleteConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDelete}
        itemName={selectedService?.name}
        itemType="service"
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
