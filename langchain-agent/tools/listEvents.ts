import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";


export const listEventsTool = tool(
    async ({ email, timeMin, maxResults }) => {
        try {
            const calendar = await getClient(email);
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin || new Date().toISOString(),
                maxResults: maxResults || 5,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items || [];
            if (events.length === 0) return "No upcoming events found.";

            // --- ADD THIS FILTER ---
            const relevantEvents = events.filter((e: any) => {
                const title = (e.summary || '').toLowerCase();

                // 1. Filter by Keyword
                if (title.includes('birthday')) return false;
                if (title.includes('holiday')) return false;

                // 2. Optional: Filter by 'eventType' if Google marks it explicitly
                if (e.eventType === 'birthday') return false;

                return true;
            });

            // FIX: Calculate duration and include it in the summary string
            return relevantEvents.map((e: any) => {
                const start = e.start.dateTime || e.start.date;
                const end = e.end.dateTime || e.end.date;

                // Calculate duration in minutes if datetime is present
                let durationStr = "";
                if (e.start.dateTime && e.end.dateTime) {
                    const startTime = new Date(e.start.dateTime).getTime();
                    const endTime = new Date(e.end.dateTime).getTime();
                    const diffMins = Math.round((endTime - startTime) / 60000);
                    durationStr = ` | Duration: ${diffMins} mins`;
                } else {
                    durationStr = " | All Day Event";
                }

                return `- ${e.summary} (Start: ${start}${durationStr})`;
            }).join('\n');

        } catch (error: any) {
            return `Error fetching events: ${error.message}`;
        }
    },
    {
        name: "list_calendar_events",
        description: "List upcoming calendar events.",
        schema: z.object({
            email: z.string(),
            timeMin: z.string().optional(),
            maxResults: z.number().optional(),
        }),
    }
);