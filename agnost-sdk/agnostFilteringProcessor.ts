import { Span, SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';

export class AgnostFilteringProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    const attributes = span.attributes;

    // Only pass GenAI-related spans to exporter
    const isGenAI = Object.keys(attributes).some((key) =>
      key.startsWith('gen_ai.')
    );
    const isAI = Object.keys(attributes).some((key) =>
      key.startsWith('ai.')
    );
    const isLangSmith = Object.keys(attributes).some((key) =>
      key.startsWith('langsmith.')
    );

    // Pass only relevant spans
    if (isGenAI || isAI || isLangSmith) {
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