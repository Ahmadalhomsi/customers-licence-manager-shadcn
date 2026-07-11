import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, RefreshCw, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function DeviceTokenConflictModal({ visible, onClose }) {
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [migrationResults, setMigrationResults] = useState(null);
    const [v2Inputs, setV2Inputs] = useState({});

    const handleScan = async () => {
        setLoading(true);
        setMigrationResults(null);
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

    const handleV2Change = (v1Token, value) => {
        setV2Inputs(prev => ({ ...prev, [v1Token]: value }));
    };

    const handleMigrate = async () => {
        const migrations = Object.entries(v2Inputs)
            .filter(([, v2]) => v2 && v2.trim())
            .map(([v1, v2]) => ({ deviceToken: v1, deviceTokenV2: v2.trim() }));

        if (migrations.length === 0) {
            toast.error('Lütfen en az bir v2 token girin');
            return;
        }

        setMigrating(true);
        try {
            const res = await axios.post('/api/services/migrate-tokens', { migrations });
            setMigrationResults(res.data);
            toast.success(`${res.data.migrated} servis migre edildi`);
            handleScan();
        } catch (error) {
            toast.error('Migrasyon sirasinda hata oluştu');
            console.error('Migrate error:', error);
        } finally {
            setMigrating(false);
        }
    };

    const getConflictLevel = (totalCustomers) => {
        if (totalCustomers > 2) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    };

    return (
        <Dialog open={visible} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Cihaz Token Çakışma Taraması & Migrasyon
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Info text */}
                    <p className="text-sm text-muted-foreground">
                        Bu araç aynı cihaz tokenini kullanan farklı müşterileri bulur ve v2 token migrasyonu yapmanızı sağlar.
                        v2 token girilen servisler, hem eski v1 hem de yeni v2 token ile doğrulama yapabilir.
                    </p>

                    {/* Scan section */}
                    {!scanned && !loading && (
                        <div className="flex justify-center py-6">
                            <Button onClick={handleScan} size="lg">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Taramayı Başlat
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Taranıyor...</p>
                        </div>
                    )}

                    {/* Migration summary */}
                    {migrationResults && (
                        <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-sm">
                                <strong>{migrationResults.migrated}</strong> migre edildi,
                                <strong> {migrationResults.unchanged}</strong> zaten migre,
                                <strong> {migrationResults.skipped}</strong> atlandı
                            </span>
                        </div>
                    )}

                    {/* Conflicts list */}
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

                            {conflicts.length > 0 && (
                                <div className="space-y-3">
                                    {conflicts.map((conflict, idx) => (
                                        <div key={idx} className="border rounded-lg overflow-hidden">
                                            <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${conflict.field === 'deviceTokenV2' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'}`}>
                                                        {conflict.field === 'deviceTokenV2' ? 'v2' : 'v1'}
                                                    </span>
                                                    <span className="font-mono text-sm font-medium truncate">
                                                        {conflict.token}
                                                    </span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ml-2 ${getConflictLevel(conflict.totalCustomers)}`}>
                                                    {conflict.totalCustomers} müşteri · {conflict.totalServices} hizmet
                                                </span>
                                            </div>
                                            <div className="divide-y">
                                                {conflict.services.map((s) => (
                                                    <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">{s.name}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
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
                                            {/* v2 token input */}
                                            <div className="flex items-center gap-2 p-3 bg-muted/10 border-t">
                                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <Input
                                                    placeholder="v2 token girin..."
                                                    value={v2Inputs[conflict.token] || ''}
                                                    onChange={(e) => handleV2Change(conflict.token, e.target.value)}
                                                    className="flex-1 font-mono text-xs"
                                                />
                                                {v2Inputs[conflict.token] && (
                                                    <span className="text-xs text-green-600 shrink-0">
                                                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                                                        Hazır
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Migrate button */}
                            {conflicts.length > 0 && Object.keys(v2Inputs).length > 0 && (
                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handleMigrate}
                                        disabled={migrating}
                                        className="w-full sm:w-auto"
                                    >
                                        {migrating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Migre Ediliyor...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Seçili Tokenleri Migre Et
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={onClose}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
