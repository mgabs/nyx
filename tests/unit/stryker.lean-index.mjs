// Run the injector orchestrator separately from the extracted Lean components.
import options from './stryker.lean.mjs';

export default {...options, mutate: ['src/inject/lean-theme/index.ts']};
