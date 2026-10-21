import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';  // Import the prisma instance from the file
import { NextResponse } from 'next/server';

const UNLIMITED_END_DATE = new Date('9999-12-31T00:00:00.000Z');

export async function GET(req, { params }) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        // Check if the user has permission to view services
        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const { id } = await params;

        const service = await prisma.service.findUnique({
            where: { id: id },
        });
        return NextResponse.json(service, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        // Check if the user has permission to edit services
        if (!decoded.permissions.canEditServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet güncelleme izniniz yok' }, { status: 403 });
        }

        const { id } = await params;
        const data = await req.json();

        // Fetch the existing service to check current end date and payment type
        const existingService = await prisma.service.findUnique({
            where: { id: id },
        });

        if (!existingService) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        let renewHistoryData = null;

        if (data.endingDate) {
            const newEndingDate = new Date(data.endingDate);
            const currentEndingDate = new Date(existingService.endingDate);

            // Don't create renewals when transitioning to or from unlimited type
            if (newEndingDate > currentEndingDate && 
                data.paymentType !== "unlimited" && 
                existingService.paymentType !== "unlimited") {
                
                // Calculate the difference in days
                const diffInDays = Math.floor((newEndingDate - currentEndingDate) / (1000 * 60 * 60 * 24));

                const allowedRenewalTypes = new Set(["1month", "6months", "1year", "2years", "3years", "custom"]);
                let renewalType = data.renewalType;

                if (!allowedRenewalTypes.has(renewalType)) {
                    if (diffInDays >= 365) {
                        renewalType = "1year";
                    } else if (diffInDays >= 180 && diffInDays < 365) {
                        renewalType = "6months";
                    } else if (diffInDays >= 28 && diffInDays < 180) {
                        renewalType = "1month";
                    } else {
                        renewalType = "custom";
                    }
                }

                renewHistoryData = {
                    name: `${existingService.name} için Yenileme`,
                    type: renewalType,
                    previousEndDate: currentEndingDate,
                    newEndDate: newEndingDate,
                    serviceId: id,
                };
            }
        }

        // Prepare database operations
        const normalizedEndingDate = data.paymentType === 'unlimited'
            ? new Date(UNLIMITED_END_DATE)
            : data.endingDate;

        const updateService = prisma.service.update({
            where: { id: id },
            data: {
                name: data.name,
                description: data.description,
                companyName: data.companyName,
                category: data.category,
                paymentType: data.paymentType,
                periodPrice: data.periodPrice,
                currency: data.currency,
                active: data.active !== undefined ? data.active : undefined,
                startingDate: data.startingDate,
                endingDate: normalizedEndingDate,
                customerID: data.customerID
            },
        });

        const operations = [updateService];

        if (renewHistoryData) {
            operations.push(prisma.renewHistory.create({ data: renewHistoryData }));
        }

        // Execute all operations in a transaction
        const results = await prisma.$transaction(operations);
        const updatedService = results[0];

        return NextResponse.json(updatedService, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { id } = await params;
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet silme izniniz yok' }, { status: 403 });
        }

        await prisma.service.delete({
            where: { id: id },
        });
        return NextResponse.json({ message: 'service deleted' }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
    }
}