import type { RawConfigFlowStep, RawFlowSchemaField } from '@twinhaus/ha-bridge';
import type { DiscoveryTransport, FlowField, FlowFieldType, FlowState } from './types.js';

const SECRET_PATTERN = /password|pin|token|api[_-]?key|secret/i;

function fieldType(field: RawFlowSchemaField): FlowFieldType {
  if (field.options || (field.selector && 'select' in field.selector)) return 'select';
  if (SECRET_PATTERN.test(field.name)) return 'password';
  switch (field.type) {
    case 'integer':
    case 'float':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'text';
  }
}

function fieldOptions(field: RawFlowSchemaField): FlowField['options'] {
  if (field.options) return field.options.map(([value, label]) => ({ value, label }));
  const select = field.selector?.select as { options?: unknown } | undefined;
  if (select?.options && Array.isArray(select.options)) {
    return select.options.map((option) =>
      typeof option === 'string'
        ? { value: option, label: option }
        : {
            value: String((option as { value: unknown }).value),
            label: String((option as { label: unknown }).label),
          },
    );
  }
  return undefined;
}

/** Convert Home Assistant's serialized `data_schema` into UI-ready {@link FlowField}s. */
export function normalizeSchema(schema: RawFlowSchemaField[] | undefined): FlowField[] {
  if (!schema) return [];
  return schema.map((field) => ({
    name: field.name,
    label: field.name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    type: fieldType(field),
    required: field.required ?? !field.optional,
    options: fieldOptions(field),
    default: field.default,
  }));
}

function toState(step: RawConfigFlowStep): FlowState {
  switch (step.type) {
    case 'form':
      return {
        status: 'form',
        flowId: step.flow_id,
        title: step.title ?? step.step_id ?? 'Configure',
        description: step.description_placeholders?.name,
        fields: normalizeSchema(step.data_schema),
        errors: step.errors ?? {},
      };
    case 'create_entry':
      return { status: 'done', title: step.title ?? 'Device added' };
    case 'abort':
      return { status: 'aborted', reason: step.reason ?? 'aborted' };
    default:
      return { status: 'progress' };
  }
}

/**
 * Drives a single Home Assistant config flow to completion from the UI: fetch the current step,
 * surface any required form, submit user input, and report done/aborted. It only ever advances a
 * flow the user explicitly chose to add — nothing here runs automatically.
 */
export class ConfigFlowController {
  private flowId: string | null = null;

  constructor(private readonly transport: DiscoveryTransport) {}

  /** Begin driving a discovered device's flow; returns the first step's state. */
  async begin(flowId: string): Promise<FlowState> {
    this.flowId = flowId;
    return this.run(() => this.transport.getFlow(flowId));
  }

  /** Submit the current form's input and advance the flow. */
  async submit(input: Record<string, unknown>): Promise<FlowState> {
    if (!this.flowId) return { status: 'error', message: 'No flow in progress.' };
    const flowId = this.flowId;
    return this.run(() => this.transport.stepFlow(flowId, input));
  }

  /** Abort the flow the user backed out of. */
  async cancel(): Promise<void> {
    if (!this.flowId) return;
    const flowId = this.flowId;
    this.flowId = null;
    await this.transport.abortFlow(flowId);
  }

  private async run(operation: () => Promise<RawConfigFlowStep>): Promise<FlowState> {
    try {
      const state = toState(await operation());
      if (state.status === 'done' || state.status === 'aborted') this.flowId = null;
      return state;
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }
}
