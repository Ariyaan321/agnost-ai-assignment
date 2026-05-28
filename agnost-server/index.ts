// agnost-server/index.ts
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Trace } from './models/Trace';

dotenv.config();
const PORT = 8080;
const app = express();
app.use(express.json());

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI as string)
    .then(() => console.log('✅ Agnost Server connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- HELPER TO EXTRACT OTel ATTRIBUTES ---
// OTel sends attributes as an array of {key, value: {stringValue/intValue}}. 
// This helper flattens it into a normal JS object.
function extractAttributes(attributesArray: any[]) {
    const attrs: Record<string, any> = {};
    if (!attributesArray) return attrs;

    for (const attr of attributesArray) {
        if (attr.value.stringValue !== undefined) attrs[attr.key] = attr.value.stringValue;
        else if (attr.value.intValue !== undefined) attrs[attr.key] = attr.value.intValue;
        else if (attr.value.boolValue !== undefined) attrs[attr.key] = attr.value.boolValue;
    }
    return attrs;
}


// --- THE RECEIVER ROUTE ---
app.post('/v1/traces', async (req, res) => {
    try {
        const resourceSpans = req.body.resourceSpans || [];

        for (const rs of resourceSpans) {
            for (const ss of rs.scopeSpans || []) {
                for (const span of ss.spans || []) {

                    const traceId = span.traceId;
                    const attrs = extractAttributes(span.attributes);

                    // 1. Handle the main LLM span
                    if (span.name === 'ai.generateText' || span.name.includes('doGenerate')) {
                        let parsedPrompt = attrs['ai.prompt.messages'];
                        try { parsedPrompt = JSON.parse(parsedPrompt); } catch (e) { }

                        const start = parseInt(span.startTimeUnixNano);
                        const end = parseInt(span.endTimeUnixNano);

                        const updateData = {
                            model: attrs['ai.model.id'] || attrs['gen_ai.request.model'] || 'unknown',
                            provider: attrs['ai.model.provider'] || attrs['gen_ai.system'] || 'unknown',
                            prompt: parsedPrompt,
                            // Grab the response text from either Vercel or OTel standard keys
                            response: attrs['ai.response.text'] || attrs['gen_ai.completion'] || '',
                            usage: {
                                inputTokens: attrs['ai.usage.inputTokens'] || attrs['gen_ai.usage.input_tokens'] || 0,
                                outputTokens: attrs['ai.usage.outputTokens'] || attrs['gen_ai.usage.output_tokens'] || 0,
                                totalTokens: attrs['ai.usage.totalTokens'] || 0,
                            },
                            latencyMs: Math.round((end - start) / 1000000),
                            timestamp: new Date(start / 1000000)
                        };

                        // Use $set to update main fields without wiping out tool calls that might have arrived first
                        await Trace.findOneAndUpdate(
                            { traceId },
                            { $set: updateData },
                            { upsert: true, returnDocument: 'after' } // Fixed deprecation warning
                        );
                        console.log(`💾 Saved LLM Generation for Trace: ${traceId}`);
                    }

                    // 2. Handle Tool Calls
                    if (span.name === 'ai.toolCall') {
                        let parsedArgs = attrs['ai.toolCall.args'];
                        let parsedResult = attrs['ai.toolCall.result'];

                        try { if (parsedArgs) parsedArgs = JSON.parse(parsedArgs); } catch (e) { }
                        try { if (parsedResult) parsedResult = JSON.parse(parsedResult); } catch (e) { }

                        const start = parseInt(span.startTimeUnixNano);
                        const end = parseInt(span.endTimeUnixNano);

                        const toolCallData = {
                            toolName: attrs['ai.toolCall.name'],
                            arguments: parsedArgs,
                            result: parsedResult,
                            durationMs: Math.round((end - start) / 1000000)
                        };

                        // Use $push to safely append the tool call to the array
                        await Trace.findOneAndUpdate(
                            { traceId },
                            { $push: { toolCalls: toolCallData } },
                            { upsert: true, returnDocument: 'after' }
                        );
                        console.log(`🛠️  Saved Tool Call (${toolCallData.toolName}) for Trace: ${traceId}`);
                    }
                }
            }
        }

        res.status(200).json({ message: 'Traces processed' });
    } catch (error) {
        console.error('Error processing trace:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 agnost-server listening on http://localhost:${PORT}`);
});