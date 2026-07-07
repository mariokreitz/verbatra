// Ambient module declaration for plain CSS side-effect imports (see main.tsx). tsconfig.app.json
// sets "types": [] so the vite/client triple-slash types are not pulled in; this is the minimal
// stand-in needed for `import "./styles.css";` to type-check under NodeNext module resolution.
declare module "*.css";
