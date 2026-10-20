'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Globe, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { LogDetailModal } from './LogDetailModal';

export function LogTable({
  logs,
  selectedLog,
  setSelectedLog,
  sortBy,
  sortOrder,
  onSort,
  onEditService
}) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) {
      return <Badge variant="default" className="bg-green-500">Success</Badge>;
    } else if (status >= 400 && status < 500) {
      return <Badge variant="destructive" className="">Client Error</Badge>;
    } else if (status >= 500) {
      return <Badge variant="destructive" className="bg-red-600">Server Error</Badge>;
    }
    return <Badge variant="secondary" className="">{status}</Badge>;
  };

  const getValidationTypeBadge = (validationType) => {
    if (validationType === 'Trial') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Trial</Badge>;
    } else if (validationType === 'Sisteme Giriş') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sisteme Giriş</Badge>;
    } else if (validationType === 'Existing Service') {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Existing Service</Badge>;
    }
    return <Badge variant="secondary" className="">Unknown</Badge>;
  };

  const SortableHeader = ({ field, children }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field && (
          sortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  return (
    <>
      <Table className="">
        <TableHeader className="">
          <TableRow className="">
            <SortableHeader field="createdAt">Tarih</SortableHeader>
            <SortableHeader field="ipAddress">IP Adresi</SortableHeader>
            <TableHead className="">Servis ID</TableHead>
            <SortableHeader field="serviceName">Servis Adı</SortableHeader>
            <TableHead className="">İşletme Adı</TableHead>
            <TableHead className="">Müşteri</TableHead>
            <TableHead className="">Terminal</TableHead>
            <TableHead className="">Versiyon</TableHead>
            <SortableHeader field="endpoint">Endpoint</SortableHeader>
            <TableHead className="">Doğrulama Tipi</TableHead>
            <SortableHeader field="responseStatus">Durum</SortableHeader>
            <TableHead className="">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="">
          {logs.map((log) => (
            <TableRow key={log.id} className="">
              <TableCell className="font-mono text-sm">
                {formatDate(log.createdAt)}
              </TableCell>
              <TableCell className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {log.ipAddress}
              </TableCell>
              <TableCell className="">{(() => {
                // Display service ID if available
                if (log.serviceId) {
                  return (
                    <span className="font-mono text-xs">
                      {log.serviceId.substring(0, 8)}...
                    </span>
                  );
                }
                return '-';
              })()}</TableCell>
              <TableCell className="">{log.serviceName || '-'}</TableCell>
              <TableCell className="">{(() => {
                try {
                  const requestData = JSON.parse(log.requestBody || '{}');
                  return requestData.companyName || '-';
                } catch {
                  return '-';
                }
              })()}</TableCell>
              <TableCell className="">{log.customer?.name || '-'}</TableCell>
              <TableCell className="">{(() => {
                try {
                  const requestData = JSON.parse(log.requestBody || '{}');
                  return requestData.terminal || '-';
                } catch {
                  return '-';
                }
              })()}</TableCell>
              <TableCell className="">{(() => {
                if (log.version) {
                  return (
                    <Badge variant="outline" className="font-mono text-xs">
                      {log.version}
                    </Badge>
                  );
                }
                // Try to get version from request body if not in log
                try {
                  const requestData = JSON.parse(log.requestBody || '{}');
                  if (requestData.version) {
                    return (
                      <Badge variant="outline" className="font-mono text-xs">
                        {requestData.version}
                      </Badge>
                    );
                  }
                } catch {
                  // Do nothing
                }
                return '-';
              })()}</TableCell>
              <TableCell className="font-mono text-sm">
                <Badge variant="outline" className="">{log.method}</Badge> {log.endpoint}
              </TableCell>
              <TableCell className="">{getValidationTypeBadge(log.validationType)}</TableCell>
              <TableCell className="">{getStatusBadge(log.responseStatus)}</TableCell>
              <TableCell className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <LogDetailModal log={selectedLog} onEditService={onEditService} />
                </Dialog>
                
                {onEditService && log.serviceId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditService(log.serviceId)}
                    title="Hizmeti Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {logs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Henüz log kaydı bulunmuyor.
        </div>
      )}
    </>
  );
}