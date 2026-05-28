import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { countTokensApproximately, createAgent, createMiddleware, summarizationMiddleware } from "langchain"; // This matches your 'createAgent' snippet
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { listEventsTool } from './tools/listEvents';
import { createEventTool } from './tools/createEvents';
import { deleteEventTool } from './tools/deleteEvent';
import { rescheduleEventTool } from './tools/rescheduleEvents';
import { findFreeSlotsTool } from './tools/findFreeSlots';
import { swapEventsTool } from './tools/swapEvents';
import { detectConflictsTool } from './tools/detectConflicts';
import { trimMessages, RemoveMessage } from "@langchain/core/messages";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

// 1. Setup MongoDB Client for Checkpoints
const client = new MongoClient(process.env.MONGO_URI as string);
// Ideally, ensure this client is connected in your server startup.

// 2. Create the Checkpointer
const checkpointer = new MongoDBSaver({ client: client as any });

// --- 3. INITIALIZE MODEL (GROQ) ---

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b", // Or "mixtral-8x7b-32768"
  temperature: 0,
  maxTokens: 500,
});

const modelSummarizer = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant", // Or "mixtral-8x7b-32768"
  temperature: 0,
  maxTokens: 500,

})

const SYSTEM_PROMPT = `
    You are Voiceboard, an expert scheduling assistant for India Standard Time (IST).

    CRITICAL RULES:
    1. TIMEZONE: All times are IST (GMT+5:30). When the user says "7 PM", they mean 19:00 IST. Do NOT convert to UTC. Also give them responses of time in terms of "PM" and "AM"
    2. ATTENDEES: If the context mentions an "Employee" email, YOU MUST include them both in the 'attendeeEmails' list for every meeting you book, unless the user specifically says "just me".
    3. YEAR: Always check the "Current Date" provided in the prompt. Do not assume 2024.    
    4. FINDING SLOTS: If the user asks for availability, ALWAYS use the 'find_free_slots' tool. Do not guess.
    5. BOOKING: When the user picks a slot from the list, use 'create_calendar_event'.
    6. CONFLICT CHECKS: 
       - If the user asks "Check for conflicts" or "Look at employee calendar", use 'detect_calendar_conflicts'.
       - DO NOT try to fetch two lists and compare them yourself. Use the tool.
    7. NO DUPLICATES (Rule of Identity): 
       - If you use 'reschedule_calendar_event' for "Meeting A", DO NOT use 'create_calendar_event' for "Meeting A".
       - HOWEVER, if the user wants to "Move Meeting A to make room for Meeting B", you MUST perform both actions: Reschedule A, then Create B.
    8. ACCURACY: Trust the tools.
    9. VERIFY REALITY (MOST IMPORTANT): 
       - The Chat History shows what we *discussed*, NOT what currently *exists*.
       - The user might have deleted the meeting manually 1 second ago.
       - IF the user asks "Do I have a meeting?", "Is it still there?", or "Check my schedule":
       - **YOU MUST CALL 'list_calendar_events' AGAIN.**
       - Do NOT answer based on previous messages. Verify with the tool every single time.
    10. HANDLING "NOT FOUND": 
      - If you try to reschedule/delete an event and the tool says "Not Found":
      - **DO NOT** retry the same email.
      - IMMEDIATELY try the *other* person's email (e.g., if Manager didn't have it, try Employee).
      - Meetings often live on the Employee's calendar.
    11. DEFINITION OF DONE (Standard Mode):
      - Generally, when a tool returns "Success":
      - **YOU ARE DONE.** Do not verify. Output text confirmation.
      - **EXCEPTION:** If you are performing a "Compound Move" (Rule 12) and have only finished Step 1, **IGNORE THIS RULE** and proceed to Step 2.

    12. COMPOUND MOVES ("Shift & Insert" Mode or "Shift & Shift" Mode):
      - Trigger: User says "Reschedule X... AND then Create Y..." or "Reschedule X... And then Reschedule Y..."
      - **STATUS:** This is a Multi-Step Task. It is NOT done until BOTH tools have run.
      - **Step 1:** Call 'reschedule_calendar_event'.
      - **Step 2:** READ the tool output.
        - If "Success": **DO NOT STOP.** Immediately call 'create_calendar_event' for the new meeting.
        - If "Fail": Stop and report error.
      - **FINAL CHECK:** Before responding to the user, ask yourself: "Did I do BOTH things asked?" If not, call the second tool now.
    
    If the user asks to book a meeting, confirm the Date, Time, and Attendees in your tool call.
  `

// --- BUILT-IN SUMMARIZATION (Persistent - saves summaries to checkpoint) ---
const summaryMiddleware = summarizationMiddleware({
  model: modelSummarizer, // Cheaper model for summaries
  trigger: { tokens: 6000 },   // Summarize when >6000 tokens
  keep: { tokens: 4000 },      // Keep 4000 tokens after summary
});

// --- CUSTOM TRIMMER (Transient - only for current model call) ---
const trimmerMiddleware = createMiddleware({
  name: "TokenTrimmer",
  beforeModel: async (state) => {
    const messages = state.messages;

    if (messages.length <= 5) {
      return; // No changes needed
    }

    // Trim to 5000 tokens using official trimMessages
    const trimmedMessages = await trimMessages(messages, {
      strategy: "last",
      maxTokens: 5000,
      tokenCounter: (msgs) => msgs.reduce((acc, msg) => acc + msg.content.length / 4, 0), // Simple char/4 heuristic
      includeSystem: true,
      allowPartial: false,
      startOn: "human",
      endOn: ["human", "tool"],
    });

    console.log(`📏 Trimmed ${messages.length} → ${trimmedMessages.length} messages`);

    return {
      messages: [
        new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
        ...trimmedMessages,
      ],
    };
  },
});

// --- 4. CREATE AGENT ---
// We use createAgent (the modern equivalent of your snippet's createAgent)

export const agent = createAgent({
  model: model,
  tools: [listEventsTool, createEventTool, deleteEventTool, rescheduleEventTool, findFreeSlotsTool, swapEventsTool, detectConflictsTool],
  checkpointer: checkpointer,
  middleware: [
    summaryMiddleware,
    trimmerMiddleware,
  ],
  systemPrompt: SYSTEM_PROMPT,

});