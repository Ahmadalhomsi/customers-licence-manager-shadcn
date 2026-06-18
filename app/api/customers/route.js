import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt'; // You'll need to create this helper
import { addYears, subWeeks } from 'date-fns';  // Use date-fns to handle date calculations
import { generateSecurePassword } from '@/lib/utils';

export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        // Check if the user has permission to create customers
        if (!decoded.permissions.canEditCustomers) {
            return NextResponse.json({ error: 'Yasak: Müşteri oluşturma izniniz yok' }, { status: 403 });
        }

        // Extract request body
        const { name, signBoard, email, phone, password } = await req.json();

        // Generate a secure password if none provided
        const finalPassword = password || generateSecurePassword(12, {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false, // Don't include symbols for easier typing
            excludeSimilar: true
        });

        // Create the customer
        const customer = await prisma.customer.create({
            data: { name, signBoard, email, phone, password: finalPassword },
        });

        // Return customer data with the generated password (for display purposes)
        const responseData = {
            ...customer,
            generatedPassword: !password ? finalPassword : null // Only include generated password if we created one
        };

        return NextResponse.json(responseData, { status: 201 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Failed to create customer and associated service' }, { status: 500 });
    }
}


export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        let includeService = true;
        // Check if the user has permission to view customers
        if (!decoded.permissions.canViewCustomers) {
            return NextResponse.json({ error: 'Yasak: Müşterileri görüntüleme izniniz yok' }, { status: 403 });
        }

        // Check if the user has permission to view customers
        if (!decoded.permissions.canViewServices) {
            includeService = false;
        }

        // Get pagination parameters from URL
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 20;
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const statusFilter = searchParams.get('status') || 'all';
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        // Calculate skip for pagination
        const skip = (page - 1) * limit;

        // Build where clause for search and date filtering
        const whereClause = {};
        
        // Add search conditions
        if (search) {
            // Check if search term looks like an ID (starts with 'c' for cuid)
            const isIdSearch = search.match(/^c[a-z0-9]+$/i);
            
            if (isIdSearch) {
                // If it looks like an ID, search by exact ID match first, then fallback to text search
                whereClause.OR = [
                    { id: { equals: search } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { signBoard: { contains: search, mode: 'insensitive' } }
                ];
            } else {
                // Regular text search including partial ID search
                whereClause.OR = [
                    { id: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { signBoard: { contains: search, mode: 'insensitive' } }
                ];
            }
        }

        // Add date range filtering
        if (dateFrom || dateTo) {
            whereClause.createdAt = {};
            if (dateFrom) {
                whereClause.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                whereClause.createdAt.lte = new Date(dateTo);
            }
        }

        // For status filtering, we need to get all customers first and then filter
        // because status is calculated based on service dates
        let allCustomers;
        let totalCount;

        if (statusFilter !== 'all') {
            // First, get all customers matching other criteria
            allCustomers = await prisma.customer.findMany({
                where: whereClause,
                include: {
                    services: includeService,
                },
                orderBy: {
                    [sortBy]: sortOrder,
                }
            });

            // Apply status filtering
            const today = new Date();
            // Set time to start of day for consistent comparison
            today.setHours(0, 0, 0, 0);
            
            const filteredCustomers = allCustomers.filter(customer => {
                let hasActive = false;
                let hasOverdue = false;

                if (customer.services?.length > 0) {
                    for (const service of customer.services) {
                        const startDate = new Date(service.startingDate);
                        const endDate = new Date(service.endingDate);
                        
                        // Set time to start of day for consistent comparison
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(23, 59, 59, 999);

                        if (startDate <= today && today <= endDate) hasActive = true;
                        if (endDate < today) hasOverdue = true;
                    }
                }

                const status = hasActive ? 'active' : hasOverdue ? 'overdue' : 'inactive';
                return status === statusFilter;
            });

            // Apply pagination to filtered results
            totalCount = filteredCustomers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            allCustomers = filteredCustomers.slice(startIndex, endIndex);
        } else {
            // No status filter, use regular pagination
            totalCount = await prisma.customer.count({
                where: whereClause
            });

            allCustomers = await prisma.customer.findMany({
                where: whereClause,
                include: {
                    services: includeService,
                },
                orderBy: {
                    [sortBy]: sortOrder,
                },
                skip,
                take: limit,
            });
        }

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);

        // Prepare response data
        const responseData = {
            customers: allCustomers,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages
            }
        };

        // If user can't see passwords, remove them from the response
        if (!decoded.permissions.canSeePasswords) {
            responseData.customers = responseData.customers.map(customer => {
                return {
                    ...customer,
                    password: "", // Set password to empty string
                };
            });
            return NextResponse.json(responseData, { status: 206 });
        }

        // If user has permission, return full data including passwords
        return NextResponse.json(responseData, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

