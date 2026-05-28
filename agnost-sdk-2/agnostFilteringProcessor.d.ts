import { Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Context } from "@opentelemetry/api";
export declare class AgnostFilteringProcessor implements SpanProcessor {
    private readonly delegate;
    constructor(delegate: SpanProcessor);
    onStart(span: Span, parentContext: Context): void;
    onEnd(span: Span): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
//# sourceMappingURL=agnostFilteringProcessor.d.ts.map