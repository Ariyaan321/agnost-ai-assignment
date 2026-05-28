import { getClient } from "../calendarClient";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { hasConflict } from "../conflicts";

// Helper for the pause
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createEventTool = tool(
    async ({ ownerEmail, attendeeEmails, startTime, durationMinutes, title, description, force }) => {
        try {
            // Standardize inputs
            const start = new Date(startTime);
            const end = new Date(start.getTime() + (durationMinutes || 30) * 60000);
            let participantEmails = [...(attendeeEmails || [])];

            // WE FORCE THE OWNER IN. (Code is Law).
            if (!participantEmails.includes(ownerEmail)) {
                participantEmails.push(ownerEmail);
            }

            // Remove duplicates
            participantEmails = Array.from(new Set(participantEmails));

            // --- 1. MULTI-USER CONFLICT CHECK & RETRY'S---
            if (!force) {
                const MAX_RETRIES = 3;
                const DELAY_MS = 2000; // Wait 2 seconds between checks
                let conflictReports: string[] = [];

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    conflictReports = []; // Reset reports for this attempt

                    // Loop through EVERY participant (Manager + Employee)
                    for (const email of participantEmails) {
                        try {
                            // Try to get their calendar client (checks if they are in your DB)
                            const client = await getClient(email);

                            // Re-use your existing 'hasConflict' helper
                            const conflicts = await hasConflict(client, start, end);

                            if (conflicts.length > 0) {
                                const conflictNames = conflicts.map((c: any) => `"${c.summary}"`).join(', ');
                                conflictReports.push(`${email} has: ${conflictNames}`);
                            }
                        } catch (e) {
                            // Ignore external users (e.g., clients@gmail.com) who aren't in your DB
                            // We can't check their calendar anyway.
                        }
                    }

                    // If ANY conflicts were found across ANY user
                    // if (conflictReports.length > 0) {
                    //     return `❌ STOP: Cannot create meeting. Conflicts found:\n- ${conflictReports.join('\n- ')}\n\nAsk the user: "I found conflicts for [Names]. Should I overlap them (force) or find a new time?"`;
                    // }
                    // DECISION TIME:
                    if (conflictReports.length === 0) {
                        // Success! No conflicts found. Break the loop and book it.
                        break;
                    } else {
                        // Conflicts found.
                        if (attempt < MAX_RETRIES) {
                            // If we have retries left, wait and try again.
                            // console.log(`Conflict detected (Attempt ${attempt}). Waiting for Google propagation...`);
                            await sleep(DELAY_MS);
                        }
                        // If it's the last attempt, we let the loop finish and will return the error below.
                    }
                }
                if (conflictReports.length > 0) {
                    return `❌ STOP: Cannot create meeting. Conflicts found (after verifying 3 times):\n- ${conflictReports.join('\n- ')}\n\nAsk user to force or reschedule.`;
                }
            }

            // --- 2. EXECUTE BOOKING (If no conflicts) ---
            // We use the Owner's client to actually create the event
            const ownerCalendar = await getClient(ownerEmail);

            const event = {
                summary: title,
                description: description || 'Scheduled by Voiceboard AI',
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
                attendees: participantEmails.map((email: string) => ({
                    email,
                    // Optional: Mark the owner as 'accepted' immediately
                    responseStatus: email === ownerEmail ? 'accepted' : 'needsAction'
                })),
                conferenceData: {
                    createRequest: {
                        requestId: Math.random().toString(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            };

            const result = await ownerCalendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: event,
            });

            return `Event '${title}' created. Link: ${result.data.htmlLink} | Meet: ${result.data.hangoutLink}`;

        } catch (error: any) {
            return `Error creating event: ${error.message}`;
        }
    },
    {
        name: "create_calendar_event",
        description: "Books a meeting. AUTOMATICALLY CHECKS CONFLICTS FOR ALL PARTICIPANTS (Manager & Employee).",
        schema: z.object({
            ownerEmail: z.string().describe("User's email address."),
            attendeeEmails: z.array(z.string()).optional(),
            startTime: z.string().describe("ISO string for start time."),
            durationMinutes: z.number().optional().describe("Duration in minutes."),
            title: z.string().describe("Meeting title."),
            description: z.string().nullable().optional().describe("Description of the meeting. If none provided, send null."),
            force: z.boolean().optional().describe("Set to true ONLY if the user explicitly says to 'double book' or 'overlap'."),
        }),
    }
);