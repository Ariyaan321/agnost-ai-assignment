import { Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Context } from "@opentelemetry/api";

export class AgnostFilteringProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

    onStart(span: Span, parentContext: Context): void {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: Span): void {
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

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }
}