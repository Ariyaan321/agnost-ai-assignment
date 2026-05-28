import { getClient } from "./calendarClient";

// --- HELPER: Your Original Scheduling Algorithm ---
interface SchedulingConfig {
    startRange: Date;
    endRange: Date;
    durationMins: number;
    workStartHour: number;
    workStartMinute?: number;
    workEndHour: number;
    workEndMinute?: number;
}

export async function runSlidingWindow(managerEmail: string, empEmail: string, config: SchedulingConfig) {
    const managerCal = await getClient(managerEmail);
    const empCal = await getClient(empEmail);

    // 1. Fetch Busy Times (Exact Logic from your snippet)
    const [managerBusyRes, empBusyRes] = await Promise.all([
        managerCal.freebusy.query({
            requestBody: { timeMin: config.startRange.toISOString(), timeMax: config.endRange.toISOString(), items: [{ id: 'primary' }] }
        }),
        empCal.freebusy.query({
            requestBody: { timeMin: config.startRange.toISOString(), timeMax: config.endRange.toISOString(), items: [{ id: 'primary' }] }
        })
    ]);

    const mBusy = managerBusyRes.data.calendars?.['primary'].busy || [];
    const eBusy = empBusyRes.data.calendars?.['primary'].busy || [];

    // 2. Find slots (Exact Logic)
    const slots: { start: Date; end: Date }[] = [];
    let currentDay = new Date(config.startRange);
    const now = new Date();

    while (currentDay <= config.endRange && slots.length < 5) { // Increased limit to 5 for better options
        const dayStart = new Date(currentDay);
        dayStart.setHours(config.workStartHour, config.workStartMinute || 0, 0, 0);

        const dayEnd = new Date(currentDay);
        dayEnd.setHours(config.workEndHour, config.workEndMinute || 0, 0, 0);

        let currentSlot = new Date(dayStart);

        // Time travel check
        if (currentSlot < now) {
            currentSlot = new Date(now);
            const remainder = 30 - (currentSlot.getMinutes() % 30);
            currentSlot.setMinutes(currentSlot.getMinutes() + remainder, 0, 0);
        }

        while (currentSlot < dayEnd && slots.length < 5) {
            const slotEnd = new Date(currentSlot.getTime() + config.durationMins * 60000);

            if (slotEnd > dayEnd) break;

            const isBusy = (busyList: any[]) => busyList.some(busy => {
                const bStart = new Date(busy.start);
                const bEnd = new Date(busy.end);
                return (currentSlot < bEnd && slotEnd > bStart);
            });

            if (!isBusy(mBusy) && !isBusy(eBusy)) {
                slots.push({ start: new Date(currentSlot), end: new Date(slotEnd) });
                // Jump 60 mins to give variety
                currentSlot.setMinutes(currentSlot.getMinutes() + 60);
            } else {
                // If busy, check next 15 min block
                currentSlot.setMinutes(currentSlot.getMinutes() + 15);
            }
        }

        currentDay.setDate(currentDay.getDate() + 1);
        currentDay.setHours(0, 0, 0, 0);
    }

    return slots;
}