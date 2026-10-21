// app/admins/page.js
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";


export default function AdminsPage() {
    const [admins, setAdmins] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [formData, setFormData] = useState({
        username: "",
        name: "",
        password: "",
        active: true,
        permissions: {
            canViewCustomers: false,
            canEditCustomers: false,
            canViewServices: false,
            canEditServices: false,
            canViewAdmins: false,
            canEditAdmins: false,
            canSeePasswords: false,
            canViewPhysicalProducts: false,
            canEditPhysicalProducts: false,
            canUseAssistant: false,
        },
    });

    const permissionLabels = {
        canViewCustomers: "Müşterileri Görüntüleme",
        canEditCustomers: "Müşterileri Düzenleme",
        canViewServices: "Hizmetleri Görüntüleme",
        canEditServices: "Hizmetleri Düzenleme",
        canViewAdmins: "Yöneticileri Görüntüleme",
        canEditAdmins: "Yöneticileri Düzenleme",
        canSeePasswords: "Şifreleri Görüntüleme",
        canViewPhysicalProducts: "Fiziksel Ürünleri Görüntüleme",
        canEditPhysicalProducts: "Fiziksel Ürünleri Düzenleme",
        canUseAssistant: "Asistan Kullanabilir (ChatGPT / Claude)",
    };

    // Turns a failed API response into an Error carrying the server's own message
    const responseError = async (response, fallback) => {
        const data = await response.json().catch(() => ({}));
        return new Error(data.error || data.message || fallback);
    };

    const fetchAdmins = async () => {
        try {
            const response = await fetch("/api/admins");
            if (!response.ok) throw await responseError(response, "Yöneticiler yüklenemedi");
            setAdmins(await response.json());
        } catch (error) {
            console.log('Error fetching admins:', error);
            toast.error(error.message);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const url = editingAdmin
                ? `/api/admins/${editingAdmin.id}`
                : "/api/admins";
            const method = editingAdmin ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw await responseError(response, "Yönetici kaydedilemedi");

            toast.success(editingAdmin
                ? "Yönetici güncellendi"
                : "Yeni yönetici oluşturuldu"
            );

            setIsDialogOpen(false);
            fetchAdmins();
        } catch (error) {
            console.log('Error creating or updating admin:', error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (admin) => {
        if (!confirm("Bu yöneticiyi silmek istediğinizden emin misiniz?")) return;

        try {
            const response = await fetch(`/api/admins`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: admin.id }),
            });

            if (!response.ok) throw await responseError(response, "Yönetici silinemedi");

            toast.success("Yönetici silindi");
            fetchAdmins();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleAddNew = () => {
        setEditingAdmin(null);
        setFormData({
            username: "",
            name: "",
            password: "",
            active: true,
            permissions: {
                canViewCustomers: false,
                canEditCustomers: false,
                canViewServices: false,
                canEditServices: false,
                canViewAdmins: false,
                canEditAdmins: false,
                canSeePasswords: false,
                canViewPhysicalProducts: false,
                canEditPhysicalProducts: false,
                canUseAssistant: false,
            },
        });
        setShowPassword(false);
        setIsDialogOpen(true);
    };

    const handleEdit = (admin) => {
        setEditingAdmin(admin);
        setFormData({
            username: admin.username,
            name: admin.name,
            password: "",
            active: admin.active,
            permissions: {
                canViewCustomers: admin.canViewCustomers,
                canEditCustomers: admin.canEditCustomers,
                canViewServices: admin.canViewServices,
                canEditServices: admin.canEditServices,
                canViewAdmins: admin.canViewAdmins,
                canEditAdmins: admin.canEditAdmins,
                canSeePasswords: admin.canSeePasswords,
                canViewPhysicalProducts: admin.canViewPhysicalProducts,
                canEditPhysicalProducts: admin.canEditPhysicalProducts,
                canUseAssistant: admin.canUseAssistant,
            },
        });
        setShowPassword(false);
        setIsDialogOpen(true);
    };

    return (
        <div className="w-full min-h-full p-6 pt-10">
            <div className="flex items-center mb-6">
                <Button onClick={handleAddNew} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Yeni Yönetici Ekle
                </Button>
                <h1 className="text-2xl font-bold ml-4">Yönetici Paneli</h1>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Kullanıcı Adı</TableHead>
                        <TableHead>İsim</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {admins.length > 0 && admins.map((admin) => (
                        <TableRow key={admin.id}>
                            <TableCell>{admin.username}</TableCell>
                            <TableCell>{admin.name}</TableCell>
                            <TableCell>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs ${admin.active
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                        }`}
                                >
                                    {admin.active ? "Aktif" : "Pasif"}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(admin)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(admin)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAdmin ? "Yönetici Düzenle" : "Yeni Yönetici Oluştur"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right">Kullanıcı Adı</label>
                                <Input
                                    className="col-span-3"
                                    value={formData.username}
                                    onChange={(e) =>
                                        setFormData({ ...formData, username: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right">İsim</label>
                                <Input
                                    className="col-span-3"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right">Şifre</label>
                                <div className="col-span-3 relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) =>
                                            setFormData({ ...formData, password: e.target.value })
                                        }
                                        required={!editingAdmin}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-2 top-1/2 -translate-y-1/2"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right">Aktif</label>
                                <Switch
                                    checked={formData.active}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, active: checked })
                                    }
                                />
                            </div>

                            <div className="mt-4">
                                <h3 className="font-medium mb-2">Yetkiler</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(formData.permissions).map(([key, value]) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Switch
                                                checked={value}
                                                onCheckedChange={(checked) =>
                                                    setFormData({
                                                        ...formData,
                                                        permissions: {
                                                            ...formData.permissions,
                                                            [key]: checked,
                                                        },
                                                    })
                                                }
                                            />
                                            <label>{permissionLabels[key]}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Kaydediliyor..." : "Kaydet"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}