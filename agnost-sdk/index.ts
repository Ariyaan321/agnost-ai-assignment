import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initAgnost(config: { url?: string } = {}) {
    const endpoint = config.url || 'http://localhost:8080/v1/traces';
    const exporter = new OTLPTraceExporter({ url: endpoint });

    const sdk = new NodeSDK({
        // Force OTel to send traces immediately instead of waiting for a batch
        spanProcessor: new SimpleSpanProcessor(exporter),
    });

    sdk.start();
    console.log(`[Agnost] Telemetry bridge active. Sending data to ${endpoint}`);
}