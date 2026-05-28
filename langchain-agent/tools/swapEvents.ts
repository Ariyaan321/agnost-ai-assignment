import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const swapEventsTool = tool(
    async ({ email, query1, query2 }) => {
        try {
            const calendar = await getClient(email);

            // --- HELPER: Find Event by Text/Time ---
            const findEvent = async (q: string) => {
                // Search mostly today/tomorrow to catch the immediate context
                const startSearch = new Date();
                startSearch.setHours(startSearch.getHours() - 12);

                const listRes = await calendar.events.list({
                    calendarId: 'primary',
                    q: q, // Search by text
                    timeMin: startSearch.toISOString(),
                    singleEvents: true,
                    maxResults: 10
                });

                // Simple fuzzy match or take the first one
                // If q is a time (e.g. "5:05pm"), the list might be empty if we rely on 'q',
                // so real production apps parse date. For now, we assume title or robust search.
                // BETTER: We rely on the Agent to pass the TITLE or the exact time string if possible.
                return listRes.data.items?.[0];
            };

            const event1 = await findEvent(query1);
            const event2 = await findEvent(query2);

            // --- 1. VALIDATION CHECKS (Fixes TS Error) ---
            if (!event1 || !event1.id) return `Could not find event matching "${query1}".`;
            if (!event2 || !event2.id) return `Could not find event matching "${query2}".`;

            // Check if 'start' exists
            if (!event1.start || !event2.start) {
                return "One of the events is invalid (missing start time). Cannot swap.";
            }

            // --- CAPTURE DATA ---
            const start1 = event1.start.dateTime || event1.start.date;
            const start2 = event2.start.dateTime || event2.start.date;

            if (!start1 || !start2) return "Could not determine start times for one of the events.";

            // Calculate durations to preserve them
            const getDuration = (e: any) => {
                const s = new Date(e.start.dateTime).getTime();
                const end = new Date(e.end.dateTime).getTime();
                return end - s;
            };

            const dur1 = getDuration(event1);
            const dur2 = getDuration(event2);

            // --- EXECUTE SWAP (Sequential Patches) ---
            // We move Event 1 to Start 2
            const newStart1 = new Date(start2);
            const newEnd1 = new Date(newStart1.getTime() + dur1);

            // We move Event 2 to Start 1
            const newStart2 = new Date(start1);
            const newEnd2 = new Date(newStart2.getTime() + dur2);

            // Update 1
            await calendar.events.patch({
                calendarId: 'primary',
                eventId: event1.id,
                requestBody: {
                    start: { dateTime: newStart1.toISOString() },
                    end: { dateTime: newEnd1.toISOString() }
                }
            });

            // Update 2
            await calendar.events.patch({
                calendarId: 'primary',
                eventId: event2.id,
                requestBody: {
                    start: { dateTime: newStart2.toISOString() },
                    end: { dateTime: newEnd2.toISOString() }
                }
            });

            return `Success: Swapped "${event1.summary}" (now at ${newStart1.toLocaleTimeString()}) with "${event2.summary}" (now at ${newStart2.toLocaleTimeString()}).`;

        } catch (error: any) {
            return `Error swapping events: ${error.message}`;
        }
    },
    {
        name: "swap_calendar_events",
        description: "Swaps the start times of two events. Useful when two meetings conflict and the user wants to switch them. Resolves deadlocks.",
        schema: z.object({
            email: z.string(),
            query1: z.string().describe("Title or search query for the FIRST event."),
            query2: z.string().describe("Title or search query for the SECOND event."),
        }),
    }
);