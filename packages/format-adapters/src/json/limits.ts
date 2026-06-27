/**
 * Maximum object nesting depth accepted by read, kept well below the call-stack depth at which
 * recursive parsing or flattening would overflow. Exceeding it yields AdapterError "MAX_DEPTH_EXCEEDED".
 */
export const MAX_DEPTH = 100;

/**
 * Maximum input size in bytes accepted by read, checked before the file is loaded.
 * Exceeding it yields AdapterError "INPUT_TOO_LARGE".
 */
export const MAX_INPUT_BYTES = 16 * 1024 * 1024;
