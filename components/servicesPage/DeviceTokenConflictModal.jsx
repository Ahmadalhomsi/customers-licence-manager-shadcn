import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function DeviceTokenConflictModal({ visible, onClose }) {
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [scanned, setScanned] = useState(false);

    const handleScan = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/services/scan-device-tokens');
            setConflicts(res.data.conflicts || []);
            setScanned(true);
            if ((res.data.conflicts || []).length === 0) {
                toast.success('Cihaz token çakışması bulunamadı');
            }
        } catch (error) {
            toast.error('Tarama yapilirken hata oluştu');
            console.error('Scan error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getConflictLevel = (totalCustomers) => {
        if (totalCustomers > 2) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    };

    return (
        <Dialog open={visible} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Cihaz Token Çakışma Taraması
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Bu araç, farklı müşterilere ait hizmetlerde aynı cihaz tokeninin kullanılıp kullanılmadığını kontrol eder.
                        Çakışan tokenler, cihaz doğrulama sorunlarına yol açabilir.
                    </p>

                    {!scanned && !loading && (
                        <div className="flex justify-center py-8">
                            <Button onClick={handleScan} size="lg">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Taramayı Başlat
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Taranıyor...</p>
                        </div>
                    )}

                    {scanned && !loading && (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {conflicts.length > 0
                                        ? `${conflicts.length} adet cihaz token çakışması bulundu`
                                        : 'Çakışma bulunamadı'}
                                </span>
                                <Button variant="outline" size="sm" onClick={handleScan}>
                                    <RefreshCw className="mr-2 h-3 w-3" />
                                    Tekrar Tara
                                </Button>
                            </div>

                            {conflicts.map((conflict, idx) => (
                                <div key={idx} className="border rounded-lg overflow-hidden">
                                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium">
                                                {conflict.deviceToken}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConflictLevel(conflict.totalCustomers)}`}>
                                            {conflict.totalCustomers} müşteri · {conflict.totalServices} hizmet
                                        </span>
                                    </div>
                                    <div className="divide-y">
                                        {conflict.services.map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                                                <div className="flex-1">
                                                    <div className="font-medium">{s.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Müşteri: {s.customerName}
                                                        {s.companyName && ` · ${s.companyName}`}
                                                        {s.terminal && ` · ${s.terminal}`}
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground whitespace-nowrap ml-4">
                                                    {s.lastLoginDate
                                                        ? format(new Date(s.lastLoginDate), 'dd MMM yyyy', { locale: tr })
                                                        : '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
