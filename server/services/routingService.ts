import { db } from '../db/database.ts';

interface AssignmentRuleRow {
  id: string;
  name: string;
  channel: string;
  platform: string;
  campaign_id: string;
  strategy: string;
  target_employee_id: string | null;
  target_department_id: string | null;
  priority_override: string;
  is_active: number;
  sort_order: number;
}

interface CandidateEmployee {
  id: string;
  full_name: string;
  department_id: string;
  max_capacity: number;
  active_queries: number;
}

export interface AssignmentMatchResult {
  employeeId: string | null;
  employeeName: string | null;
  ruleName: string | null;
  priorityOverride: string | null;
}

let roundRobinCursor = 0;

export function evaluateAssignmentRules(input: {
  channel: string;
  platform: string;
  campaign_id?: string | null;
}): AssignmentMatchResult {
  const rules = db
    .prepare('SELECT * FROM assignment_rules WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC')
    .all() as unknown as AssignmentRuleRow[];

  for (const rule of rules) {
    const channelMatch = rule.channel === 'Any' || rule.channel === input.channel;
    const platformMatch = rule.platform === 'Any' || rule.platform === input.platform;
    const campaignMatch =
      rule.campaign_id === 'Any' || (input.campaign_id && rule.campaign_id === input.campaign_id);

    if (!channelMatch || !platformMatch || !campaignMatch) {
      continue;
    }

    if (rule.strategy === 'specific_agent' && rule.target_employee_id) {
      const emp = db
        .prepare(`SELECT id, full_name FROM employees WHERE id = ? AND status = 'Active'`)
        .get(rule.target_employee_id) as { id: string; full_name: string } | undefined;

      if (emp) {
        return {
          employeeId: emp.id,
          employeeName: emp.full_name,
          ruleName: rule.name,
          priorityOverride: rule.priority_override !== 'Keep' ? rule.priority_override : null,
        };
      }
    }

    const deptClause = rule.target_department_id ? 'AND emp.department_id = ?' : '';
    const params = rule.target_department_id ? [rule.target_department_id] : [];

    const candidates = db
      .prepare(`
        SELECT emp.id, emp.full_name, emp.department_id, emp.max_capacity,
          (SELECT COUNT(*) FROM queries q WHERE q.assigned_employee_id = emp.id AND q.status != 'Resolved') AS active_queries
        FROM employees emp
        WHERE emp.status = 'Active' ${deptClause}
        ORDER BY active_queries ASC, emp.full_name ASC
      `)
      .all(...params) as unknown as CandidateEmployee[];

    const eligible = candidates.filter((c) => Number(c.active_queries) < Number(c.max_capacity));
    const pool = eligible.length > 0 ? eligible : candidates;

    if (pool.length > 0) {
      const chosen =
        rule.strategy === 'round_robin'
          ? pool[roundRobinCursor++ % pool.length]
          : pool[0];

      return {
        employeeId: chosen.id,
        employeeName: chosen.full_name,
        ruleName: rule.name,
        priorityOverride: rule.priority_override !== 'Keep' ? rule.priority_override : null,
      };
    }
  }

  return {
    employeeId: null,
    employeeName: null,
    ruleName: null,
    priorityOverride: null,
  };
}
