import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Logs API request asynchronously without blocking response
 */
async function logApiRequest(logData, responseStatus, responseBody) {
    try {
        await prisma.apiLog.create({
            data: {
                ...logData,
                responseStatus,
                responseBody: JSON.stringify(responseBody)
            }
        });
    } catch (logError) {
        console.error("Error logging request:", logError);
    }
}

/**
 * Creates a trial service for external applications
 */
async function createTrialService(deviceToken, serviceName, companyName, category, terminal, logData = null) {
    // Validate required fields
    if (!deviceToken || !serviceName) {
        const responseBody = { error: 'Missing required fields: deviceToken and serviceName are required' };
        const response = NextResponse.json(responseBody, { status: 400 });
        
        // Log asynchronously without blocking
        if (logData) {
            logApiRequest(logData, 400, responseBody);
        }
        
        return response;
    }

    // Validate input lengths
    if (deviceToken.length > 255) {
        const responseBody = { error: 'Device token is too long (maximum 255 characters)' };
        const response = NextResponse.json(responseBody, { status: 400 });
        
        // Log asynchronously without blocking
        if (logData) {
            logApiRequest(logData, 400, responseBody);
        }
        
        return response;
    }

    if (serviceName.length > 100) {
        const responseBody = { error: 'Service name is too long (maximum 100 characters)' };
        const response = NextResponse.json(responseBody, { status: 400 });
        
        // Log asynchronously without blocking
        if (logData) {
            logApiRequest(logData, 400, responseBody);
        }
        
        return response;
    }

    // Validate company name length if provided
    if (companyName && companyName.length > 100) {
        const responseBody = { error: 'Company name is too long (maximum 100 characters)' };
        const response = NextResponse.json(responseBody, { status: 400 });
        
        // Log asynchronously without blocking
        if (logData) {
            logApiRequest(logData, 400, responseBody);
        }
        
        return response;
    }

    // Validate category if provided
    const validCategories = [
        "Adisyon Programı",
        "QR Menu", 
        "Kurye Uygulaması",
        "Patron Uygulaması",
        "Yemek Sepeti",
        "Migros Yemek",
        "Trendyol Yemek",
        "Getir Yemek"
    ];
    
    if (category && !validCategories.includes(category)) {
        const responseBody = { error: 'Invalid category. Must be one of: ' + validCategories.join(', ') };
        const response = NextResponse.json(responseBody, { status: 400 });
        
        // Log asynchronously without blocking
        if (logData) {
            logApiRequest(logData, 400, responseBody);
        }
        
        return response;
    }

    // Check if a service with the same name and device token already exists
    const existingService = await prisma.service.findFirst({
        where: {
            name: serviceName,
            deviceToken: deviceToken
        }
    });

    if (existingService) {
        // Check if the existing service is still active
        const now = new Date();
        const endDate = new Date(existingService.endingDate);

        if (endDate > now) {
            // Service is still active
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const responseBody = {
                valid: true,
                existingService: true,
                service: {
                    id: existingService.id,
                    name: existingService.name,
                    endingDate: existingService.endingDate,
                    daysRemaining: daysRemaining
                }
            };
            const response = NextResponse.json(responseBody, { status: 200 });
            
            // Update validation type for existing service
            if (logData) {
                logData.validationType = 'Existing Service';
                logApiRequest(logData, 200, responseBody);
            }
            
            return response;
        }
    }

    // Find or create a trial customer
    let trialCustomer = await prisma.customer.findFirst({
        where: {
            name: 'Trial Customer'
        }
    });

    // If no trial customer exists, create one
    if (!trialCustomer) {
        trialCustomer = await prisma.customer.create({
            data: {
                name: 'Trial Customer',
                email: 'trial@example.com',
                phone: '000-000-0000',
                password: 'trial123456'
            }
        });
    }

    // Calculate dates for 15-day trial
    const startingDate = new Date();
    const endingDate = new Date();
    endingDate.setDate(startingDate.getDate() + 15); // Add 15 days

    // Create the trial service
    const service = await prisma.service.create({
        data: {
            name: serviceName,
            description: terminal || null, // Device name
            companyName: companyName || null,
            category: category || "Adisyon Programı",
            paymentType: 'custom',
            periodPrice: 0.0, // Free trial
            currency: 'TL',
            active: true,
            startingDate: startingDate,
            endingDate: endingDate,
            deviceToken: deviceToken,
            terminal: terminal || null,
            customerID: trialCustomer.id
        }
    });

    const responseBody = {
        valid: true,
        newTrialService: true,
        service: {
            id: service.id,
            name: service.name,
            companyName: service.companyName,
            category: service.category,
            startingDate: service.startingDate,
            endingDate: service.endingDate,
            deviceToken: service.deviceToken,
            trialDaysRemaining: 15
        }
    };
    const response = NextResponse.json(responseBody, { status: 201 });
    
    // Log asynchronously without blocking
    if (logData) {
        logApiRequest(logData, 201, responseBody);
    }
    
    return response;
}

export async function POST(request) {
    const data = await request.json();
    const { token, deviceToken, serviceName, companyName, category, terminal } = data;

    // Get client IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get("x-real-ip") || 'unknown';
    const userAgent = request.headers.get("user-agent") || '';

    let logData = {
        endpoint: '/api/external/validation',
        method: 'POST',
        ipAddress,
        userAgent,
        requestBody: JSON.stringify(data),
        serviceName: serviceName || null,
        deviceToken: deviceToken || null,
        validationType: token ? 'Sisteme Giriş' : 'Trial' // Will be updated based on response
    };

    try {
        // If no token is provided, create a trial service
        if (!token) {
            return await createTrialService(deviceToken, serviceName, companyName, category, terminal, logData);
        }

        const service = await prisma.service.findUnique({
            where: { id: token },
        });

        if (!service) {
            console.log("Service not found");
            const responseBody = { valid: false, message: "Service not found" };
            const response = NextResponse.json(responseBody, { status: 404 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 404, responseBody);
            
            return response;
        }

        // Check if service is active first
        if (!service.active) {
            const responseBody = {
                valid: false,
                message: "Service is inactive",
            };
            const response = NextResponse.json(responseBody, { status: 403 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 403, responseBody);
            
            return response;
        }

        const today = new Date();
        const endDate = new Date(service.endingDate);

        if (endDate <= today) {
            const responseBody = {
                valid: false,
                message: "Service has expired",
                endingDate: service.endingDate,
            };
            const response = NextResponse.json(responseBody, { status: 400 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 400, responseBody);
            
            return response;
        }

        if (!service.deviceToken) {
            // Set the device token and update other fields
            const updateData = {
                deviceToken,
                name: serviceName,
            };
            
            // Add companyName if provided
            if (companyName) {
                updateData.companyName = companyName;
            }
            
            // Add terminal if provided
            if (terminal) {
                updateData.terminal = terminal;
            }
            
            await prisma.service.update({
                where: { id: token },
                data: updateData,
            });

            const responseBody = {
                valid: true,
                newDeviceTokenSet: true,
                endingDate: service.endingDate,
            };
            const response = NextResponse.json(responseBody, { status: 200 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 200, responseBody);
            
            return response;
        } else if (service.deviceToken !== deviceToken) {
            const responseBody = {
                valid: false,
                message: "Device token mismatch",
            };
            const response = NextResponse.json(responseBody, { status: 403 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 403, responseBody);
            
            return response;
        } else {
            // Device token matches, but update companyName and terminal if provided
            const updateData = {};
            let needsUpdate = false;
            
            if (companyName && service.companyName !== companyName) {
                updateData.companyName = companyName;
                needsUpdate = true;
            }
            
            if (terminal && service.terminal !== terminal) {
                updateData.terminal = terminal;
                needsUpdate = true;
            }
            
            // Update service if there are changes
            if (needsUpdate) {
                await prisma.service.update({
                    where: { id: token },
                    data: updateData,
                });
            }
            
            const responseBody = {
                valid: true,
                endingDate: service.endingDate,
            };
            const response = NextResponse.json(responseBody, { status: 200 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 200, responseBody);
            
            return response;
        }

    } catch (error) {
        console.error("Error during validation:", error);
        
        // Handle specific Prisma errors for trial service creation
        if (error.code === 'P2002') {
            const responseBody = { error: 'A service with this name already exists for this customer' };
            const response = NextResponse.json(responseBody, { status: 409 });
            
            // Log asynchronously without blocking
            logApiRequest(logData, 409, responseBody);
            
            return response;
        }

        const responseBody = { 
            error: "Internal Server Error", 
            details: error.message 
        };
        const response = NextResponse.json(responseBody, { status: 500 });
        
        // Log asynchronously without blocking
        logApiRequest(logData, 500, responseBody);
        
        return response;
    }
}
