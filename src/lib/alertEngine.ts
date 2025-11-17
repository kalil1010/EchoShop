/**
 * Alert Engine
 * 
 * Evaluates alert rules and triggers alerts
 */

interface AlertCondition {
  metric: string
  operator: '<' | '>' | '=' | '<=' | '>=' | '!='
  value: number | string
}

interface AlertRule {
  id: string
  rule_name: string
  rule_type: string
  conditions: AlertCondition | AlertCondition[]
  auto_action?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Evaluate a condition
 */
function evaluateCondition(condition: AlertCondition, actualValue: number | string): boolean {
  const { operator, value } = condition

  switch (operator) {
    case '<':
      return Number(actualValue) < Number(value)
    case '>':
      return Number(actualValue) > Number(value)
    case '=':
      return actualValue === value
    case '<=':
      return Number(actualValue) <= Number(value)
    case '>=':
      return Number(actualValue) >= Number(value)
    case '!=':
      return actualValue !== value
    default:
      return false
  }
}

/**
 * Evaluate alert rule conditions
 */
export function evaluateAlertRule(rule: AlertRule, context: Record<string, unknown>): boolean {
  const { conditions } = rule

  if (Array.isArray(conditions)) {
    // All conditions must be true (AND logic)
    return conditions.every((condition) => {
      const actualValue = context[condition.metric]
      if (actualValue === undefined) return false
      return evaluateCondition(condition, actualValue as number | string)
    })
  } else {
    const actualValue = context[conditions.metric]
    if (actualValue === undefined) return false
    return evaluateCondition(conditions, actualValue as number | string)
  }
}

/**
 * Create an alert from a rule
 */
export async function createAlertFromRule(
  rule: AlertRule,
  context: {
    vendorId?: string
    relatedEntityType?: string
    relatedEntityId?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const response = await fetch('/api/admin/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        rule_id: rule.id,
        alert_type: rule.rule_type,
        severity: rule.severity,
        title: rule.rule_name,
        description: `Alert triggered: ${rule.rule_name}`,
        vendor_id: context.vendorId,
        related_entity_type: context.relatedEntityType,
        related_entity_id: context.relatedEntityId,
        metadata: context.metadata,
      }),
    })

    if (!response.ok) {
      console.error('Failed to create alert:', await response.text())
    }
  } catch (error) {
    console.error('Error creating alert:', error)
  }
}

/**
 * Check vendor health and trigger alerts if needed
 */
export async function checkVendorHealthAlerts(vendorId: string, healthScore: number): Promise<void> {
  try {
    // Fetch active alert rules for vendor health
    const response = await fetch('/api/admin/alerts/rules?type=vendor_health&active=true', {
      credentials: 'include',
    })

    if (!response.ok) return

    const data = await response.json()
    const rules: AlertRule[] = data.rules || []

    // Evaluate each rule
    for (const rule of rules) {
      const context = { health_score: healthScore }
      if (evaluateAlertRule(rule, context)) {
        await createAlertFromRule(rule, {
          vendorId,
          relatedEntityType: 'vendor',
          relatedEntityId: vendorId,
          metadata: { health_score: healthScore },
        })
      }
    }
  } catch (error) {
    console.error('Error checking vendor health alerts:', error)
  }
}

