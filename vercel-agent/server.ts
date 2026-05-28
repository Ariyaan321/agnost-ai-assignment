import { generateText, stepCountIs, tool } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log("🤖 Agent thinking...");

    // This makes a call to Groq's blazing fast Llama 3 model
    const { text, toolCalls } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        prompt: 'What is the weather in San Francisco?',
        stopWhen: stepCountIs(5),


        experimental_telemetry: {
            isEnabled: true,
            recordInputs: true,
            recordOutputs: true
        },

        tools: {
            getWeather: tool({
                description: 'Get the weather in a location',
                inputSchema: z.object({
                    location: z.string().describe('The location to get the weather for'),
                }),
                execute: async ({ location }) => {
                    console.log(`☁️  Fetching weather for ${location}...`);
                    return { location, temperature: 72 };
                },
            }),
        },
    });

    console.log(`\n✅ Agent Response: ${text}`);
}

main().catch(console.error);