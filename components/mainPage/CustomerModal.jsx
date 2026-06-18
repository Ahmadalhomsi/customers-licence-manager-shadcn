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
import { Eye, EyeOff, Shuffle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FormField = ({ label, id, required, optional, ...props }) => (
  <div className="grid gap-2">
    <div className="flex items-center">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {optional && <span className="text-gray-400 text-xs ml-1">(Opsiyonel)</span>}
      </Label>
    </div>
    <div>
      {props.children ? props.children : <Input id={id} {...props} />}
    </div>
  </div>
);

const validatePassword = (password) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    allValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
  };
};

// Function to generate a strong random password
const generateRandomPassword = () => {
  const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  // Ensure at least one of each character type
  let password = '';
  password += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
  password += lowerChars.charAt(Math.floor(Math.random() * lowerChars.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));

  // Fill the rest of the password (total 12 characters)
  const allChars = upperChars + lowerChars + numbers + specialChars;
  for (let i = 0; i < 8; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export function CustomerModal({ visible, onClose, onSubmit, selectedCustomer, customers }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    signBoard: "",
  });
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
    allValid: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (visible) {
      // Pre-fill the form with the selected customer's data, converting null values to empty strings
      setFormData(
        selectedCustomer
          ? { 
              name: selectedCustomer.name || "",
              email: selectedCustomer.email || "",
              phone: selectedCustomer.phone || "",
              password: selectedCustomer.password || "",
              signBoard: selectedCustomer.signBoard || ""
            }
          : { name: "", email: "", phone: "", password: "", signBoard: "" }
      );
      setPasswordValidation({
        minLength: false,
        hasUpper: false,
        hasLower: false,
        hasNumber: false,
        hasSpecial: false,
        allValid: false,
      });
      setErrors({});
    }
  }, [visible, selectedCustomer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "password") {
      setPasswordValidation(validatePassword(value));
    }

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generateRandomPassword();
    setFormData(prev => ({
      ...prev,
      password: newPassword
    }));
    setPasswordValidation(validatePassword(newPassword));
    setShowPassword(true); // Show the generated password

    // Remove any password errors since we've generated a valid one
    if (errors.password) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }

    toast({
      title: "Şifre Oluşturuldu",
      description: "Güçlü bir şifre oluşturuldu.",
    });
  };

  const validateForm = (dataToValidate = formData) => {
    const newErrors = {};

    if (!(dataToValidate.name || "").trim()) {
      newErrors.name = "İsim gereklidir";
    }

    // Email is now optional, but if provided, check for duplicates
    const email = (dataToValidate.email || "").trim();
    if (email && customers.some(c => c.email === email && c.id !== selectedCustomer?.id)) {
      newErrors.email = "Bu email adresi zaten kullanımda";
    }

    // Password validation for new customers or when updating password
    const password = (dataToValidate.password || "").trim();
    if (!selectedCustomer && !password) {
      newErrors.password = "Şifre gereklidir";
    } else if (password) {
      const passwordValid = validatePassword(password);
      if (!passwordValid.allValid) {
        newErrors.password = "Şifre en az 8 karakterden oluşmalı ve en az bir büyük harf, bir küçük harf, bir sayı ve bir özel karakter içermelidir";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    // Auto-generate password if empty for new customers
    let finalFormData = { ...formData };
    
    if (!selectedCustomer && !(formData.password || "").trim()) {
      const newPassword = generateRandomPassword();
      finalFormData.password = newPassword;
      setFormData(prev => ({
        ...prev,
        password: newPassword
      }));
      setPasswordValidation(validatePassword(newPassword));
      setShowPassword(true); // Show the generated password
      
      toast({
        title: "Şifre Otomatik Oluşturuldu",
        description: "Şifre alanı boş olduğu için güçlü bir şifre oluşturuldu.",
      });
    }
    
    if (validateForm(finalFormData)) {
      // Ensure all fields are strings, not null
      const cleanedData = {
        name: (finalFormData.name || "").trim(),
        email: (finalFormData.email || "").trim() || null, // Keep null for empty email
        phone: (finalFormData.phone || "").trim() || null, // Keep null for empty phone
        password: (finalFormData.password || "").trim(),
        signBoard: (finalFormData.signBoard || "").trim() || null // Keep null for empty signBoard
      };
      
      onSubmit(cleanedData);
      onClose();
    } else {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Lütfen formu doğru şekilde doldurun",
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent default form submission behavior
      handleSubmit();
    }
  };

  return (<Dialog open={visible} onOpenChange={onClose}>
    <DialogContent
      className="sm:max-w-[420px] max-h-[600px] overflow-y-auto" // Set max height and enable vertical scrolling
      onKeyDown={handleKeyDown}
    >
      <DialogHeader>
        <DialogTitle>
          {selectedCustomer ? "Müşteri Güncelle" : "Müşteri Ekle"}
        </DialogTitle>
        <div className="text-sm text-muted-foreground flex items-center mt-2">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span className="text-red-500 mr-1">*</span> işaretli alanlar zorunludur.
        </div>
      </DialogHeader>

      <div className="grid gap-6 py-4">
        <FormField
          label="Müşteri Adı"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          required
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && <p className="text-destructive text-sm -mt-4">{errors.name}</p>}

        <FormField
          label="Tabela Adı"
          id="signBoard"
          name="signBoard"
          value={formData.signBoard}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          optional
        />

        <FormField
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          optional // Email is now optional
          className={errors.email ? "border-red-500" : ""}
        />
        {errors.email && <p className="text-destructive text-sm -mt-4">{errors.email}</p>}

        <FormField
          label="Telefon"
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          optional
        />

        <FormField
          label="Şifre"
          id="password"
          required={!selectedCustomer}
          optional={!!selectedCustomer}
        >
          <div className="relative flex">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className={`pr-20 ${errors.password ? "border-red-500" : ""}`}
            />
            <div className="absolute right-0 top-0 h-full flex">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGeneratePassword}
                className="h-full px-2 hover:bg-transparent"
                title="Rastgele şifre oluştur"
              >
                <Shuffle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="h-full px-2 hover:bg-transparent"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </Button>
            </div>
          </div>
          {formData.password && (
            <div className="text-sm mt-2 space-y-1">
              <div className={passwordValidation.minLength ? 'text-green-600' : 'text-destructive'}>
                • En az 8 karakter
              </div>
              <div className={passwordValidation.hasUpper ? 'text-green-600' : 'text-destructive'}>
                • En az bir büyük harf
              </div>
              <div className={passwordValidation.hasLower ? 'text-green-600' : 'text-destructive'}>
                • En az bir küçük harf
              </div>
              <div className={passwordValidation.hasNumber ? 'text-green-600' : 'text-destructive'}>
                • En az bir sayı
              </div>
              <div className={passwordValidation.hasSpecial ? 'text-green-600' : 'text-destructive'}>
                • En az bir özel karakter
              </div>
            </div>
          )}
          {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
        </FormField>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          İptal
        </Button>
        <Button type="submit" onClick={handleSubmit}>
          {selectedCustomer ? "Kaydet" : "Oluştur"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  );
}
