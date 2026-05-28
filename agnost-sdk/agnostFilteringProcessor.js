export class AgnostFilteringProcessor {
    delegate;
    constructor(delegate) {
        this.delegate = delegate;
    }
    onStart(span, parentContext) {
        this.delegate.onStart(span, parentContext);
    }
    onEnd(span) {
        const attributes = span.attributes;
        // Only pass GenAI-related spans to exporter
        const isGenAI = Object.keys(attributes).some((key) => key.startsWith('gen_ai.'));
        const isAI = Object.keys(attributes).some((key) => key.startsWith('ai.'));
        const isLangSmith = Object.keys(attributes).some((key) => key.startsWith('langsmith.'));
        // Pass only relevant spans
        if (isGenAI || isAI || isLangSmith) {
            this.delegate.onEnd(span);
        }
    }
    shutdown() {
        return this.delegate.shutdown();
    }
    forceFlush() {
        return this.delegate.forceFlush();
    }
}
//# sourceMappingURL=agnostFilteringProcessor.js.map