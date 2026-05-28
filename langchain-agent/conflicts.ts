// --- HELPER: Conflict Detector ---
export async function hasConflict(calendar: any, start: Date, end: Date, excludeEventId?: string) {
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        maxResults: 10, // We only need to know if > 0 exists
    });

    const events = res.data.items || [];

    // Filter out the event we are currently moving (if any)
    // Also filter out 'transparent' events (availablity: 'free') if needed, 
    // but usually we want to block all conflicts.
    const conflictingEvents = events.filter((e: any) => {
        if (excludeEventId && e.id === excludeEventId) return false; // Don't conflict with self

        // Ignore all-day events if you want (optional)
        // if (e.start.date) return false; 

        return true;
    });

    return conflictingEvents;
}