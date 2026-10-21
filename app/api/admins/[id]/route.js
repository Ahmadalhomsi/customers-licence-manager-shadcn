import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyJWT } from "@/lib/jwt";
import { ADMIN_SELECT, pickPermissions } from "@/lib/admin";

export async function PUT(req, { params }) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditAdmins) {
            return NextResponse.json({ error: 'Yasak: Yöneticileri güncelleme izniniz yok' }, { status: 403 });
        }

        const { id } = await params;
        const { username: rawUsername, name, password, active, permissions } = await req.json();
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