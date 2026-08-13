const APOSTROPHE = "'";

const AMBIGUOUS_LEAD = /^'*[=+\-@\t\r]/;

const ESCAPED_LEAD = /^'+[=+\-@\t\r]/;

export function escapeFormulaLead(value: string): string {
  return AMBIGUOUS_LEAD.test(value) ? `${APOSTROPHE}${value}` : value;
}

export function unescapeFormulaLead(value: string): string {
  return ESCAPED_LEAD.test(value) ? value.slice(APOSTROPHE.length) : value;
}
