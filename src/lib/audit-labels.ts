/** Human labels for audit actions (client-safe). Unknown actions fall back to the raw key. */
export const AUDIT_LABELS: Record<string, string> = {
  "organization.created": "created the organization",
  "organization.updated": "updated organization settings",
  "organization.deleted": "deleted the organization",
  "member.invited": "invited a member",
  "invitation.revoked": "revoked an invitation",
  "invitation.accepted": "joined via invitation",
  "member.role_changed": "changed a member's role",
  "member.removed": "removed a member",
  "member.left": "left the organization",
  "api_key.created": "created an API key",
  "api_key.revoked": "revoked an API key",
  "billing.checkout_started": "started checkout",
  "billing.plan_changed": "changed the plan",
  "billing.canceled": "canceled the subscription",
  "billing.resumed": "resumed the subscription",
  "subscription.updated": "subscription updated",
  "invoice.paid": "invoice paid",
  "invoice.failed": "payment failed",
  "impersonation.started": "started impersonation",
  "impersonation.ended": "ended impersonation",
  "admin.plan_overridden": "plan overridden by support",
  "admin.webhook_replayed": "webhook replayed",
};

export const AUDIT_FILTERS = [
  { value: "", label: "All events" },
  { value: "member", label: "Members" },
  { value: "invitation", label: "Invitations" },
  { value: "api_key", label: "API keys" },
  { value: "billing", label: "Billing" },
  { value: "subscription", label: "Subscription" },
  { value: "invoice", label: "Invoices" },
  { value: "organization", label: "Organization" },
];

export function auditLabel(action: string) {
  return AUDIT_LABELS[action] ?? action;
}
