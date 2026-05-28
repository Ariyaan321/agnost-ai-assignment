import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const detectConflictsTool = tool(
    async ({ managerEmail, employeeEmail, timeMin, timeMax }) => {
        try {
            const managerCal = await getClient(managerEmail);
            const empCal = await getClient(employeeEmail);

            const start = timeMin || new Date().toISOString();
            // Default to checking the next 24 hours if not specified
            const end = timeMax || new Date(Date.now() + 86400000).toISOString();

            // 1. Fetch Both Calendars in Parallel
            const [mRes, eRes] = await Promise.all([
                managerCal.events.list({
                    calendarId: 'primary',
                    timeMin: start,
                    timeMax: end,
                    singleEvents: true,
                    orderBy: 'startTime'
                }),
                empCal.events.list({
                    calendarId: 'primary',
                    timeMin: start,
                    timeMax: end,
                    singleEvents: true,
                    orderBy: 'startTime'
                })
            ]);

            const mEvents = mRes.data.items || [];
            const eEvents = eRes.data.items || [];

            // 2. Find Overlaps
            const conflicts = [];

            // We loop through Manager's events and check against Employee's
            for (const m of mEvents) {
                if (!m.start?.dateTime || !m.end?.dateTime) continue; // Skip all-day for now

                const mStart = new Date(m.start.dateTime).getTime();
                const mEnd = new Date(m.end.dateTime).getTime();

                for (const e of eEvents) {
                    if (!e.start?.dateTime || !e.end?.dateTime) continue;

                    const eStart = new Date(e.start.dateTime).getTime();
                    const eEnd = new Date(e.end.dateTime).getTime();

                    // Check for Overlap
                    // (StartA < EndB) and (EndA > StartB)
                    if (mStart < eEnd && mEnd > eStart) {
                        conflicts.push({
                            time: new Date(mStart).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                            managerTitle: m.summary,
                            employeeTitle: e.summary,
                            duration: Math.round((mEnd - mStart) / 60000) + " mins"
                        });
                    }
                }
            }

            if (conflicts.length === 0) {
                return "No conflicts found. Both calendars are clear relative to each other.";
            }

            // 3. Format Output
            const conflictText = conflicts.map(c =>
                `- ⚠️ ${c.time}: You have "${c.managerTitle}" vs Employee's "${c.employeeTitle}"`
            ).join('\n');

            return `Found ${conflicts.length} conflict(s):\n${conflictText}`;

        } catch (error: any) {
            return `Error detecting conflicts: ${error.message}`;
        }
    },
    {
        name: "detect_calendar_conflicts",
        description: "Checks for overlaps between the Manager's calendar and the Employee's calendar. Use this when the user asks 'Are there conflicts?' or 'Check employee calendar'.",
        schema: z.object({
            managerEmail: z.string(),
            employeeEmail: z.string(),
            timeMin: z.string().optional().nullable(),
            timeMax: z.string().optional().nullable(),
        }),
    }
);