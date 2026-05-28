import { getClient } from "../calendarClient";
import { runSlidingWindow } from "../scheduler";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const findFreeSlotsTool = tool(
    async ({ managerEmail, employeeEmail, durationMins, startDayOffset, endDayOffset }) => {
        try {
            // 1. Prepare Dates based on AI's numeric input
            const now = new Date();

            const startRange = new Date(now);
            startRange.setDate(now.getDate() + (startDayOffset || 0));
            startRange.setHours(0, 0, 0, 0);

            const endRange = new Date(now);
            endRange.setDate(now.getDate() + (endDayOffset || 3)); // Default search next 3 days
            endRange.setHours(23, 59, 59, 999);

            // 2. Run your Algorithm
            const slots = await runSlidingWindow(managerEmail, employeeEmail, {
                startRange,
                endRange,
                durationMins: durationMins || 30,
                workStartHour: 9, // Default Work Start (could be parameterized)
                workEndHour: 17,  // Default Work End
            });

            if (slots.length === 0) return "No free slots found in the given range.";

            // 3. Return Clean List for the Agent
            const slotText = slots.map(s => {
                // Format: "Monday, Dec 22 at 10:00 AM"
                const dateStr = s.start.toLocaleString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                });
                return `- ${dateStr}`;
            }).join('\n');

            return `Found ${slots.length} available slots:\n${slotText}\nAsk the user which one they prefer.`;

        } catch (error: any) {
            return `Error calculating slots: ${error.message}`;
        }
    },
    {
        name: "find_free_slots",
        description: "Calculates available meeting times where BOTH the manager and employee are free. Use this when the user asks 'When are we free?' or 'Find a time'.",
        schema: z.object({
            managerEmail: z.string(),
            employeeEmail: z.string(),
            durationMins: z.number().nullable().optional().describe("Meeting duration in minutes (default 30)."),
            startDayOffset: z.number().nullable().optional().describe("Start searching from how many days from now? (0 = today, 1 = tomorrow)."),
            endDayOffset: z.number().nullable().optional().describe("Stop searching after how many days? (default 3)."),
        }),
    }
);