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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BeatLoader } from "react-spinners";
import { CalendarPlus, Calendar as CalendarIcon } from "lucide-react";
import { addMonths, format } from "date-fns";
import { tr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { newEndDateFor } from "@/lib/licence-extend";
import axios from 'axios';
import { toast } from 'sonner';

// Values match EXTEND_BASES / EXTEND_PERIODS in lib/licence-extend.js
const BASES = [
    { value: "end", label: "Bitiş tarihinden" },
    { value: "start", label: "Başlangıç tarihinden" },
];

const PERIODS = [
    { value: "1month", label: "1 Ay" },
    { value: "6months", label: "6 Ay" },
    { value: "1year", label: "1 Yıl" },
    { value: "2years", label: "2 Yıl" },
    { value: "3years", label: "3 Yıl" },
    { value: "custom", label: "Özel Tarih" },
];

const formatDate = (date) => format(new Date(date), "dd MMMM yyyy", { locale: tr });

export function BulkExtendModal({ visible, onClose, selectedServices = [], onSuccess }) {
    const [period, setPeriod] = useState("1year");
    const [base, setBase] = useState("end");
    const [customEndDate, setCustomEndDate] = useState(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            setPeriod("1year");
            setBase("end");
            setCustomEndDate(null);
        }
    }, [visible]);

    const isCustom = period === "custom";
    const fromStart = !isCustom && base === "start";
    const limited = selectedServices.filter((s) => s.paymentType !== 'unlimited');
    const unlimitedCount = selectedServices.length - limited.length;
    const waitingForDate = isCustom && !customEndDate;

    // New end date for a service, or null when it would not move forward (skipped).
    // Same rules as extendServices in lib/licences.js.
    const getNewEndDate = (service) => {
        const newEnd = newEndDateFor(service, { period, base, customEndDate });
        return newEnd && newEnd > new Date(service.endingDate) ? newEnd : null;
    };

    const extendable = limited.filter((s) => getNewEndDate(s));
    const notLaterCount = waitingForDate ? 0 : limited.length - extendable.length;

    const handleSubmit = async () => {
        if (extendable.length === 0) return;

        setSubmitting(true);
        try {
            const response = await axios.post('/api/services/extend', {
                serviceIds: extendable.map((s) => s.id),
                period,
                ...(isCustom ? { endingDate: customEndDate.toISOString() } : { base }),
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
                        Seçili hizmetlerin bitiş tarihi uzatılır. Başlangıç tarihi değişmez.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Uzatma Süresi</Label>
                        <div className="flex flex-wrap items-center gap-2">
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

                            {!isCustom && (
                                <Select value={base} onValueChange={setBase}>
                                    <SelectTrigger className="w-56">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BASES.map((b) => (
                                            <SelectItem key={b.value} value={b.value}>
                                                {b.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {isCustom && (
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-56 justify-start text-left font-normal",
                                                !customEndDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {customEndDate ? formatDate(customEndDate) : "Yeni bitiş tarihi seçin"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={customEndDate}
                                            onSelect={(date) => {
                                                setCustomEndDate(date ?? null);
                                                setCalendarOpen(false);
                                            }}
                                            defaultMonth={customEndDate ?? addMonths(new Date(), 12)}
                                            locale={tr}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                        {isCustom && (
                            <p className="text-xs text-muted-foreground">
                                Seçilen tarih tüm seçili hizmetlerin yeni bitiş tarihi olur.
                            </p>
                        )}
                        {fromStart && (
                            <p className="text-xs text-muted-foreground">
                                Süre başlangıç tarihinden sayılır; yeni bitiş tarihi mevcut bitişten sonraki ilk dönem sonu olur
                                (ör. 1 Yıl: başlangıç 03/10/2025, bitiş 10/11/2027 → 03/10/2028).
                            </p>
                        )}
                    </div>

                    {unlimitedCount > 0 && (
                        <p className="text-sm text-amber-600">
                            {unlimitedCount} sınırsız hizmet atlanacak.
                        </p>
                    )}
                    {notLaterCount > 0 && (
                        <p className="text-sm text-amber-600">
                            {notLaterCount} hizmetin yeni bitiş tarihi mevcut bitiş tarihinden sonra olmadığı için atlanacak.
                        </p>
                    )}

                    <div className="border rounded-md divide-y max-h-[320px] overflow-y-auto">
                        {limited.map((service) => {
                            const newEndDate = getNewEndDate(service);
                            return (
                                <div
                                    key={service.id}
                                    className={cn(
                                        "flex flex-wrap items-center justify-between gap-2 p-2 text-sm",
                                        !waitingForDate && !newEndDate && "opacity-50"
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">{service.name}</div>
                                        {service.customer?.name && (
                                            <div className="text-muted-foreground truncate">{service.customer.name}</div>
                                        )}
                                        {fromStart && service.startingDate && (
                                            <div className="text-xs text-muted-foreground">
                                                Başlangıç: {formatDate(service.startingDate)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <span className="text-muted-foreground">{formatDate(service.endingDate)}</span>
                                        {" → "}
                                        {newEndDate ? (
                                            <span className="font-medium text-green-600">{formatDate(newEndDate)}</span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                {waitingForDate ? "—" : "Atlanacak"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {limited.length === 0 && (
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
