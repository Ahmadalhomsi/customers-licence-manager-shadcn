import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createTurkishSearchConditions } from '@/lib/turkish-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const requestedLimit = parseInt(searchParams.get('limit') || '20');
    const limit = Math.min(100, Math.max(1, requestedLimit)); // Normal pagination limit
    const skip = (page - 1) * limit;
    
    const search = searchParams.get('search');
    const validationType = searchParams.get('validationType');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Individual field searches
    const ipAddress = searchParams.get('ipAddress');
    const serviceName = searchParams.get('serviceName'); 
    const companyName = searchParams.get('companyName');
    const customerName = searchParams.get('customerName');
    const endpoint = searchParams.get('endpoint');
    const terminal = searchParams.get('terminal');
    const serviceId = searchParams.get('serviceId');
    
    // Build where clause
    const where: any = {};
    const andConditions: any[] = [];
    
    // Handle general search (when no specific fields are provided)
    if (search && !ipAddress && !serviceName && !companyName && !customerName && !endpoint && !terminal && !serviceId) {
      // First, find customer IDs that match the search term
      const matchingCustomers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { signBoard: { contains: search, mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      });

      // Find services that belong to matching customers
      const matchingServices = await prisma.service.findMany({
        where: {
          customerID: { in: matchingCustomers.map(c => c.id) }
        },
        select: { name: true }
      });

      const serviceNames = matchingServices.map(s => s.name);

      where.OR = [
        {
          ipAddress: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          serviceName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          requestBody: {
            contains: search,
            mode: 'insensitive'
          }
        },
        // Include logs for services that belong to matching customers
        ...(serviceNames.length > 0 ? [{
          serviceName: {
            in: serviceNames
          }
        }] : [])
      ];
    }
    
    // Handle specific field searches
    if (ipAddress) {
      andConditions.push({
        ipAddress: { contains: ipAddress, mode: 'insensitive' }
      });
    }
    
    if (serviceName) {
      andConditions.push({
        serviceName: { contains: serviceName, mode: 'insensitive' }
      });
    }
    
    if (endpoint) {
      andConditions.push({
        endpoint: { contains: endpoint, mode: 'insensitive' }
      });
    }
    
    // For company name and terminal, search in requestBody JSON with flexible patterns
    if (companyName) {
      // Search with multiple patterns to handle different JSON formatting and partial matches
      andConditions.push({
        OR: [
          { requestBody: { contains: companyName, mode: 'insensitive' } }, // General search in JSON
          { requestBody: { contains: `"companyName":"${companyName}"`, mode: 'insensitive' } },
          { requestBody: { contains: `"companyName": "${companyName}"`, mode: 'insensitive' } },
          { requestBody: { contains: `companyName":"${companyName}"`, mode: 'insensitive' } },
          { requestBody: { contains: `companyName": "${companyName}"`, mode: 'insensitive' } }
        ]
      });
    }
    
    if (terminal) {
      // Search with multiple patterns to handle different JSON formatting and partial matches  
      andConditions.push({
        OR: [
          { requestBody: { contains: terminal, mode: 'insensitive' } }, // General search in JSON
          { requestBody: { contains: `"terminal":"${terminal}"`, mode: 'insensitive' } },
          { requestBody: { contains: `"terminal": "${terminal}"`, mode: 'insensitive' } },
          { requestBody: { contains: `terminal":"${terminal}"`, mode: 'insensitive' } },
          { requestBody: { contains: `terminal": "${terminal}"`, mode: 'insensitive' } }
        ]
      });
    }
    
    // For service ID search, find services by ID and match their names/deviceTokens
    if (serviceId) {
      try {
        const service = await prisma.service.findUnique({
          where: { id: serviceId },
          select: { name: true, deviceToken: true }
        });
        
        if (service) {
          // Create a specific match condition for this exact service
          if (service.name && service.deviceToken) {
            // Match logs that have BOTH the exact service name AND device token
            andConditions.push({
              AND: [
                { serviceName: service.name },
                { deviceToken: service.deviceToken }
              ]
            });
          } else if (service.name) {
            // If only service name is available, use that
            andConditions.push({ serviceName: service.name });
          } else if (service.deviceToken) {
            // If only device token is available, use that
            andConditions.push({ deviceToken: service.deviceToken });
          } else {
            // Service has no identifiable fields, return empty result
            andConditions.push({
              id: { equals: 'no-match' }
            });
          }
        } else {
          // No service found with this ID, return empty result
          andConditions.push({
            id: { equals: 'no-match' }
          });
        }
      } catch (error) {
        // Invalid service ID format, return empty result
        andConditions.push({
          id: { equals: 'no-match' }
        });
      }
    }
    
    // For customer name, find matching customers first
    if (customerName) {
      // Use Turkish character support for customer search
      const customerSearchConditions = createTurkishSearchConditions(customerName, ['name', 'signBoard']);
      
      const matchingCustomers = await prisma.customer.findMany({
        where: {
          OR: customerSearchConditions
        },
        select: { id: true, name: true }
      });

      if (matchingCustomers.length > 0) {
        // Get all services for these customers
        const matchingServices = await prisma.service.findMany({
          where: {
            customerID: { in: matchingCustomers.map(c => c.id) }
          },
          select: { name: true, deviceToken: true }
        });

        // Create pairs of serviceName + deviceToken to ensure we only match logs from the specific customer's services
        const serviceMatches: any[] = [];
        
        matchingServices.forEach(service => {
          if (service.name && service.deviceToken) {
            // Match logs that have BOTH the exact service name AND device token
            serviceMatches.push({
              AND: [
                { serviceName: service.name },
                { deviceToken: service.deviceToken }
              ]
            });
          } else if (service.name) {
            // If only service name is available, use that
            serviceMatches.push({ serviceName: service.name });
          } else if (service.deviceToken) {
            // If only device token is available, use that
            serviceMatches.push({ deviceToken: service.deviceToken });
          }
        });
        
        if (serviceMatches.length > 0) {
          andConditions.push({
            OR: serviceMatches
          });
        } else {
          // No matching services, return empty result
          andConditions.push({
            id: { equals: 'no-match' } // This will match no records
          });
        }
      } else {
        // No matching customers, return empty result
        andConditions.push({
          id: { equals: 'no-match' } // This will match no records
        });
      }
    }
    
    // Combine all conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    
    if (validationType) {
      where.validationType = validationType;
    }
    
    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    // Get logs with pagination and include related service/customer data
    const [logs, total] = await Promise.all([
      prisma.apiLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.apiLog.count({ where })
    ]);

    // Enhance logs with customer information
    const enhancedLogs = await Promise.all(
      logs.map(async (log) => {
        let customerInfo = null;
        let serviceInfo = null;
        
        // If we have a serviceName, try to find the corresponding service and customer
        if (log.serviceName) {
          try {
            // Build a more specific query using available information
            const whereClause: any = {
              name: log.serviceName
            };

            // If we have deviceToken in the log, use it for precise matching
            if (log.deviceToken) {
              whereClause.deviceToken = log.deviceToken;
            } else {
              // Fallback: try to extract deviceToken from the request body
              try {
                const requestData = JSON.parse(log.requestBody || '{}');
                if (requestData.deviceToken) {
                  whereClause.deviceToken = requestData.deviceToken;
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
            }

            const service = await prisma.service.findFirst({
              where: whereClause,
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                    signBoard: true,
                    email: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc' // Get the most recent service with these criteria
              }
            });

            if (service) {
              serviceInfo = { id: service.id, name: service.name };
              if (service.customer) {
                customerInfo = service.customer;
              }
            }
          } catch (error) {
            console.error('Error fetching customer for log:', error);
          }
        }

        return {
          ...log,
          customer: customerInfo,
          serviceId: serviceInfo?.id || null
        };
      })
    );
    
    return NextResponse.json({
      logs: enhancedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Delete all logs from the database
    const deletedCount = await prisma.apiLog.deleteMany({});
    
    return NextResponse.json({
      message: 'All logs cleared successfully',
      deletedCount: deletedCount.count
    });
    
  } catch (error) {
    console.error('Error clearing logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
