/**
 * Ambient module declaration for plain CSS side-effect imports. tsconfig.app.json sets
 * "types": [] so the vite/client types are not pulled in; this is the minimal stand-in
 * needed for `import "./styles.css";` to type-check under NodeNext module resolution.
 */
declare module "*.css";
