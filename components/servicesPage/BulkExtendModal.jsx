import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BeatLoader } from "react-spinners";
import { CalendarPlus } from "lucide-react";
import { addMonths, format } from "date-fns";
import { tr } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';

// Must match EXTEND_PERIODS in app/api/services/extend/route.js
const PERIODS = [
    { value: "1month", label: "1 Ay", months: 1 },
    { value: "6months", label: "6 Ay", months: 6 },
    { value: "1year", label: "1 Yıl", months: 12 },
    { value: "2years", label: "2 Yıl", months: 24 },
    { value: "3years", label: "3 Yıl", months: 36 },
];

const formatDate = (date) => format(new Date(date), "dd MMMM yyyy", { locale: tr });

export function BulkExtendModal({ visible, onClose, selectedServices = [], onSuccess }) {
    const [period, setPeriod] = useState("1year");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible) setPeriod("1year");
    }, [visible]);

    const months = PERIODS.find((p) => p.value === period)?.months ?? 12;
    const extendable = selectedServices.filter((s) => s.paymentType !== 'unlimited');
    const unlimitedCount = selectedServices.length - extendable.length;

    const handleSubmit = async () => {
        if (extendable.length === 0) return;

        setSubmitting(true);
        try {
            const response = await axios.post('/api/services/extend', {
                serviceIds: extendable.map((s) => s.id),
                period,
            });
            toast.success(`${response.data.extendedCount} hizmet uzatıldı`);
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error extending services:', error);
            toast.error(error.response?.data?.error || 'Hizmetler uzatılırken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={visible} onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Toplu Lisans Uzatma</DialogTitle>
                    <DialogDescription>
                        Seçili hizmetlerin bitiş tarihi, mevcut bitiş tarihinden itibaren uzatılır. Başlangıç tarihi değişmez.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Uzatma Süresi</Label>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Süre seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {PERIODS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {unlimitedCount > 0 && (
                        <p className="text-sm text-amber-600">
                            {unlimitedCount} sınırsız hizmet atlanacak.
                        </p>
                    )}

                    <div className="border rounded-md divide-y max-h-[320px] overflow-y-auto">
                        {extendable.map((service) => (
                            <div key={service.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{service.name}</div>
                                    {service.customer?.name && (
                                        <div className="text-muted-foreground truncate">{service.customer.name}</div>
                                    )}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <span className="text-muted-foreground">{formatDate(service.endingDate)}</span>
                                    {" → "}
                                    <span className="font-medium text-green-600">
                                        {formatDate(addMonths(new Date(service.endingDate), months))}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {extendable.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                Uzatılabilecek hizmet yok.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || extendable.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {submitting ? (
                            <BeatLoader size={8} color="white" />
                        ) : (
                            <>
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                {extendable.length} Hizmeti Uzat
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
