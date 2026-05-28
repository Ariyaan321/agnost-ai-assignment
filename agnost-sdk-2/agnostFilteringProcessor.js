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
        // Filter logic: Check for key GenAI or LangSmith indicators
        const isGenAi = Object.keys(attributes).some((key) => key.startsWith("gen_ai."));
        const isLangSmith = Object.keys(attributes).some((key) => key.startsWith("langsmith."));
        const isOpenInference = Object.keys(attributes).some((key) => key.startsWith("openinference."));
        // If it's not relevant, we simply don't pass it to the delegate (the exporter)
        if (isGenAi || isLangSmith || isOpenInference) {
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