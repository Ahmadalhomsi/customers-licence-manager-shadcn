import { useEffect, useState } from "react"
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
import { tr } from 'date-fns/locale';
import { MAMENU_CATEGORY, POS_PROVIDERS } from '@/lib/licence-products';


const PAYMENT_TYPES = [
  { value: "1month", label: "1 Ay" }, // Added 1 Month
  { value: "6months", label: "6 Ay" },
  { value: "1year", label: "1 Yıl" },
  { value: "2years", label: "2 Yıl" },
  { value: "3years", label: "3 Yıl" },
  { value: "unlimited", label: "Sınırsız" },
  { value: "custom", label: "Özel" },
];

const SERVICE_CATEGORIES = [
  { value: "Adisyon Programı", label: "Adisyon Programı", color: "text-blue-600" },
  { value: "Platform Entegrasyon", label: "Platform Entegrasyon", color: "text-emerald-600" },
  { value: "QR Menu", label: "QR Menu", color: "text-green-600" },
  { value: "Kurye Uygulaması", label: "Kurye Uygulaması", color: "text-cyan-600" },
  { value: "Patron Uygulaması", label: "Patron Uygulaması", color: "text-purple-600" },
  { value: "Yemek Sepeti", label: "Yemek Sepeti", color: "text-red-600" },
  { value: "Migros Yemek", label: "Migros Yemek", color: "text-orange-600" },
  { value: "Trendyol Yemek", label: "Trendyol Yemek", color: "text-orange-600" },
  { value: "Getir Yemek", label: "Getir Yemek", color: "text-yellow-600" },
  { value: MAMENU_CATEGORY, label: MAMENU_CATEGORY, color: "text-lime-600" },
  ...POS_PROVIDERS.map((provider) => ({ value: provider.category, label: provider.category, color: "text-slate-600" })),
];

const CURRENCIES = [
  { value: "TL", label: "₺" },
  { value: "USD", label: "$" },
  { value: "EUR", label: "€" },
];

const INITIAL_FORM_STATE = {
  name: "",
  description: "",
  companyName: "",
  category: "Adisyon Programı",
  paymentType: "1year", // Will mirror duration selection
  periodPrice: "",
  currency: "TL",
  active: true,
  startingDate: new Date(),
  endingDate: null,
};

export function ServiceModal({
  visible,
  onClose,
  onSubmit,
  selectedCustomer,
  selectedService,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [startDateMonth, setStartDateMonth] = useState(new Date());
  const [endDateMonth, setEndDateMonth] = useState(new Date());


  // Add this state variable
  const [selectedDuration, setSelectedDuration] = useState("1year");

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      paymentType: selectedDuration,
    }));
  }, [selectedDuration]); // This ensures paymentType stays in sync

  useEffect(() => {
    if (selectedService) {
      const parseDate = (dateString) => {
        const utcDate = new Date(dateString);
        return new Date(
          utcDate.getUTCFullYear(),
          utcDate.getUTCMonth(),
          utcDate.getUTCDate()
        );
      };

      const startingDate = parseDate(selectedService.startingDate);
      const endingDate = selectedService.endingDate
        ? parseDate(selectedService.endingDate)
        : null;

      // Calculate initial duration
      let duration = "custom";
      if (endingDate) {
        const startYear = startingDate.getFullYear();
        const startMonth = startingDate.getMonth();
        const startDay = startingDate.getDate();

        const endYear = endingDate.getFullYear();
        const endMonth = endingDate.getMonth();
        const endDay = endingDate.getDate();

        // Check for exact duration matches
        if (
          endYear === startYear + 1 &&
          endMonth === startMonth &&
          endDay === startDay
        ) {
          duration = "1year";
        } else if (
          endYear === startYear + 2 &&
          endMonth === startMonth &&
          endDay === startDay
        ) {
          duration = "2years";
        } else if (
          endYear === startYear + 3 &&
          endMonth === startMonth &&
          endDay === startDay
        ) {
          duration = "3years";
        } else {
          const monthsDiff =
            (endYear - startYear) * 12 + (endMonth - startMonth);
          if (monthsDiff === 6 && endDay === startDay) {
            duration = "6months";
          }
        }
      }

      setFormData({
        ...selectedService,
        startingDate,
        endingDate,
      });
      setSelectedDuration(duration);
      setStartDateMonth(startingDate);
      if (endingDate) setEndDateMonth(endingDate);
    } else {
      setFormData(INITIAL_FORM_STATE);
      setStartDateMonth(new Date());
      setEndDateMonth(new Date());
      setSelectedDuration("custom");
    }
  }, [selectedService]);

  // Calculate duration when dates change
  useEffect(() => {
    const calculateDuration = () => {
      if (!formData.startingDate || !formData.endingDate) {
        setSelectedDuration("custom");
        return;
      }

      // Compare UTC dates
      const start = new Date(formData.startingDate);
      const end = new Date(formData.endingDate);

      // Get UTC date components
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();

      const endYear = end.getUTCFullYear();
      const endMonth = end.getUTCMonth();
      const endDay = end.getUTCDate();

      // Check for exact duration matches using UTC components
      if (
        endYear === startYear + 1 &&
        endMonth === startMonth &&
        endDay === startDay
      ) {
        setSelectedDuration("1year");
      } else if (
        endYear === startYear + 2 &&
        endMonth === startMonth &&
        endDay === startDay
      ) {
        setSelectedDuration("2years");
      } else if (
        endYear === startYear + 3 &&
        endMonth === startMonth &&
        endDay === startDay
      ) {
        setSelectedDuration("3years");
      } else {
        const monthsDiff =
          (endYear - startYear) * 12 + (endMonth - startMonth);
        if (monthsDiff === 6 && endDay === startDay) {
          setSelectedDuration("6months");
        } else if (monthsDiff === 1 && endDay === startDay) {
          setSelectedDuration("1month");
        } else {
          setSelectedDuration("custom");
        }
      }
    };

    calculateDuration();
  }, [formData.startingDate, formData.endingDate]);

  useEffect(() => {
    if (selectedDuration !== "custom" && formData.startingDate) {
      const start = new Date(formData.startingDate);
      const end = new Date(start);

      switch (selectedDuration) {
        case "1month":
          end.setUTCMonth(end.getUTCMonth() + 1);
          break;
        case "6months":
          end.setUTCMonth(end.getUTCMonth() + 6);
          break;
        case "1year":
          end.setUTCFullYear(end.getUTCFullYear() + 1);
          break;
        case "2years":
          end.setUTCFullYear(end.getUTCFullYear() + 2);
          break;
        case "3years":
          end.setUTCFullYear(end.getUTCFullYear() + 3);
          break;
        case "unlimited":
          end.setUTCFullYear(end.getUTCFullYear() + 100); // Set 100 years in the future for "unlimited"
          break;
      }

      // Normalize to UTC midnight
      const normalizedEnd = new Date(Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate()
      ));

      setFormData((prev) => ({ ...prev, endingDate: normalizedEnd }));
      setEndDateMonth(normalizedEnd);
    }
  }, [selectedDuration, formData.startingDate]);

  const handleChange = (name, value) => {
    if (name === "endingDate") {
      setSelectedDuration("custom");
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Update the form validation in handleSubmit
  const handleSubmit = async () => {
    // Add endingDate to required fields check
    if (!formData.name || !formData.startingDate || !formData.endingDate) {
      alert("Lütfen tüm alanları doldurunuz");
      return;
    }

    if (formData.startingDate > formData.endingDate) {
      alert("Başlangıç tarihi bitiş tarihinden büyük olamaz");
      return;
    }

    // Rest remains the same
    setIsLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
      setIsLoading(false);
    }
  };



  // Handle "Enter" key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // Add this to prevent event bubbling
      handleSubmit();
    }
  };

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-3xl w-full max-w-[95vw] max-h-[95vh] overflow-y-auto p-4 sm:p-6"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {selectedService ? "Hizmet Güncelle" : "Hizmet Ekle"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:gap-6 py-2 sm:py-4">
          {/* Service Name */}
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="name" className="text-left sm:text-right">
              Hizmet Adı <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:col-span-3"
              placeholder="Hizmet adı giriniz"
              required
            />
          </div>

          {/* Description */}
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="description" className="text-left sm:text-right">
              Açıklama
            </Label>
            <Input
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:col-span-3"
              placeholder="Enter service description"
            />
          </div>

          {/* Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="companyName" className="text-left sm:text-right">
              İşletme Adı
            </Label>
            <Input
              id="companyName"
              value={formData.companyName || ""}
              onChange={(e) => handleChange("companyName", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:col-span-3"
              placeholder="İşletme adını giriniz"
            />
          </div>

          {/* Category */}
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

          {/* Price */}
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label className="text-left sm:text-right">Fiyat</Label>
            <div className="w-full sm:col-span-3 flex flex-col sm:flex-row gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.periodPrice || ""}
                onChange={(e) =>
                  handleChange("periodPrice", parseFloat(e.target.value) || 0)
                }
                onKeyDown={handleKeyDown}
                className="w-full"
                placeholder="0.00"
              />
              <Select
                value={formData.currency}
                onValueChange={(value) => handleChange("currency", value)}
              >
                <SelectTrigger className="w-full sm:w-24">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates Section */}
          <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
            <Label className="text-left sm:text-right sm:pt-2">
              Tarih <span className="text-red-500">*</span>
            </Label>
            <div className="w-full sm:col-span-3 space-y-4">
              {/* Payment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label className="text-left sm:text-right">Süre</Label>
                <Select
                  value={selectedDuration}
                  onValueChange={(value) => {
                    setSelectedDuration(value); // Only set selectedDuration here
                  }}
                >
                  <SelectTrigger className="w-full sm:col-span-3">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Pickers */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col gap-2 w-full">
                  <Label>
                    Başlangıç Tarihi
                    <span className="text-red-500">*</span>
                  </Label>
                  <Calendar
                    mode="single"
                    selected={formData.startingDate}
                    onSelect={(date) => {
                      const utcDate = new Date(Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      ));
                      handleChange("startingDate", utcDate);
                    }}
                    month={startDateMonth}
                    onMonthChange={setStartDateMonth}
                    className="rounded-md border w-full"
                    required
                    locale={tr}
                    weekStartsOn={1}
                    formatters={{
                      formatWeekday: (date) => {
                        return date.toLocaleDateString('tr', { weekday: 'short' });
                      },
                      formatCaption: (date) => {
                        return date.toLocaleDateString('tr', { month: 'long', year: 'numeric' });
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Label>
                    Bitiş Tarihi
                    <span className="text-red-500">*</span>
                  </Label>
                  <Calendar
                    mode="single"
                    selected={formData.endingDate}
                    onSelect={(date) => {
                      const utcDate = new Date(Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      ));
                      handleChange("endingDate", utcDate);
                    }}
                    month={endDateMonth}
                    onMonthChange={setEndDateMonth}
                    className="rounded-md border w-full"
                    // disabled={(date) => date < formData.startingDate}
                    required
                    locale={tr}
                    weekStartsOn={1}
                    formatters={{
                      formatWeekday: (date) => {
                        return date.toLocaleDateString('tr', { weekday: 'short' });
                      },
                      formatCaption: (date) => {
                        return date.toLocaleDateString('tr', { month: 'long', year: 'numeric' });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
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
              selectedService ? "Kaydet" : "Oluştur"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ServiceModal;