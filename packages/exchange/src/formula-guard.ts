const APOSTROPHE = "'";

const AMBIGUOUS_LEAD = /^'*[=+\-@]/;

const ESCAPED_LEAD = /^'+[=+\-@]/;

export function escapeFormulaLead(value: string): string {
  return AMBIGUOUS_LEAD.test(value) ? `${APOSTROPHE}${value}` : value;
}

export function unescapeFormulaLead(value: string): string {
  return ESCAPED_LEAD.test(value) ? value.slice(APOSTROPHE.length) : value;
}
