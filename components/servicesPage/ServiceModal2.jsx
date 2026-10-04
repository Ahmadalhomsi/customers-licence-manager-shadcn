import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { BeatLoader } from "react-spinners";
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { turkishIncludes } from "@/lib/turkish-utils";
import { format } from "date-fns";
import { tr } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';

const PAYMENT_TYPES = [
    { value: "Monthly", label: "Aylık" },
    { value: "Yearly", label: "Yıllık" },
];

const DURATIONS = [
    { value: "1month", label: "1 Ay" },
    { value: "6months", label: "6 Ay" },
    { value: "1year", label: "1 Yıl" },
    { value: "2years", label: "2 Yıl" },
    { value: "3years", label: "3 Yıl" },
    { value: "unlimited", label: "Sınırsız" },
    { value: "custom", label: "Özel" },
];

const SERVICE_CATEGORIES = [
    { value: "Adisyon Programı", label: "Adisyon Programı", color: "text-blue-600" },
    { value: "Digital Menü", label: "Digital Menü", color: "text-green-600" },
    { value: "Platform Entegrasyon", label: "Platform Entegrasyon", color: "text-emerald-600" },
    { value: "Kurye Sipariş Uygulaması", label: "Kurye Sipariş Uygulaması", color: "text-cyan-600" },
    { value: "Patron Takip Uygulaması", label: "Patron Takip Uygulaması", color: "text-purple-600" },
    { value: "Garson Sipariş Uygulaması", label: "Garson Sipariş Uygulaması", color: "text-indigo-600" },
    { value: "Android Caller ID Uygulaması", label: "Android Caller ID Uygulaması", color: "text-teal-600" },
    { value: "Yazarkasa Pos Entegrasyonu", label: "Yazarkasa Pos Entegrasyonu", color: "text-slate-600" },
    { value: "Yemek Sepeti", label: "Yemek Sepeti", color: "text-red-600" },
    { value: "Migros Yemek", label: "Migros Yemek", color: "text-orange-600" },
    { value: "Trendyol Yemek", label: "Trendyol Yemek", color: "text-orange-600" },
    { value: "Getir Yemek", label: "Getir Yemek", color: "text-yellow-600" },
];

const EXTENSION_PERIODS = [
    { value: "1month", label: "1 Ay Ekle" },
    { value: "6months", label: "6 Ay Ekle" },
    { value: "1year", label: "1 Yıl Ekle" },
];

const UNLIMITED_END_DATE = new Date('9999-12-31T00:00:00.000Z');

const INITIAL_FORM_STATE = {
    name: "",
    description: "",
    companyName: "",
    category: "Adisyon Programı",
    customerID: "",
    paymentType: "1year",
    periodPrice: "",
    currency: "TL",
    active: true,
    startingDate: new Date(),
    endingDate: (() => {
        const defaultEnd = new Date();
        defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
        return defaultEnd;
    })(),
};

export function ServiceModal2({
    visible,
    onClose,
    onSubmit,
    isLoading = false,
    selectedService,
    customers = [],
    onRefreshCustomers
}) {
    const [isCustomersLoading, setIsCustomersLoading] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [searchQuery, setSearchQuery] = useState("");
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
    const [startDateMonth, setStartDateMonth] = useState(new Date());
    const [endDateMonth, setEndDateMonth] = useState(new Date());
    const [selectedDuration, setSelectedDuration] = useState("1year");
    
    // Customer creation states
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [customerFormData, setCustomerFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: ""
    });
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [customerLicenseTemplates, setCustomerLicenseTemplates] = useState([]);
    const [loadingLicenseTemplates, setLoadingLicenseTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('none');

    useEffect(() => {
        if (visible && selectedService) {
            const paymentType = selectedService.paymentType;
            const isCustom = !DURATIONS.some(d => d.value === paymentType);

            const startingDate = selectedService.startingDate
                ? (selectedService.startingDate instanceof Date
                    ? selectedService.startingDate
                    : new Date(selectedService.startingDate))
                : new Date();

            const endingDate = selectedService.endingDate
                ? (selectedService.endingDate instanceof Date
                    ? selectedService.endingDate
                    : new Date(selectedService.endingDate))
                : (() => {
                    const defaultEnd = new Date(startingDate);
                    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
                    return defaultEnd;
                })();

            setFormData({
                ...selectedService,
                periodPrice: selectedService.periodPrice?.toString() || "",
                startingDate: startingDate,
                endingDate: endingDate,
                paymentType: isCustom ? "custom" : paymentType
            });

            setStartDateMonth(startingDate);
            setEndDateMonth(endingDate);
            setSelectedDuration(isCustom ? "custom" : paymentType);
        } else {
            setFormData({
                ...INITIAL_FORM_STATE,
                paymentType: "1year",
            });
            setSelectedDuration("1year");
        }
    }, [visible, selectedService]);

    useEffect(() => {
        if (selectedDuration !== "custom" && formData.startingDate) {
            const start = new Date(formData.startingDate);
            const end = new Date(start);

            switch (selectedDuration) {
                case "1month":
                    end.setMonth(end.getMonth() + 1);
                    break;
                case "6months":
                    end.setMonth(end.getMonth() + 6);
                    break;
                case "1year":
                    end.setFullYear(end.getFullYear() + 1);
                    break;
                case "2years":
                    end.setFullYear(end.getFullYear() + 2);
                    break;
                case "3years":
                    end.setFullYear(end.getFullYear() + 3);
                    break;
                case "unlimited":
                    end.setTime(UNLIMITED_END_DATE.getTime());
                    break;
            }

            setFormData((prev) => {
                const currentEndTime = prev.endingDate ? prev.endingDate.getTime() : null;
                const newEndTime = end.getTime();

                if (currentEndTime === newEndTime) {
                    return prev;
                }
                return { ...prev, endingDate: end };
            });

            setEndDateMonth(end);
        }
    }, [selectedDuration, formData.startingDate]);

    useEffect(() => {
        const fetchCustomerLicenseTemplates = async () => {
            if (!visible || !formData.customerID) {
                setCustomerLicenseTemplates([]);
                setSelectedTemplateId('none');
                return;
            }

            try {
                setLoadingLicenseTemplates(true);
                const params = new URLSearchParams({
                    customerId: formData.customerID,
                    sortBy: 'endingDate',
                    sortOrder: 'desc',
                    limit: '100'
                });

                const response = await axios.get(`/api/services?${params}`);
                const now = new Date();
                const filteredTemplates = (response.data.services || []).filter((service) => {
                    if (!service?.id) return false;
                    if (selectedService?.id && service.id === selectedService.id) return false;
                    const endDate = new Date(service.endingDate);
                    const category = service.category || '';
                    // Main PC style services are prioritized for cloning new device licenses.
                    return endDate > now && (category === 'Adisyon Programı' || category === 'Yazarkasa Pos Entegrasyonu');
                });

                const uniqueTemplatesMap = new Map();
                filteredTemplates.forEach((service) => {
                    const startLabel = format(new Date(service.startingDate), 'dd/MM/yyyy');
                    const endLabel = format(new Date(service.endingDate), 'dd/MM/yyyy');
                    const signature = `${service.name || ''}|${startLabel}|${endLabel}`;

                    if (!uniqueTemplatesMap.has(signature)) {
                        uniqueTemplatesMap.set(signature, service);
                    }
                });

                const templates = Array.from(uniqueTemplatesMap.values());

                setCustomerLicenseTemplates(templates);
                setSelectedTemplateId('none');
            } catch (error) {
                console.error('Error fetching customer services for template:', error);
                setCustomerLicenseTemplates([]);
            } finally {
                setLoadingLicenseTemplates(false);
            }
        };

        fetchCustomerLicenseTemplates();
    }, [visible, formData.customerID, selectedService?.id]);

    const handleExtendService = (extensionPeriod) => {
        const end = new Date(formData.endingDate);

        switch (extensionPeriod) {
            case "1month":
                end.setMonth(end.getMonth() + 1);
                break;
            case "6months":
                end.setMonth(end.getMonth() + 6);
                break;
            case "1year":
                end.setFullYear(end.getFullYear() + 1);
                break;
        }

        setFormData((prev) => ({
            ...prev,
            endingDate: end,
            renewalType: extensionPeriod
        }));
        setEndDateMonth(end);
    };

    const handleChange = (name, value) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.startingDate || !formData.endingDate || !formData.customerID) {
            alert("Lütfen tüm zorunlu alanları doldurun");
            return;
        }

        if (formData.startingDate > formData.endingDate) {
            alert("Bitiş tarihi başlangıç tarihinden sonra olmalıdır");
            return;
        }

        try {
            const normalizedEndingDate =
                formData.paymentType === 'unlimited'
                    ? new Date(UNLIMITED_END_DATE)
                    : formData.endingDate;

            await onSubmit({
                ...formData,
                endingDate: normalizedEndingDate,
                periodPrice: 0,
            });
            onClose();
            setFormData(INITIAL_FORM_STATE);
        } catch (error) {
            console.error("Gönderim hatası:", error);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
        }
    };

    // Customer creation functions
    const handleCustomerFormChange = (name, value) => {
        setCustomerFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateCustomer = async () => {
        if (!customerFormData.name.trim()) {
            toast.error('Müşteri adı gereklidir');
            return;
        }

        setIsCreatingCustomer(true);
        try {
            const requestData = {
                name: customerFormData.name.trim(),
                email: customerFormData.email.trim() || null,
                phone: customerFormData.phone.trim() || null
            };

            // Only include password if one was provided
            if (customerFormData.password.trim()) {
                requestData.password = customerFormData.password.trim();
            }

            const response = await axios.post('/api/customers', requestData);

            if (response.data) {
                // Check if a password was auto-generated
                if (response.data.generatedPassword) {
                    setGeneratedPassword(response.data.generatedPassword);
                    toast.success(`Müşteri oluşturuldu! Otomatik şifre: ${response.data.generatedPassword}`);
                } else {
                    toast.success('Müşteri başarıyla oluşturuldu');
                }
                
                // Refresh customers list
                if (onRefreshCustomers) {
                    await onRefreshCustomers();
                }
                
                // Select the newly created customer
                handleChange("customerID", response.data.id);
                
                // Reset form and close
                setCustomerFormData({ name: "", email: "", phone: "", password: "" });
                setShowCustomerForm(false);
                setOpenCustomerCombobox(false);
            }
        } catch (error) {
            console.error('Error creating customer:', error);
            toast.error('Müşteri oluşturulurken hata oluştu');
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    const cancelCustomerCreation = () => {
        setCustomerFormData({ name: "", email: "", phone: "", password: "" });
        setShowCustomerForm(false);
        setGeneratedPassword(null);
    };

    const applyMainLicenseTemplate = () => {
        if (!selectedTemplateId || selectedTemplateId === 'none') {
            toast.error('Lütfen önce ana lisans seçin');
            return;
        }

        const template = customerLicenseTemplates.find((service) => service.id === selectedTemplateId);
        if (!template) {
            toast.error('Seçilen lisans bulunamadı');
            return;
        }

        const startingDate = new Date(template.startingDate);
        const endingDate = new Date(template.endingDate);
        const paymentType = DURATIONS.some((d) => d.value === template.paymentType) ? template.paymentType : 'custom';
        const nextPeriodPrice = template.periodPrice?.toString() || formData.periodPrice;

        const isSameTemplateAlreadyApplied =
            (formData.companyName || '') === (template.companyName || formData.companyName || '') &&
            (formData.currency || '') === (template.currency || formData.currency || '') &&
            (formData.paymentType || '') === paymentType &&
            (formData.periodPrice || '') === nextPeriodPrice &&
            formData.startingDate?.getTime?.() === startingDate.getTime() &&
            formData.endingDate?.getTime?.() === endingDate.getTime();

        if (isSameTemplateAlreadyApplied) {
            toast.info('Bu lisans zaten uygulanmış');
            return;
        }

        setFormData((prev) => ({
            ...prev,
            companyName: template.companyName || prev.companyName,
            currency: template.currency || prev.currency,
            periodPrice: nextPeriodPrice,
            paymentType,
            startingDate,
            endingDate
        }));

        setSelectedDuration(paymentType);
        setStartDateMonth(startingDate);
        setEndDateMonth(endingDate);

        toast.success('Ana PC lisans tarihleri ve ödeme bilgileri kopyalandı');
    };

    const selectedCustomer = customers.find((c) => c.id === formData.customerID);

    return (
        <Dialog open={visible} onOpenChange={onClose}>
            <DialogContent
                className="sm:max-w-3xl w-full max-w-[95vw] max-h-[95vh] overflow-y-auto p-4 sm:p-6"
                onKeyDown={handleKeyDown}
            >
                <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                        {selectedService ? "Hizmeti Düzenle" : "Yeni Hizmet Oluştur"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 sm:gap-6 py-2 sm:py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label className="text-left sm:text-right">
                            Müşteri <span className="text-red-500">*</span>
                        </Label>
                        <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full sm:col-span-3 justify-between"
                                >
                                    {selectedCustomer ? selectedCustomer.name : "Müşteri seçin..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0 pointer-events-auto">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder="Müşteri ara..."
                                        value={searchQuery}
                                        onValueChange={setSearchQuery}
                                    />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        {isCustomersLoading ? (
                                            <div className="py-6 text-center text-sm">
                                                <BeatLoader size={8} className="inline-block" />
                                            </div>
                                        ) : (
                                            <CommandGroup>
                                                {customers
                                                    .filter((customer) =>
                                                        turkishIncludes(customer.name, searchQuery) || turkishIncludes(customer.signBoard, searchQuery)
                                                    )
                                                    .map((customer) => (
                                                        <CommandItem
                                                            key={customer.id}
                                                            value={customer.id}
                                                            onSelect={() => {
                                                                handleChange("customerID", customer.id);
                                                                setOpenCustomerCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formData.customerID === customer.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {customer.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        )}
                                        <CommandEmpty>Müşteri bulunamadı</CommandEmpty>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Quick Customer Creation Button */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <div></div>
                        <div className="sm:col-span-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCustomerForm(true)}
                                className="w-full text-sm text-muted-foreground hover:text-foreground"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Yeni Müşteri Oluştur
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label className="text-left sm:text-right">Ana PC Lisansı</Label>
                        <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2">
                            <Select
                                value={selectedTemplateId}
                                onValueChange={setSelectedTemplateId}
                                disabled={!formData.customerID || loadingLicenseTemplates || customerLicenseTemplates.length === 0}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            !formData.customerID
                                                ? 'Önce müşteri seçin'
                                                : loadingLicenseTemplates
                                                    ? 'Lisanslar yükleniyor...'
                                                    : customerLicenseTemplates.length === 0
                                                        ? 'Kopyalanacak aktif ana lisans yok'
                                                        : 'Kopyalanacak lisans seçin'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Seçiniz</SelectItem>
                                    {customerLicenseTemplates.map((service) => (
                                        <SelectItem key={service.id} value={service.id}>
                                            {service.name} | {format(new Date(service.startingDate), 'dd/MM/yyyy')} - {format(new Date(service.endingDate), 'dd/MM/yyyy')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={applyMainLicenseTemplate}
                                disabled={!formData.customerID || loadingLicenseTemplates || selectedTemplateId === 'none'}
                            >
                                Lisansı Kopyala
                            </Button>
                        </div>
                    </div>

                    {/* Customer Creation Form */}
                    {showCustomerForm && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-medium">Yeni Müşteri Oluştur</h4>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelCustomerCreation}
                                >
                                    ✕
                                </Button>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                    <Label className="text-left sm:text-right">
                                        Ad <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={customerFormData.name}
                                        onChange={(e) => handleCustomerFormChange("name", e.target.value)}
                                        placeholder="Müşteri adı"
                                        className="sm:col-span-3"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                    <Label className="text-left sm:text-right">E-posta</Label>
                                    <Input
                                        type="email"
                                        value={customerFormData.email}
                                        onChange={(e) => handleCustomerFormChange("email", e.target.value)}
                                        placeholder="ornek@email.com"
                                        className="sm:col-span-3"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                    <Label className="text-left sm:text-right">Telefon</Label>
                                    <Input
                                        value={customerFormData.phone}
                                        onChange={(e) => handleCustomerFormChange("phone", e.target.value)}
                                        placeholder="+90 XXX XXX XX XX"
                                        className="sm:col-span-3"
                                        autoComplete="new-phone"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                    <Label className="text-left sm:text-right">Şifre</Label>
                                    <div className="sm:col-span-3">
                                        <Input
                                            type="password"
                                            value={customerFormData.password}
                                            onChange={(e) => handleCustomerFormChange("password", e.target.value)}
                                            placeholder="Boş bırakırsanız otomatik oluşturulur"
                                            autoComplete="new-password"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Şifre boş bırakılırsa güvenli bir şifre otomatik olarak oluşturulacaktır
                                        </p>
                                    </div>
                                </div>

                                {generatedPassword && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <div className="text-green-800 font-medium">Otomatik Oluşturulan Şifre:</div>
                                            <code className="bg-green-100 px-2 py-1 rounded text-green-900 font-mono">
                                                {generatedPassword}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedPassword);
                                                    toast.success('Şifre kopyalandı!');
                                                }}
                                                className="h-6 w-6 p-0"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-green-700 mt-1">
                                            Bu şifreyi not alın! Müşteri giriş yaparken kullanacak.
                                        </p>
                                    </div>
                                )}
                                
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelCustomerCreation}
                                    >
                                        İptal
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCreateCustomer}
                                        disabled={isCreatingCustomer || !customerFormData.name.trim()}
                                    >
                                        {isCreatingCustomer ? (
                                            <>
                                                <BeatLoader size={4} className="mr-2" />
                                                Oluşturuluyor...
                                            </>
                                        ) : (
                                            'Oluştur'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="name" className="text-left sm:text-right">
                            Hizmet Adı <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full sm:col-span-3"
                            placeholder="Hizmet adını girin"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="description" className="text-left sm:text-right">
                            Açıklama
                        </Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleChange("description", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full sm:col-span-3"
                            placeholder="Hizmet açıklaması girin"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="companyName" className="text-left sm:text-right">
                            İşletme Adı
                        </Label>
                        <Input
                            id="companyName"
                            value={formData.companyName || ''}
                            onChange={(e) => handleChange("companyName", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full sm:col-span-3"
                            placeholder="İşletme adını girin"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="category" className="text-left sm:text-right">
                            Kategori
                        </Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => handleChange("category", value)}
                        >
                            <SelectTrigger className="w-full sm:col-span-3">
                                <SelectValue placeholder="Kategori seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICE_CATEGORIES.map((category) => (
                                    <SelectItem key={category.value} value={category.value}>
                                        <span className={category.color}>
                                            {category.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Active Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="active" className="text-left sm:text-right">
                            Durum
                        </Label>
                        <div className="w-full sm:col-span-3 flex items-center gap-3">
                            <Switch
                                id="active"
                                checked={formData.active}
                                onCheckedChange={(checked) => handleChange("active", checked)}
                            />
                            <Label htmlFor="active" className="text-sm">
                                {formData.active ? "Aktif" : "Pasif"}
                            </Label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                        <Label className="text-left sm:text-right sm:pt-2">
                            Tarihler <span className="text-red-500">*</span>
                        </Label>
                        <div className="w-full sm:col-span-3 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                <Label className="text-left sm:text-right">Ödeme Tipi</Label>
                                <Select
                                    value={formData.paymentType}
                                    onValueChange={(value) => {
                                        handleChange("paymentType", value);
                                        setSelectedDuration(value);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:col-span-3">
                                        <SelectValue placeholder="Süre seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DURATIONS.map((duration) => (
                                            <SelectItem key={duration.value} value={duration.value}>
                                                {duration.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedService && (
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                    <Label className="text-left sm:text-right">Süre Uzatma</Label>
                                    <Select
                                        onValueChange={handleExtendService}
                                    >
                                        <SelectTrigger className="w-full sm:col-span-3">
                                            <SelectValue placeholder="Süre uzatmak için seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EXTENSION_PERIODS.map((period) => (
                                                <SelectItem key={period.value} value={period.value}>
                                                    {period.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex flex-col gap-2 w-full">
                                    <Label>
                                        Başlangıç Tarihi <span className="text-red-500">*</span>
                                    </Label>
                                    <Calendar
                                        mode="single"
                                        selected={formData.startingDate}
                                        onSelect={(date) => {
                                            handleChange("startingDate", date);
                                            handleChange("paymentType", "custom");
                                            setSelectedDuration("custom");
                                        }}
                                        month={startDateMonth}
                                        onMonthChange={setStartDateMonth}
                                        className="rounded-md border w-full"
                                        // disabled={(date) => date < formData.startingDate}
                                        locale={tr}
                                        formatters={{
                                            formatCaption: (date, options) => {
                                                return format(date, "MMMM yyyy", { locale: tr });
                                            },
                                            formatDay: (date) => {
                                                return format(date, "dd", { locale: tr });
                                            }
                                        }}
                                        required
                                    />
                                    <div className="text-sm text-gray-500 mt-1">
                                        {formData.startingDate && format(formData.startingDate, "dd/MM/yyyy")}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                    <Label>
                                        Bitiş Tarihi <span className="text-red-500">*</span>
                                    </Label>
                                    <Calendar
                                        mode="single"
                                        selected={formData.endingDate}
                                        onSelect={(date) => {
                                            handleChange("endingDate", date);
                                            handleChange("paymentType", "custom");
                                            setSelectedDuration("custom");
                                        }}
                                        month={endDateMonth}
                                        onMonthChange={setEndDateMonth}
                                        className="rounded-md border w-full"
                                        disabled={(date) => date < formData.startingDate}
                                        locale={tr}
                                        formatters={{
                                            formatCaption: (date, options) => {
                                                return format(date, "MMMM yyyy", { locale: tr });
                                            },
                                            formatDay: (date) => {
                                                return format(date, "dd", { locale: tr });
                                            }
                                        }}
                                        required
                                    />
                                    <div className="text-sm text-gray-500 mt-1">
                                        {formData.endingDate && format(formData.endingDate, "dd/MM/yyyy")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 mt-4">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="w-full sm:w-auto"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <BeatLoader size={8} color="white" />
                        ) : (
                            selectedService ? "Değişiklikleri Kaydet" : "Hizmet Oluştur"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}