import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { differenceInCalendarDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic'; // Ensure this route is not cached

export async function GET(req) {
    try {
        // The scheduler must send "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET the
        // endpoint stays open so existing schedulers keep working; set it to close the endpoint.
        if (process.env.CRON_SECRET) {
            if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } else {
            console.warn('CRON_SECRET is not set: /api/cron/check-services is callable by anyone');
        }

        const TIMEZONE = 'Europe/Istanbul';

        // 1. Get Current Time in Istanbul
        const now = new Date();
        const todayInIstanbul = toZonedTime(now, TIMEZONE);
        
        // Normalize today to start of day (00:00:00) in Istanbul time
        // We create a new date using the year, month, day from the zoned time
        const today = new Date(todayInIstanbul.getFullYear(), todayInIstanbul.getMonth(), todayInIstanbul.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const services = await prisma.service.findMany({
            where: {
                active: true,
                paymentType: {
                    not: 'unlimited' // Skip unlimited services
                },
                // Trial Customer services are included so we can notify when they expire TODAY
            },
            include: {
                customer: {
                    select: {
                        name: true
                    }
                }
            }
        });

        let newNotifications = 0;
        const results = [];

        for (const service of services) {
            // 2. Convert Service End Date to Istanbul Time
            const serviceEndDate = new Date(service.endingDate);
            
            // Dates stored as T21:00:00.000Z represent midnight Istanbul time (UTC+3) for the NEXT day.
            // e.g., "2026-02-26T21:00:00.000Z" = "2026-02-27 00:00:00" Istanbul = user intended Feb 27.
            // We use the Istanbul date directly without shifting back.
            const endDateInIstanbul = toZonedTime(serviceEndDate, TIMEZONE);
            
            // Use the Istanbul date directly without any midnight adjustment.
            // When a user sets "Feb 27" as end date, it's stored as "2026-02-26T21:00:00.000Z" (midnight Istanbul = 21:00 UTC prev day).
            // We should treat this as Feb 27, not shift it back to Feb 26.
            const effectiveEndDate = new Date(endDateInIstanbul.getFullYear(), endDateInIstanbul.getMonth(), endDateInIstanbul.getDate());

            // 3. Calculate Days Remaining using Calendar Days
            const daysRemaining = differenceInCalendarDays(effectiveEndDate, today);

            const isTrialService = service.customer.name === 'Trial Customer' ||
                (service.description && service.description.startsWith('Trial service'));

            // Trial services only get notified if they end exactly TODAY
            if (isTrialService && daysRemaining !== 0) continue;

            let status = 'active';
            let action = 'none';

            // 1. Check for Services Ending TODAY
            if (daysRemaining === 0) {
                status = 'expires_today';
                
                // Check if we already notified TODAY about this
                // We must look for ANY notification for this service created today
                const existingNotification = await prisma.notifications.findFirst({
                    where: {
                        OR: [
                            { title: { contains: `Bugün Sona Eriyor` } },
                            { title: { contains: `Hizmet Süresi Doldu` } }
                        ],
                        message: {
                            contains: service.name
                        },
                        createdAt: {
                            gte: today // Created today (in local time logic)
                        }
                    }
                });

                if (!existingNotification) {
                    await prisma.notifications.create({
                        data: {
                            title: `Bugün Sona Eriyor: ${service.name}`,
                            message: `${service.customer.name} müşterisine ait ${service.name} hizmetinin süresi BUGÜN doluyor.`,
                            type: 'error', // High priority (Red)
                            serviceId: service.id,
                            customerId: service.customerID,
                        }
                    });
                    newNotifications++;
                    action = 'created_today_notification';
                } else {
                    action = 'skipped_already_notified_today';
                }
            }
            // 2. Check for Services Ending TOMORROW (1 Day Left)
            else if (daysRemaining === 1) {
                status = 'expires_tomorrow';
                
                const existingNotification = await prisma.notifications.findFirst({
                    where: {
                        title: {
                            contains: `Yarın Sona Eriyor`
                        },
                        message: {
                            contains: service.name
                        },
                        createdAt: {
                            gte: today // Created today
                        }
                    }
                });

                if (!existingNotification) {
                    await prisma.notifications.create({
                        data: {
                            title: `Yarın Sona Eriyor: ${service.name}`,
                            message: `${service.customer.name} müşterisine ait ${service.name} hizmetinin süresi YARIN doluyor.`,
                            type: 'warning', // High priority warning
                            serviceId: service.id,
                            customerId: service.customerID,
                        }
                    });
                    newNotifications++;
                    action = 'created_tomorrow_notification';
                } else {
                    action = 'skipped_already_notified_today';
                }
            }
            // 3. Check for Services Ending in 2 DAYS
            else if (daysRemaining === 2) {
                status = 'expires_in_2_days';
                
                const existingNotification = await prisma.notifications.findFirst({
                    where: {
                        title: {
                            contains: `2 Gün Kaldı`
                        },
                        message: {
                            contains: service.name
                        },
                        createdAt: {
                            gte: today
                        }
                    }
                });

                if (!existingNotification) {
                    await prisma.notifications.create({
                        data: {
                            title: `2 Gün Kaldı: ${service.name}`,
                            message: `${service.customer.name} müşterisine ait ${service.name} hizmetinin süresinin dolmasına 2 gün kaldı.`,
                            type: 'warning',
                        }
                    });
                    newNotifications++;
                    action = 'created_2days_notification';
                } else {
                    action = 'skipped_already_notified_today';
                }
            }
            // 4. Check for Upcoming Services (Exactly 16 days left)
            else if (daysRemaining === 16) {
                status = 'upcoming_16_days';
                
                const existingNotification = await prisma.notifications.findFirst({
                    where: {
                        title: {
                            contains: `Yaklaşan Hizmet`
                        },
                        message: {
                            contains: service.name
                        },
                        createdAt: {
                            gte: today // Created today
                        }
                    }
                });

                if (!existingNotification) {
                    await prisma.notifications.create({
                        data: {
                            title: `Yaklaşan Hizmet: ${service.name}`,
                            message: `${service.customer.name} müşterisine ait ${service.name} hizmetinin süresi 16 gün içinde dolacaktır.`,
                            type: 'upcoming',
                            serviceId: service.id,
                            customerId: service.customerID,
                        }
                    });
                    newNotifications++;
                    action = 'created_upcoming_notification';
                } else {
                    action = 'skipped_already_notified_today';
                }
            }

            // Log details for debugging/verification if something happened or it matched our criteria
            if (status !== 'active' || daysRemaining <= 16) {
                results.push({
                    service: service.name,
                    customer: service.customer.name,
                    endDateRaw: service.endingDate,
                    endDateIstanbul: effectiveEndDate.toLocaleDateString('tr-TR'),
                    todayIstanbul: today.toLocaleDateString('tr-TR'),
                    daysRemaining,
                    status,
                    action
                });
            }
        }

        // DEBUG: Find services ending within 3 days that may have been excluded by filters
        // This helps identify services that are filtered out (inactive, unlimited, trial, etc.)
        const allServicesEndingSoon = await prisma.service.findMany({
            where: {
                endingDate: {
                    gte: new Date(today.getTime() - 24 * 60 * 60 * 1000), // from yesterday
                    lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // to 3 days from now
                }
            },
            include: {
                customer: {
                    select: { name: true }
                }
            }
        });

        const excludedServices = allServicesEndingSoon
            .filter(s => {
                // Check if this service was NOT in our processed list
                return !services.some(ps => ps.id === s.id);
            })
            .map(s => {
                const reasons = [];
                if (!s.active) reasons.push('inactive');
                if (s.paymentType === 'unlimited') reasons.push('unlimited');
                if (s.customer.name === 'Trial Customer') reasons.push('trial_customer');
                if (s.description?.startsWith('Trial service')) reasons.push('trial_description');
                
                const sEndDate = toZonedTime(new Date(s.endingDate), TIMEZONE);
                const sEffective = new Date(sEndDate.getFullYear(), sEndDate.getMonth(), sEndDate.getDate());
                
                return {
                    service: s.name,
                    customer: s.customer.name,
                    endDateRaw: s.endingDate,
                    endDateIstanbul: sEffective.toLocaleDateString('tr-TR'),
                    active: s.active,
                    paymentType: s.paymentType,
                    description: s.description?.substring(0, 50) || null,
                    excludedReasons: reasons,
                    daysRemaining: differenceInCalendarDays(sEffective, today),
                };
            });

        return NextResponse.json({
            success: true,
            timezone: TIMEZONE,
            serverTimeUTC: now.toISOString(),
            todayIstanbul: today.toLocaleDateString('tr-TR'),
            processed: services.length,
            newNotifications,
            note: 'endDateRaw shows UTC time. Dates ending in T21:00:00Z = midnight Istanbul (next day). Check endDateIstanbul for the actual Turkey date.',
            details: results,
            ...(excludedServices.length > 0 && { 
                excludedServicesEndingSoon: excludedServices,
                excludedNote: 'These services end within 3 days but were excluded from notification processing by filters.'
            })
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
