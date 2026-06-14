import type { ParsedDevice, TopologyGraph } from '../parsers/types';

export interface IssueDef {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'error';
  deviceId?: string;
  deviceHostname?: string;
  interfaceId?: string;
  interfaceName?: string;
  edgeId?: string;
  message: string;
  suggestion?: string;
  sourceLine?: number;
}

export interface RuleContext {
  devices: ParsedDevice[];
  topology: TopologyGraph;
}

export type RuleFn = (ctx: RuleContext) => IssueDef[];