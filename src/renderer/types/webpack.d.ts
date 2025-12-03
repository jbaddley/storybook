declare namespace NodeJS {
  interface Module {
    hot?: {
      accept(path?: string, callback?: () => void): void;
      accept(dependencies: string[], callback?: (updatedDependencies: string[]) => void): void;
      accept(callback?: (updatedDependencies: string[]) => void): void;
      decline(dependencies?: string[]): void;
      decline(dependency?: string): void;
      decline(): void;
      dispose(callback: (data: any) => void): void;
      addDisposeHandler(callback: (data: any) => void): void;
      removeDisposeHandler(callback: (data: any) => void): void;
      invalidate(): void;
      status(): 'idle' | 'check' | 'prepare' | 'ready' | 'dispose' | 'apply' | 'abort' | 'fail';
      active: boolean;
      data: any;
    };
  }
}

