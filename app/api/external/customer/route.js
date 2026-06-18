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
 * Creates a standardized API response
 */
function createStandardResponse(success, valid = null, message, data = null, error = null, status = 200) {
    const responseBody = {
        success,
        message,
        valid: valid !== null ? valid : false,
        data,
        error
    };
    
    return {
        body: responseBody,
        response: NextResponse.json(responseBody, { status })
    };
}

/**
 * Creates a trial service for external applications
 */
async function createTrialService(deviceToken, serviceName, companyName, terminal, version, customerInfo, logData = null) {
    // Validate required fields
    if (!deviceToken || !serviceName) {
        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Missing required fields: deviceToken and serviceName are required', 
            null, 
            { code: 'MISSING_REQUIRED_FIELDS', fields: ['deviceToken', 'serviceName'] }, 
            200
        );
        
        if (logData) {
            logApiRequest(logData, 200, body);
        }
        
        return response;
    }

    // Validate input lengths
    if (deviceToken.length > 255) {
        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Device token is too long (maximum 255 characters)', 
            null, 
            { code: 'VALIDATION_ERROR', field: 'deviceToken', maxLength: 255 }, 
            200
        );
        
        if (logData) {
            logApiRequest(logData, 200, body);
        }
        
        return response;
    }

    if (serviceName.length > 100) {
        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Service name is too long (maximum 100 characters)', 
            null, 
            { code: 'VALIDATION_ERROR', field: 'serviceName', maxLength: 100 }, 
            200
        );
        
        if (logData) {
            logApiRequest(logData, 200, body);
        }
        
        return response;
    }

    if (companyName && companyName.length > 100) {
        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Company name is too long (maximum 100 characters)', 
            null, 
            { code: 'VALIDATION_ERROR', field: 'companyName', maxLength: 100 }, 
            200
        );
        
        if (logData) {
            logApiRequest(logData, 200, body);
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
        const now = new Date();
        const endDate = new Date(existingService.endingDate);

        if (endDate > now) {
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const { body, response } = createStandardResponse(
                true, 
                true, 
                'Service found and is active', 
                {
                    service: {
                        id: existingService.id,
                        name: existingService.name,
                        companyName: existingService.companyName,
                        deviceToken: existingService.deviceToken,
                        startingDate: existingService.startingDate,
                        endingDate: existingService.endingDate,
                        daysRemaining: daysRemaining
                    },
                    serviceType: 'existing',
                    isTrialService: true
                }, 
                null, 
                200
            );
            
            if (logData) {
                logData.validationType = 'Sisteme Giriş';
                logApiRequest(logData, 200, body);
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
    endingDate.setDate(startingDate.getDate() + 15);

    // Create the trial service
    const service = await prisma.service.create({
        data: {
            name: serviceName,
            description: `Trial service - 15 days from ${startingDate.toDateString()}`,
            companyName: companyName || null,
            category: "Adisyon Programı",
            paymentType: 'custom',
            periodPrice: 0.0,
            currency: 'TL',
            active: true,
            startingDate: startingDate,
            endingDate: endingDate,
            deviceToken: deviceToken,
            terminal: terminal || null,
            version: version || null,
            customerID: trialCustomer.id
        }
    });

    // If customer info provided, update the trial customer
    let updatedCustomer = null;
    if (customerInfo && (customerInfo.customerName || customerInfo.signBoard || customerInfo.phone || customerInfo.email)) {
        const customerUpdate = {};
        if (customerInfo.customerName) customerUpdate.name = customerInfo.customerName;
        if (customerInfo.signBoard) customerUpdate.signBoard = customerInfo.signBoard;
        if (customerInfo.phone) customerUpdate.phone = customerInfo.phone;
        if (customerInfo.email) customerUpdate.email = customerInfo.email;

        updatedCustomer = await prisma.customer.update({
            where: { id: trialCustomer.id },
            data: customerUpdate
        });
    }

    const { body, response } = createStandardResponse(
        true, 
        true, 
        'Trial service created successfully', 
        {
            service: {
                id: service.id,
                name: service.name,
                companyName: service.companyName,
                deviceToken: service.deviceToken,
                startingDate: service.startingDate,
                endingDate: service.endingDate,
                daysRemaining: 15
            },
            customer: updatedCustomer ? {
                name: updatedCustomer.name,
                signBoard: updatedCustomer.signBoard,
                phone: updatedCustomer.phone,
                email: updatedCustomer.email
            } : null,
            serviceType: 'new',
            isTrialService: true
        }, 
        null, 
        200
    );
    
    if (logData) {
        logApiRequest(logData, 200, body);
    }
    
    return response;
}

export async function POST(request) {
    const data = await request.json();
    const { 
        deviceToken, 
        serviceName, 
        companyName, 
        terminal, 
        version,
        // Customer info fields (optional)
        customerName,
        signBoard,
        phone,
        email
    } = data;

    // Validate that deviceToken is provided
    if (!deviceToken) {
        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Device token is required', 
            null, 
            { code: 'MISSING_REQUIRED_FIELD', field: 'deviceToken' }, 
            200
        );
        return response;
    }

    // Get client IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get("x-real-ip") || 'unknown';
    const userAgent = request.headers.get("user-agent") || '';

    let logData = {
        endpoint: '/api/external/customer',
        method: 'POST',
        ipAddress,
        userAgent,
        requestBody: JSON.stringify(data),
        serviceName: serviceName || null,
        deviceToken: deviceToken || null,
        validationType: 'Device Token Based',
        version: version || null
    };

    // Customer info object for updates
    const customerInfo = { customerName, signBoard, phone, email };

    try {
        // Look for existing service with this device token
        const service = await prisma.service.findFirst({
            where: { deviceToken: deviceToken },
        });

        if (!service) {
            // No service found with this device token, create a trial service
            logData.validationType = 'Trial';
            return await createTrialService(deviceToken, serviceName, companyName, terminal, version, customerInfo, logData);
        }

        // Service found, perform system login validation
        logData.validationType = 'Sisteme Giriş';

        // BUG FIX: Update service fields FIRST, regardless of active/expired status
        const updateData = {};
        let needsUpdate = false;
        
        // Always update lastLoginDate on successful validation
        updateData.lastLoginDate = new Date();
        needsUpdate = true;
        
        // Update version if provided
        if (version && service.version !== version) {
            updateData.version = version;
            needsUpdate = true;
        }
        
        if (serviceName && service.name !== serviceName) {
            updateData.name = serviceName;
            needsUpdate = true;
        }
        
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
                where: { id: service.id },
                data: updateData,
            });
        }

        // BUG FIX: Update customer info if provided (regardless of active/expired status)
        let updatedCustomer = null;
        const hasCustomerInfo = customerName || signBoard || phone || email;
        if (hasCustomerInfo) {
            const customerUpdate = {};
            if (customerName) customerUpdate.name = customerName;
            if (signBoard) customerUpdate.signBoard = signBoard;
            if (phone) customerUpdate.phone = phone;
            if (email) customerUpdate.email = email;

            updatedCustomer = await prisma.customer.update({
                where: { id: service.customerID },
                data: customerUpdate
            });
        }

        // Now check service status
        if (!service.active) {
            const { body, response } = createStandardResponse(
                true, 
                false, 
                'Service is inactive', 
                {
                    service: {
                        id: service.id,
                        name: serviceName || service.name,
                        companyName: companyName || service.companyName,
                        deviceToken: service.deviceToken,
                        startingDate: service.startingDate,
                        endingDate: service.endingDate,
                        active: service.active
                    },
                    customer: updatedCustomer ? {
                        name: updatedCustomer.name,
                        signBoard: updatedCustomer.signBoard,
                        phone: updatedCustomer.phone,
                        email: updatedCustomer.email
                    } : null,
                    serviceType: 'existing',
                    isTrialService: false
                }, 
                { code: 'SERVICE_INACTIVE' }, 
                200
            );
            
            logApiRequest(logData, 200, body);
            
            return response;
        }

        const today = new Date();
        const endDate = new Date(service.endingDate);

        if (endDate <= today) {
            const { body, response } = createStandardResponse(
                true, 
                false, 
                'Service has expired', 
                {
                    service: {
                        id: service.id,
                        name: serviceName || service.name,
                        companyName: companyName || service.companyName,
                        deviceToken: service.deviceToken,
                        startingDate: service.startingDate,
                        endingDate: service.endingDate,
                        daysRemaining: 0
                    },
                    customer: updatedCustomer ? {
                        name: updatedCustomer.name,
                        signBoard: updatedCustomer.signBoard,
                        phone: updatedCustomer.phone,
                        email: updatedCustomer.email
                    } : null,
                    serviceType: 'existing',
                    isTrialService: false
                }, 
                { code: 'SERVICE_EXPIRED', expiredDate: service.endingDate }, 
                200
            );
            
            logApiRequest(logData, 200, body);
            
            return response;
        }

        // Service is valid and active
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        const { body, response } = createStandardResponse(
            true, 
            true, 
            'Service is valid and active', 
            {
                service: {
                    id: service.id,
                    name: serviceName || service.name,
                    companyName: companyName || service.companyName,
                    deviceToken: service.deviceToken,
                    startingDate: service.startingDate,
                    endingDate: service.endingDate,
                    daysRemaining: daysRemaining
                },
                customer: updatedCustomer ? {
                    name: updatedCustomer.name,
                    signBoard: updatedCustomer.signBoard,
                    phone: updatedCustomer.phone,
                    email: updatedCustomer.email
                } : null,
                serviceType: 'existing',
                isTrialService: false,
                ...(needsUpdate && { updated: true })
            }, 
            null, 
            200
        );
        
        logApiRequest(logData, 200, body);
        
        return response;

    } catch (error) {
        console.error("Error during validation:", error);
        
        if (error.code === 'P2002') {
            const { body, response } = createStandardResponse(
                false, 
                false, 
                'A service with this device token already exists', 
                null, 
                { code: 'DUPLICATE_SERVICE', prismaCode: 'P2002' }, 
                200
            );
            
            logApiRequest(logData, 200, body);
            
            return response;
        }

        const { body, response } = createStandardResponse(
            false, 
            false, 
            'Internal Server Error', 
            null, 
            { code: 'INTERNAL_ERROR', details: error.message }, 
            200
        );
        
        logApiRequest(logData, 200, body);
        
        return response;
    }
}
