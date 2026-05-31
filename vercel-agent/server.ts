import { generateText, stepCountIs, tool } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import dotenv from 'dotenv';
import * as readline from 'node:readline/promises';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log("🤖 Chat session started. Type 'exit' to quit.\n");

    // This array acts as the memory for the conversation
    let messages: any[] = [];

    while (true) {
        // Wait for you to type something
        const userInput = await rl.question("You: ");
        if (userInput.toLowerCase() === 'exit') break;

        // 1. Add your new message to the memory
        messages.push({ role: 'user', content: userInput });

        // 2. Call the agent with the entire memory array
        const result = await generateText({
            // model: groq('llama-3.3-70b-versatile'),
            model: groq('openai/gpt-oss-120b'),
            system: "You are a helpful assistant. The user is currently located in San Francisco, CA, USA. If a tool requires a location and the user does not specify one, default to this location.",
            messages: messages,
            stopWhen: stepCountIs(5),

            experimental_telemetry: {
                isEnabled: true,
                recordInputs: true,
                recordOutputs: true
            },

            tools: {
                // Tool 1: The original weather tool
                getWeather: tool({
                    description: 'Get the weather in a location',
                    inputSchema: z.object({
                        location: z.string().describe('The location to get the weather for'),
                    }),
                    execute: async ({ location }) => {
                        console.log(`   [Tool] ☁️ Fetching weather for ${location}...`);
                        return { location, temperature: 72 };
                    },
                }),

                // Tool 2: A dead-simple time checking tool
                getTime: tool({
                    description: 'Get the current local time',
                    inputSchema: z.object({}), // No inputs needed!
                    execute: async () => {
                        console.log(`   [Tool] 🕒 Checking the clock...`);
                        return { time: new Date().toLocaleTimeString() };
                    }
                })
            },
        });

        console.log(`Agent: ${result.text}\n`);

        // 3. Add the agent's final text and the background tool calls back to memory
        messages.push(...result.response.messages);
    }

    rl.close();
}

main().catch(console.error);