import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { findIdsByTurkishSearch } from '@/lib/turkish-search';

export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        // Check if the user has permission to edit physical products
        if (!decoded.permissions.canEditPhysicalProducts) {
            return NextResponse.json({ error: 'Yasak: Fiziksel ürün oluşturma izniniz yok' }, { status: 403 });
        }

        const data = await req.json();

        if (!data) {
            return NextResponse.json(
                { error: 'Request body is empty after parsing' },
                { status: 400 }
            );
        }

        const {
            name,
            description,
            category,
            brand,
            model,
            serialNumber,
            purchasePrice,
            purchaseDate,
            supplier,
            status,
            condition,
            specifications,
            warranty,
            notes,
            location,
            customerID
        } = data;

        // Validate required fields - only category is required now
        if (!category) {
            return NextResponse.json(
                { error: 'Product category is required' },
                { status: 400 }
            );
        }

        // Generate a default name if not provided
        const productName = name?.trim() || `${category} - ${brand || 'Bilinmeyen'} ${model || ''}`.trim();

        // Create the product
        const product = await prisma.physicalProduct.create({
            data: {
                name: productName,
                description: description?.trim() || null,
                category: category || "Bilgisayar",
                brand: brand?.trim() || null,
                model: model?.trim() || null,
                serialNumber: serialNumber?.trim() || null, // Convert empty string to null
                purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                supplier: supplier?.trim() || null,
                status: status || "AVAILABLE",
                condition: condition || "Yeni",
                specifications: specifications?.trim() || null,
                warranty: warranty?.trim() || null,
                notes: notes?.trim() || null,
                location: location?.trim() || null,
                customerID: customerID || null,
            },
            include: {
                customer: true
            }
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        console.error('Product creation error:', error.message);

        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            if (error.meta?.target?.includes('serialNumber')) {
                return NextResponse.json(
                    { error: 'A product with this serial number already exists' },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: 'A product with this data already exists' },
                { status: 409 }
            );
        }

        if (error.code === 'P2003') {
            return NextResponse.json(
                { error: 'Invalid customer ID' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create product', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        let includeCustomer = false;
        // Check if the user has permission to view physical products
        if (!decoded.permissions.canViewPhysicalProducts) {
            return NextResponse.json({ error: 'Yasak: Fiziksel ürün görüntüleme izniniz yok' }, { status: 403 });
        }
        else if (decoded.permissions.canViewCustomers) {
            includeCustomer = true;
        }

        // Get pagination parameters from URL
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 20;
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const statusFilter = searchParams.get('status') || 'all';
        const categoryFilter = searchParams.get('category') || 'all';
        const brandFilter = searchParams.get('brand') || 'all';

        // Calculate skip for pagination
        const skip = (page - 1) * limit;

        // Build where clause for search and filtering
        const whereClause = {};
        
        // Add search conditions
        if (search.trim()) {
            // Case- and Turkish-character-insensitive text search
            const matchingProductIds = await findIdsByTurkishSearch(
                'PhysicalProduct',
                ['name', 'description', 'brand', 'model', 'serialNumber', 'category', 'supplier', 'location'],
                search
            );
            const matchingCustomerIds = includeCustomer
                ? await findIdsByTurkishSearch('Customer', ['name', 'signBoard'], search)
                : [];

            whereClause.OR = [
                { id: { contains: search.trim() } },
                { id: { in: matchingProductIds } },
                ...(includeCustomer ? [
                    { customerID: { contains: search.trim() } },
                    { customerID: { in: matchingCustomerIds } }
                ] : [])
            ];
        }

        // Add status filtering
        if (statusFilter !== 'all') {
            whereClause.status = statusFilter.toUpperCase();
        }

        // Add category filtering
        if (categoryFilter !== 'all') {
            whereClause.category = categoryFilter;
        }

        // Add brand filtering
        if (brandFilter !== 'all') {
            whereClause.brand = brandFilter;
        }

        // Get total count for pagination
        const totalCount = await prisma.physicalProduct.count({
            where: whereClause
        });

        // Get products with pagination
        const products = await prisma.physicalProduct.findMany({
            where: whereClause,
            include: {
                customer: includeCustomer,
            },
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip,
            take: limit,
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);

        // Prepare response data
        const responseData = {
            products: products,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages
            }
        };

        return NextResponse.json(responseData, { status: 200 });
    } catch (error) {
        console.error('Product fetch error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch products', details: error.message },
            { status: 500 }
        );
    }
}
