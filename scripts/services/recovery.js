export function createRecoveryService() {
  return Object.freeze({
    create: reason => console.log('Recovery point created:', reason),
    render: () => {},
  });
}

