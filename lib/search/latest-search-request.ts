export function createLatestSearchRequestGuard() {
  let currentGeneration = 0;

  return {
    begin() {
      currentGeneration += 1;
      return currentGeneration;
    },
    invalidate() {
      currentGeneration += 1;
    },
    isCurrent(generation: number) {
      return generation === currentGeneration;
    }
  };
}
