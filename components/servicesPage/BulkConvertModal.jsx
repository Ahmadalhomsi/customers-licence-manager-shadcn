import { useState, useEffect } from "react";
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
import { Check, ChevronsUpDown, Plus, Copy, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { turkishIncludes } from "@/lib/turkish-utils";
import { format } from "date-fns";
import { tr } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';

const DURATIONS = [
    { value: "1month", label: "1 Ay" },
    { value: "6months", label: "6 Ay" },
    { value: "1year", label: "1 Yıl" },
    { value: "2years", label: "2 Yıl" },
    { value: "3years", label: "3 Yıl" },
    { value: "unlimited", label: "Sınırsız" },
];

const UNLIMITED_END_DATE = new Date('9999-12-31T00:00:00.000Z');

export function BulkConvertModal({
    visible,
    onClose,
    selectedServices = [],
    customers = [],
    onRefreshCustomers,
    onSuccess
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
    
    // Form State
    const [selectedCustomerID, setSelectedCustomerID] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [selectedDuration, setSelectedDuration] = useState("1year");
    const [startingDate, setStartingDate] = useState(new Date());
    
    // Customer Creation State
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [customerFormData, setCustomerFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: ""
    });
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            // Try to pre-fill company name from the first selected service if available
            if (selectedServices.length > 0 && selectedServices[0].companyName) {
                setCompanyName(selectedServices[0].companyName);
            } else {
                setCompanyName("");
            }
            setSelectedCustomerID("");
            setSelectedDuration("1year");
            if (selectedServices.length > 0 && selectedServices[0].startingDate) {
                setStartingDate(new Date(selectedServices[0].startingDate));
            } else {
                setStartingDate(new Date());
            }
            setShowCustomerForm(false);
            setCustomerFormData({ name: "", email: "", phone: "", password: "" });
            setGeneratedPassword(null);
        }
    }, [visible, selectedServices]);

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

            if (customerFormData.password.trim()) {
                requestData.password = customerFormData.password.trim();
            }

            const response = await axios.post('/api/customers', requestData);

            if (response.data) {
                if (response.data.generatedPassword) {
                    setGeneratedPassword(response.data.generatedPassword);
                    toast.success(`Müşteri oluşturuldu! Otomatik şifre: ${response.data.generatedPassword}`);
                } else {
                    toast.success('Müşteri başarıyla oluşturuldu');
                }
                
                if (onRefreshCustomers) {
                    await onRefreshCustomers();
                }
                
                setSelectedCustomerID(response.data.id);
                
                // Clear form but keep generated password visible for a moment or until closed
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

    const calculateEndingDate = (start, duration) => {
        const end = new Date(start);
        switch (duration) {
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
            default:
                end.setFullYear(end.getFullYear() + 1);
        }
        return end;
    };

    const findOrCreateCustomer = async (name) => {
        // 1. Try to find existing customer
        const normalizedName = name.toLocaleLowerCase('tr-TR').trim();
        const existingCustomer = customers.find(c => 
            c.name.toLocaleLowerCase('tr-TR').trim() === normalizedName
        );

        if (existingCustomer) {
            return existingCustomer.id;
        }

        // 2. Create new customer
        try {
            const response = await axios.post('/api/customers', {
                name: name.trim(),
            });
            
            toast.success(`Yeni müşteri oluşturuldu: ${name.trim()}`);
            if (response.data.generatedPassword) {
                 // We could show the password, but in bulk flow it might be better to just let it be
            }
            return response.data.id;
        } catch (error) {
            console.error("Auto-create customer failed:", error);
            throw new Error(`Müşteri oluşturulamadı: ${name}`);
        }
    }

    const handleSubmit = async () => {
        let targetCustomerID = selectedCustomerID;
        
        // If no customer selected but we have a company name, try to find or create one
        if (!targetCustomerID && companyName) {
             try {
                 setIsLoading(true);
                 targetCustomerID = await findOrCreateCustomer(companyName);
                 if (onRefreshCustomers) await onRefreshCustomers(); // Refresh list to include new customer
             } catch (error) {
                 toast.error(error.message);
                 setIsLoading(false);
                 return;
             }
        }

        if (!targetCustomerID) {
            toast.error("Lütfen bir müşteri seçin veya İşletme Adı girin");
            setIsLoading(false);
            return;
        }
        
        if (selectedServices.length === 0) {
            toast.error("Seçili hizmet yok");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const endingDate = calculateEndingDate(startingDate, selectedDuration);
            
            // We will update services one by one since we don't have a bulk update endpoint yet
            // Ideally this should be a bulk endpoint for atomicity
            const updatePromises = selectedServices.map(service => {
                const updateData = {
                    ...service,
                    customerID: targetCustomerID,
                    companyName: companyName, // Update company name for all
                    startingDate: startingDate,
                    endingDate: endingDate,
                    paymentType: selectedDuration,
                    // You might want to update periodPrice based on duration if you had price logic here
                    // For now we keep existing logic or maybe we should prompt for price?
                    // Given the user instruction, simplicity is key. 
                    // Usually changing duration implies changing price, but without a price lookup table per service type, 
                    // it's risky to auto-set price to 0 or something. 
                    // However, 'trial' usually has 0 price. 
                    // If converting to 1 year, we probably want to update price.
                    // For now, let's assume the user will edit price later if needed, or we can add a global price input.
                    // Let's add a global price input to the modal? 
                    // No, services might have different prices (e.g. adisyon vs menu).
                    // So we'll just update the dates and customer.
                };
                return axios.put(`/api/services/${service.id}`, updateData);
            });

            await Promise.all(updatePromises);

            toast.success(`${selectedServices.length} hizmet başarıyla dönüştürüldü`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Bulk conversion error:", error);
            toast.error("Hizmetler dönüştürülürken bir hata oluştu");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerID);

    return (
        <Dialog open={visible} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Toplu Hizmet Dönüştürme</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Summary */}
                    <div className="bg-muted/50 p-3 rounded-md text-sm">
                        <span className="font-semibold">{selectedServices.length}</span> adet hizmet seçildi.
                        Bu işlem seçilen tüm hizmetleri aynı müşteri, işletme adı ve süre ile güncelleyecektir.
                    </div>

                    {/* Customer Selection */}
                    <div className="space-y-2">
                        <Label>Müşteri</Label>
                        <div className="text-xs text-muted-foreground mb-1">
                            Seçili müşteri yoksa, İşletme Adı ile aynı isimde müşteri aranır veya oluşturulur.
                        </div>
                        <div className="flex flex-col gap-2">
                            <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between"
                                    >
                                        {selectedCustomer ? selectedCustomer.name : "Müşteri seçin (Opsiyonel)"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0 pointer-events-auto">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Müşteri ara..."
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                        />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
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
                                                                setSelectedCustomerID(customer.id);
                                                                setOpenCustomerCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedCustomerID === customer.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {customer.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                            <CommandEmpty>Müşteri bulunamadı</CommandEmpty>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {!showCustomerForm && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        // Auto-fill name with company name if available
                                        if (companyName) {
                                            setCustomerFormData(prev => ({ ...prev, name: companyName }));
                                        }
                                        setShowCustomerForm(true);
                                    }}
                                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Yeni Müşteri Oluştur
                                </Button>
                            )}

                            {/* Customer Creation Form */}
                            {showCustomerForm && (
                                <div className="border rounded-lg p-4 bg-muted/50 mt-2">
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
                                    
                                    <div className="space-y-3">
                                        <div className="grid gap-2">
                                            <Label>Ad <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={customerFormData.name}
                                                onChange={(e) => handleCustomerFormChange("name", e.target.value)}
                                                placeholder="Müşteri adı"
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="grid gap-2">
                                                <Label>E-posta</Label>
                                                <Input
                                                    type="email"
                                                    value={customerFormData.email}
                                                    onChange={(e) => handleCustomerFormChange("email", e.target.value)}
                                                    placeholder="Email"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Telefon</Label>
                                                <Input
                                                    value={customerFormData.phone}
                                                    onChange={(e) => handleCustomerFormChange("phone", e.target.value)}
                                                    placeholder="Telefon"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Şifre</Label>
                                            <Input
                                                type="password"
                                                value={customerFormData.password}
                                                onChange={(e) => handleCustomerFormChange("password", e.target.value)}
                                                placeholder="Boş bırakırsanız otomatik oluşturulur"
                                            />
                                        </div>
                                        
                                        <div className="flex justify-end gap-2 pt-2">
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
                                                    <BeatLoader size={4} color="white" />
                                                ) : (
                                                    'Oluştur ve Seç'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {generatedPassword && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                                    <div className="text-sm text-green-800">
                                        <span className="font-semibold">Oluşturulan Şifre:</span> {generatedPassword}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedPassword);
                                            toast.success('Şifre kopyalandı');
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Common Settings */}
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>İşletme Adı</Label>
                            <Input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="İşletme adı (tüm hizmetler için güncellenir)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Süre <span className="text-red-500">*</span></Label>
                                <Select
                                    value={selectedDuration}
                                    onValueChange={setSelectedDuration}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Süre seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DURATIONS.map((d) => (
                                            <SelectItem key={d.value} value={d.value}>
                                                {d.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>Başlangıç Tarihi <span className="text-red-500">*</span></Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setStartingDate(new Date())}
                                        className="text-xs h-6 px-2"
                                    >
                                        Bugün
                                    </Button>
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !startingDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startingDate ? format(startingDate, "dd MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={startingDate}
                                            onSelect={setStartingDate}
                                            initialFocus
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {startingDate && (
                                    <div className="text-sm text-muted-foreground">
                                        Seçilen tarih: {format(startingDate, "dd/MM/yyyy", { locale: tr })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || selectedServices.length === 0}
                    >
                        {isLoading ? (
                            <BeatLoader size={8} color="white" />
                        ) : (
                            "Dönüştür"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
