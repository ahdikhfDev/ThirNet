// Rule engine - run all validation rules
import type { ParsedDevice, TopologyGraph, ValidationResult, ValidationSummary } from '../parsers/types';
import type { RuleContext } from './types';
import type { IssueDef } from './types';
import { ipConflict } from './rules/ipConflict';
import { subnetOverlap } from './rules/subnetOverlap';
import { gatewayUnreachable } from './rules/gatewayUnreachable';
import { mtuMismatch, duplicateRouterId, asnMismatch, disabledInterfaceActive, vlanConfig } from './rules/miscRules';

const ALL_RULES = [
  { id: 'ip-conflict', name: 'IP Conflict', fn: ipConflict },
  { id: 'subnet-overlap', name: 'Subnet Overlap', fn: subnetOverlap },
  { id: 'gateway-unreachable', name: 'Gateway Unreachable', fn: gatewayUnreachable },
  { id: 'mtu-mismatch', name: 'MTU Mismatch', fn: mtuMismatch },
  { id: 'duplicate-router-id', name: 'Duplicate Router-ID', fn: duplicateRouterId },
  { id: 'asn-mismatch', name: 'ASN Mismatch', fn: asnMismatch },
  { id: 'disabled-interface-active', name: 'Disabled Interface Active', fn: disabledInterfaceActive },
  { id: 'vlan-config', name: 'VLAN Configuration', fn: vlanConfig },
];

export function runAllValidation(devices: ParsedDevice[], topology: TopologyGraph): ValidationResult {
  const ctx: RuleContext = { devices, topology };

  const allIssues: IssueDef[] = [];
  const byRule: Record<string, number> = {};
  const byDevice: Record<string, { errors: number; warnings: number; infos: number }> = {};

  for (const rule of ALL_RULES) {
    try {
      const ruleIssues = rule.fn(ctx);
      for (const issue of ruleIssues) {
        allIssues.push(issue);
        byRule[rule.id] = (byRule[rule.id] || 0) + 1;
        if (issue.deviceId) {
          if (!byDevice[issue.deviceId]) {
            byDevice[issue.deviceId] = { errors: 0, warnings: 0, infos: 0 };
          }
          if (issue.severity === 'error') byDevice[issue.deviceId].errors++;
          else if (issue.severity === 'warning') byDevice[issue.deviceId].warnings++;
          else byDevice[issue.deviceId].infos++;
        }
      }
    } catch (e: any) {
      allIssues.push({
        id: `rule-error-${rule.id}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: 'error',
        message: `Rule ${rule.id} error: ${e.message}`,
        suggestion: 'Internal validation error — periksa data perangkat',
      });
    }
  }

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  const summary: ValidationSummary = {
    total: allIssues.length,
    errors: errors.length,
    warnings: warnings.length,
    infos: infos.length,
    byDevice,
    byRule,
  };

  return {
    issues: allIssues,
    summary,
    errors,
    warnings,
    infos,
  };
}

// Re-export types
export type { IssueDef, RuleContext } from './types';