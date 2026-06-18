'use client';

import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Pencil } from 'lucide-react';

export function LogDetailModal({ log, onEditService }) {
  if (!log) return null;

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

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader className="">
        <DialogTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Log Detayları
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">İstek Bilgileri</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Endpoint:</strong> {log.endpoint}</div>
              <div><strong>Method:</strong> {log.method}</div>
              <div><strong>IP Adresi:</strong> {log.ipAddress}</div>
              <div><strong>Tarih:</strong> {formatDate(log.createdAt)}</div>
              <div><strong>Doğrulama Tipi:</strong> {getValidationTypeBadge(log.validationType)}</div>
              <div><strong>Durum:</strong> {getStatusBadge(log.responseStatus)}</div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              Servis Bilgileri
              {onEditService && log.serviceId && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => onEditService(log.serviceId)}
                  title="Hizmeti Düzenle"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </h4>
            <div className="space-y-2 text-sm">
              <div><strong>Servis Adı:</strong> {log.serviceName || 'N/A'}</div>
              <div><strong>İşletme Adı:</strong> {(() => {
                try {
                  const requestData = JSON.parse(log.requestBody || '{}');
                  return requestData.companyName || 'N/A';
                } catch {
                  return 'N/A';
                }
              })()}</div>
              <div><strong>Müşteri:</strong> {log.customer ? (
                <span>
                  {log.customer.name}
                  {log.customer.signBoard && ` (${log.customer.signBoard})`}
                </span>
              ) : 'N/A'}</div>
              <div><strong>Terminal:</strong> {(() => {
                try {
                  const requestData = JSON.parse(log.requestBody || '{}');
                  return requestData.terminal || 'N/A';
                } catch {
                  return 'N/A';
                }
              })()}</div>
              <div><strong>Device Token:</strong> {log.deviceToken ? `${log.deviceToken.substring(0, 20)}...` : 'N/A'}</div>
              <div><strong>User Agent:</strong> {log.userAgent || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">İstek İçeriği</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60 text-foreground">
              {log.requestBody ? JSON.stringify(JSON.parse(log.requestBody), null, 2) : 'Boş'}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Yanıt İçeriği</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60 text-foreground">
              {log.responseBody ? JSON.stringify(JSON.parse(log.responseBody), null, 2) : 'Boş'}
            </pre>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}