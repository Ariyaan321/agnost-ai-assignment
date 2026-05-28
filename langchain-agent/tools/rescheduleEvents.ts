import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { hasConflict } from "../conflicts";

// Helper for the pause
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const rescheduleEventTool = tool(
    async ({ email, currentTitle, currentTime, newStartTime, newDurationMinutes, force }) => {
        try {
            const calendar = await getClient(email);

            // --- 1. FIND THE EVENT TO MOVE ---
            // We search broadly today to find the event
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const listRes = await calendar.events.list({
                calendarId: 'primary',
                q: currentTitle || undefined,
                timeMin: currentTime ? new Date(new Date(currentTime).getTime() - 3600000).toISOString() : startOfDay.toISOString(),
                singleEvents: true,
                maxResults: 10,
            });

            const events = listRes.data.items || [];

            // Match logic (same as before)
            const targetEvent = events.find(e => {
                const titleMatch = currentTitle ? e.summary?.toLowerCase().includes(currentTitle.toLowerCase()) : true;
                let timeMatch = true;
                if (currentTime) {
                    const eStart = new Date(e.start?.dateTime || '').getTime();
                    const cStart = new Date(currentTime).getTime();
                    timeMatch = Math.abs(eStart - cStart) < 60000; // 1 min buffer
                }
                return titleMatch && timeMatch;
            });

            if (!targetEvent || !targetEvent.id) {
                return `Event matching "${currentTitle || currentTime}" not found. HINT: Check if it's on the Employee's calendar instead.`;
            }

            // --- 2. PREPARE FOR CONFLICT CHECK ---
            // Get the New Start and End times
            const newStart = new Date(newStartTime);
            // Use provided duration OR keep existing duration
            let duration = 30; // Default
            if (newDurationMinutes) {
                duration = newDurationMinutes;
            } else if (targetEvent.start?.dateTime && targetEvent.end?.dateTime) {
                const oldS = new Date(targetEvent.start.dateTime).getTime();
                const oldE = new Date(targetEvent.end.dateTime).getTime();
                duration = (oldE - oldS) / 60000;
            }
            const newEnd = new Date(newStart.getTime() + duration * 60000);

            // Get All Participants from the EXISTING event
            const attendees = targetEvent.attendees || [];
            const participantEmails = attendees.map(a => a.email).filter(e => e) as string[];

            // Ensure Owner is checked too
            if (!participantEmails.includes(email)) participantEmails.push(email);

            // --- 3. MULTI-USER CONFLICT CHECK (The New Logic) ---
            if (!force) {
                const MAX_RETRIES = 3;
                const DELAY_MS = 2000;
                let conflictReports: string[] = [];

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    conflictReports = [];

                    for (const pEmail of participantEmails) {
                        try {
                            const client = await getClient(pEmail);
                            const conflicts = await hasConflict(client, newStart, newEnd);

                            // We must ignore the event we are CURRENTLY moving (targetEvent.id)
                            // otherwise it will flag as a self-conflict if we move it slightly
                            const realConflicts = conflicts.filter((c: any) => c.id !== targetEvent.id);

                            if (realConflicts.length > 0) {
                                const cNames = realConflicts.map((c: any) => `"${c.summary}"`).join(', ');
                                conflictReports.push(`${pEmail} has: ${cNames}`);
                            }
                        } catch (e) { /* Ignore external */ }
                    }

                    if (conflictReports.length === 0) break;
                    if (attempt < MAX_RETRIES) await sleep(DELAY_MS);
                }

                if (conflictReports.length > 0) {
                    return `❌ STOP: Cannot reschedule. The NEW time (${newStart.toLocaleTimeString()}) has conflicts:\n- ${conflictReports.join('\n- ')}\n\nAsk user to force or choose a different time.`;
                }
            }

            // --- 4. EXECUTE MOVE ---
            await calendar.events.patch({
                calendarId: 'primary',
                eventId: targetEvent.id,
                requestBody: {
                    start: { dateTime: newStart.toISOString() },
                    end: { dateTime: newEnd.toISOString() },
                },
            });

            return `Successfully rescheduled "${targetEvent.summary}" to ${newStart.toLocaleString()}.`;

        } catch (error: any) {
            return `Error rescheduling event: ${error.message}`;
        }
    },
    {
        name: "reschedule_calendar_event",
        description: "Reschedules an event. AUTOMATICALLY CHECKS CONFLICTS for all attendees at the new time.",
        schema: z.object({
            email: z.string(),
            currentTitle: z.string().nullable().optional(),
            currentTime: z.string().nullable().optional(),
            newStartTime: z.string().describe("The NEW start time."),
            newDurationMinutes: z.number().nullable().optional(),
            force: z.boolean().nullable().optional(),
        }),
    }
);