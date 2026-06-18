import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';  // Import the prisma instance from the file
import { verifyJWT } from '@/lib/jwt';

export async function PUT(req, { params }) {
    const { id } = await params;
    const { name, signBoard, email, phone, password } = await req.json();

    const token = req.cookies.get("token")?.value;
    const decoded = await verifyJWT(token);

    if (!decoded.permissions.canEditCustomers) {
        return NextResponse.json({ error: 'Yasak: Müşteri güncelleme izniniz yok' }, { status: 403 });
    }

    try {
        // Validate that the customer exists first
        const existingCustomer = await prisma.customer.findUnique({
            where: { id: id }
        });

        if (!existingCustomer) {
            return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });
        }

        const customer = await prisma.customer.update({
            where: { id: id },
            data: { name, signBoard, email, phone, password },
        });
        return NextResponse.json(customer, { status: 200 });
    } catch (error) {
        console.error('Error updating customer:', error);
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { id } = await params;

    const token = req.cookies.get("token")?.value;
    const decoded = await verifyJWT(token);

    if (!decoded.permissions.canEditCustomers) {
        return NextResponse.json({ error: 'Yasak: Müşteri silme izniniz yok' }, { status: 403 });
    }

    try {
        // Check if customer has any services
        const customerWithServices = await prisma.customer.findUnique({
            where: { id },
            include: {
                services: true
            }
        });

        if (!customerWithServices) {
            return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });
        }

        if (customerWithServices.services.length > 0) {
            return NextResponse.json({ 
                error: 'Bu müşteriyi silmeden önce tüm hizmetlerini silmelisiniz',
                serviceCount: customerWithServices.services.length
            }, { status: 400 });
        }

        await prisma.customer.delete({
            where: { id },
        });
        return NextResponse.json({ message: 'customer deleted' }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}