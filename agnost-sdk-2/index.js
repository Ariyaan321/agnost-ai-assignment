import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
export function initAgnost(config = {}) {
    process.env.LANGSMITH_OTEL_ENABLED = 'true';
    process.env.LANGSMITH_OTEL_ONLY = 'true';
    const endpoint = config.url || 'http://localhost:8080/v1/traces';
    const exporter = new OTLPTraceExporter({ url: endpoint });
    // Wrap the batch processor with your filtering processor
    // const batchProcessor = new BatchSpanProcessor(exporter);
    // const filteringProcessor = new AgnostFilteringProcessor(batchProcessor);
    const sdk = new NodeSDK({
        // Do not pass traceExporter directly; pass your custom span processor instead
        // spanProcessor: filteringProcessor,
        traceExporter: exporter,
        instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
}
//# sourceMappingURL=index.js.map