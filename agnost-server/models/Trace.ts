import mongoose, { Schema, Document } from 'mongoose';

// Interface for a single tool execution
export interface IToolCall {
    toolName: string;
    arguments: any; // Parsed JSON
    result: any;    // Parsed JSON
    durationMs: number;
}

// Interface for the main LLM Trace
export interface ITrace {
    traceId: string;
    model: string;
    provider: string;
    prompt: any[]; // The messages array
    response: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    latencyMs: number;
    timestamp: Date;
    toolCalls: IToolCall[];
}

const ToolCallSchema = new Schema({
    toolName: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed }, // Mixed type because tool args vary
    result: { type: Schema.Types.Mixed },
    durationMs: { type: Number }
});

const TraceSchema = new Schema({
    traceId: { type: String, required: true, unique: true },
    model: { type: String, required: true },
    provider: { type: String },
    prompt: { type: Schema.Types.Mixed }, // Array of message objects
    response: { type: String },
    usage: {
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 }
    },
    latencyMs: { type: Number },
    timestamp: { type: Date, default: Date.now },
    toolCalls: [ToolCallSchema] // Embed the tool calls
});

export const Trace = mongoose.model<ITrace>('Trace', TraceSchema);