// app\api\admins\route.js
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyJWT } from "@/lib/jwt";
import { ADMIN_SELECT, pickPermissions } from "@/lib/admin";

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewAdmins) {
            return NextResponse.json({ error: 'Yasak: Admin görüntüleme izniniz yok' }, { status: 403 });
        }

        const admins = await prisma.admin.findMany({ select: ADMIN_SELECT });
        return NextResponse.json(admins);
    } catch (error) {
        console.error("Error fetching admins:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

// Create Admin (POST)
export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditAdmins) {
            return NextResponse.json({ error: 'Yasak: Yönetici oluşturma izniniz yok' }, { status: 403 });
        }

        const { username: rawUsername, name, password, active, permissions } = await req.json();
        const username = typeof rawUsername === "string" ? rawUsername.trim() : rawUsername;

        if (!username || !password) {
            return NextResponse.json({ error: 'Kullanıcı adı ve şifre zorunludur' }, { status: 400 });
        }

        const existingAdmin = await prisma.admin.findUnique({ where: { username } });
        if (existingAdmin) {
            return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanılıyor' }, { status: 409 });
        }

        const admin = await prisma.admin.create({
            data: {
                username,
                name,
                active: active !== undefined ? Boolean(active) : true,
                password: await bcrypt.hash(password, 10),
                ...pickPermissions(permissions),
            },
            select: ADMIN_SELECT,
        });

        return NextResponse.json({ message: "Admin created successfully", admin }, { status: 201 });
    } catch (error) {
        console.error("Error creating admin:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

// Update Admin (PUT)
export async function PUT(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditAdmins) {
            return NextResponse.json({ error: 'Yasak: Yöneticileri güncelleme izniniz yok' }, { status: 403 });
        }

        const { id, username: rawUsername, name, password, active, permissions } = await req.json();
        const username = typeof rawUsername === "string" ? rawUsername.trim() : rawUsername;

        // Check if admin exists
        const existingAdmin = await prisma.admin.findUnique({ where: { id } });
        if (!existingAdmin) {
            return NextResponse.json({ message: "Admin not found" }, { status: 404 });
        }

        // Hash password if provided
        let updatedData = { username, name, active, ...pickPermissions(permissions) };
        if (password) {
            updatedData.password = await bcrypt.hash(password, 10);
        }

        // Update admin
        const updatedAdmin = await prisma.admin.update({
            where: { id },
            data: updatedData,
            select: ADMIN_SELECT,
        });

        return NextResponse.json(
            { message: "Admin updated successfully", admin: updatedAdmin },
            { status: 200 }
        );
    } catch (error) {
        console.log("Error updating admin:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

// Delete Admin (DELETE)
export async function DELETE(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditAdmins) {
            return NextResponse.json({ error: 'Yasak: Yönetici silme izniniz yok' }, { status: 403 });
        }

        const { id } = await req.json();

        if (id === decoded.id) {
            return NextResponse.json({ error: 'Kendi hesabınızı silemezsiniz' }, { status: 400 });
        }

        // Check if admin exists
        const existingAdmin = await prisma.admin.findUnique({ where: { id } });
        if (!existingAdmin) {
            return NextResponse.json({ message: "Admin not found" }, { status: 404 });
        }

        // Delete admin
        await prisma.admin.delete({ where: { id } });

        return NextResponse.json({ message: "Admin deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error deleting admin:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
