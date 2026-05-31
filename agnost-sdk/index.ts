import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import express from 'express';
import path from 'path';

// import { generateText as originalGenerateText, tool, stepCountIs } from 'ai';

// In-memory datastore for the developer's local session
const tracesStore = new Map<string, any>();

function startLocalUiServer(port: number) {
    const app = express();
    app.use(express.json());

    // 1. Serve the frontend HTML folder
    app.use(express.static(path.join(__dirname, 'public')));

    // 2. The OTLP Receiver & Parser (moved from your agnost-server)
    app.post('/v1/traces', (req, res) => {
        const resourceSpans = req.body.resourceSpans || [];

        for (const rs of resourceSpans) {
            for (const ss of rs.scopeSpans || []) {
                for (const span of ss.spans || []) {
                    const traceId = span.traceId;

                    if (!tracesStore.has(traceId)) {
                        tracesStore.set(traceId, { traceId, toolCalls: [] });
                    }

                    const traceData = tracesStore.get(traceId);

                    // Flatten attributes helper
                    const attrs: Record<string, any> = {};
                    for (const attr of span.attributes || []) {
                        if (attr.value.stringValue !== undefined) attrs[attr.key] = attr.value.stringValue;
                        else if (attr.value.intValue !== undefined) attrs[attr.key] = attr.value.intValue;
                    }

                    // Parse LLM Generation
                    if (span.name === 'ai.generateText' || span.name.includes('doGenerate')) {
                        traceData.model = attrs['ai.model.id'] || attrs['gen_ai.request.model'];
                        traceData.provider = attrs['ai.model.provider'] || attrs['gen_ai.system'];
                        try { traceData.prompt = JSON.parse(attrs['ai.prompt.messages']); } catch (e) { }
                        traceData.response = attrs['ai.response.text'] || attrs['gen_ai.completion'];

                        traceData.usage = {
                            inputTokens: attrs['ai.usage.inputTokens'] || 0,
                            outputTokens: attrs['ai.usage.outputTokens'] || 0,
                            totalTokens: attrs['ai.usage.totalTokens'] || 0,
                        };

                        // ADDED: Calculate latency from start and end times
                        const start = parseInt(span.startTimeUnixNano);
                        const end = parseInt(span.endTimeUnixNano);
                        traceData.latencyMs = Math.round((end - start) / 1000000);
                        traceData.timestamp = new Date(start / 1000000).toISOString();
                    }

                    // Parse Tool Calls
                    if (span.name === 'ai.toolCall') {
                        let parsedArgs = attrs['ai.toolCall.args'];
                        let parsedResult = attrs['ai.toolCall.result'];
                        try { if (parsedArgs) parsedArgs = JSON.parse(parsedArgs); } catch (e) { }
                        try { if (parsedResult) parsedResult = JSON.parse(parsedResult); } catch (e) { }

                        // ADDED: Calculate tool duration
                        const start = parseInt(span.startTimeUnixNano);
                        const end = parseInt(span.endTimeUnixNano);

                        traceData.toolCalls.push({
                            toolName: attrs['ai.toolCall.name'],
                            arguments: parsedArgs,
                            result: parsedResult,
                            durationMs: Math.round((end - start) / 1000000)
                        });
                    }
                }
            }
        }
        res.status(200).send();
    });

    // 3. The API route for the frontend to fetch the clean schema
    app.get('/api/traces', (req, res) => {
        const tracesArray = Array.from(tracesStore.values()).filter(t => t.model);
        res.status(200).json(tracesArray);
    });

    app.listen(port, () => {
        console.log(`[Agnost] Local Observability UI running at http://localhost:${port}`);
    });
}

export function initAgnost(config: { port?: number } = {}) {
    const port = config.port || 8080;
    startLocalUiServer(port)
    const exporter = new OTLPTraceExporter({ url: `http://localhost:${port}/v1/traces` });

    const sdk = new NodeSDK({
        // Force OTel to send traces immediately instead of waiting for a batch
        spanProcessor: new SimpleSpanProcessor(exporter),
    });

    sdk.start();
    console.log(`[Agnost] Telemetry bridge active. Sending data to port ${port}`);
}

// export const generateText: typeof originalGenerateText = (async (options: any) => {
//     return originalGenerateText({
//         ...options,
//         experimental_telemetry: {
//             isEnabled: true,
//             recordInputs: true,
//             recordOutputs: true,
//             ...(options.experimental_telemetry || {})
//         }
//     });
// }) as any

// export { tool, stepCountIs };