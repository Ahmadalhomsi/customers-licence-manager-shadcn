import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Copy, Key } from "lucide-react";
import { BeatLoader } from 'react-spinners';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { copyToClipboard } from '@/lib/clipboard';
import { MAMENU_CATEGORY, POS_PROVIDERS } from '@/lib/licence-products';

const PAYMENT_TYPES = [
  { value: "1month", label: "1 Ay" }, 
  { value: "6months", label: "6 Ay" },
  { value: "1year", label: "1 Yıl" },
  { value: "2years", label: "2 Yıl" },
  { value: "3years", label: "3 Yıl" },
  { value: "unlimited", label: "Sınırsız" },
  { value: "custom", label: "Özel" },
];    const categoryColors = {
        'Adisyon Programı': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Platform Entegrasyon': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        'QR Menu': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        'Kurye Uygulaması': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
        'Patron Uygulaması': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        'Yemek Sepeti': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        'Migros Yemek': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
        'Trendyol Yemek': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        'Getir Yemek': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        [MAMENU_CATEGORY]: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
        ...Object.fromEntries(POS_PROVIDERS.map((provider) => [provider.category, 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300']))
    };

export function ServicesViewModal({
  visible,
  onClose,
  services,
  loadingOnModal,
  selectedCustomer,
  onEditService,
  onDeleteService,
  onAddService,
}) {
  // Check if any service has a deviceToken
  const hasDeviceTokens = services.some(service => service.deviceToken);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getPaymentTypeLabel = (value) => {
    const paymentType = PAYMENT_TYPES.find(type => type.value === value);
    return paymentType ? paymentType.label : value;
  };

  const getServiceStatus = (service) => {
    // Check if service is inactive first
    if (!service.active) {
      return {
        status: "inactive",
        variant: "secondary",
        text: "Pasif"
      };
    }

    const now = new Date();
    const endDate = new Date(service.endingDate);
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    if (now > endDate) {
      return {
        status: "expired",
        variant: "destructive",
        text: "Süresi Dolmuş"
      };
    } else if (endDate <= oneWeekFromNow) {
      return {
        status: "expiring",
        variant: "outline",
        text: "Yakında Dolacak"
      };
    } else {
      return {
        status: "active",
        variant: "default",
        text: "Aktif"
      };
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={visible} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedCustomer?.name} için Hizmetler
              {services.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({services.length} hizmet)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button
            onClick={() => onAddService(selectedCustomer)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Hizmet Ekle
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                {hasDeviceTokens && <TableHead>Device Token</TableHead>}
                <TableHead>İsim</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>İşletme Adı</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Ödeme Türü</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Başlangıç Tarihi</TableHead>
                <TableHead>Bitiş Tarihi</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingOnModal ? (
                <TableRow>
                  <TableCell colSpan={hasDeviceTokens ? 11 : 10} className="text-center py-8">
                    <div className="flex justify-center">
                      <BeatLoader color="#f26000" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasDeviceTokens ? 11 : 10} className="text-center">
                    Hizmet bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => {
                  const statusInfo = getServiceStatus(service);
                  return (
                    <TableRow key={service.id}>
                      <TableCell>{service.id}</TableCell>
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
                      <TableCell>{service.name}</TableCell>
                      <TableCell>{service.description}</TableCell>
                      <TableCell>{service.companyName || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          className={`text-xs font-medium ${categoryColors[service.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`}
                        >
                          {service.category || 'Adisyon Programı'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getPaymentTypeLabel(service.paymentType)}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.text}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(service.startingDate)}
                      </TableCell>
                      <TableCell>
                        {service.paymentType === 'unlimited' ? 'Sınırsız' : formatDate(service.endingDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditService(service)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteService(service)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}