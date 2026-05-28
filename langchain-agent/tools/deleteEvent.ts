import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const deleteEventTool = tool(
  async ({ email, title, time }) => {
    try {
      const calendar = await getClient(email);

      // 1. Setup Search Parameters
      // We search a narrow window if time is provided, otherwise we search from Now.
      let timeMin = new Date().toISOString();
      let timeMax = undefined;

      if (time) {
        const targetDate = new Date(time);
        // Look 1 hour before and 24 hours after to ensure we catch it (timezone safety)
        // We will filter strictly in JS later.
        const startWindow = new Date(targetDate);
        startWindow.setHours(startWindow.getHours() - 1);
        timeMin = startWindow.toISOString();

        const endWindow = new Date(targetDate);
        endWindow.setHours(endWindow.getHours() + 24);
        timeMax = endWindow.toISOString();
      }

      // 2. Fetch Candidates
      const listRes = await calendar.events.list({
        calendarId: 'primary',
        q: title || undefined, // Filter by text if provided
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        maxResults: 20 // Fetch enough to filter locally
      });

      const events = listRes.data.items || [];

      // 3. Find Exact Match (In Memory)
      const targetEvent = events.find(e => {
        // A. Title Match (Fuzzy)
        const summaryMatch = title
          ? e.summary?.toLowerCase().includes(title.toLowerCase())
          : true;

        // B. Time Match (Strict)
        let timeMatch = true;
        if (time) {
          const eventStart = new Date(e.start?.dateTime || e.start?.date || '');
          const targetStart = new Date(time);

          // Check if start times are within 1 minute of each other
          const diff = Math.abs(eventStart.getTime() - targetStart.getTime());
          timeMatch = diff < 60000;
        }

        return summaryMatch && timeMatch;
      });

      // 4. Handle Results
      if (!targetEvent || !targetEvent.id) {
        return `Could not find an event ${title ? `called '${title}'` : ''} ${time ? `at ${time}` : ''}. Found ${events.length} other events in that range.`;
      }

      // 5. Delete
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: targetEvent.id
      });

      return `Successfully deleted event: "${targetEvent.summary}" scheduled for ${targetEvent.start?.dateTime}`;

    } catch (error: any) {
      return `Error deleting event: ${error.message}`;
    }
  },
  {
    name: "delete_calendar_event",
    description: "Deletes a specific calendar event. You can identify it by Title, Time, or both. PREFER using 'time' for accuracy.",
    schema: z.object({
      email: z.string(),
      title: z.string().optional().describe("The title/summary of the event."),
      time: z.string().optional().describe("The ISO start time of the event. e.g. '2025-12-22T20:10:00+05:30'"),
    }),
  }
);