declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(filename: string, options?: any);
    prepare(sql: string): any;
    exec(sql: string): void;
    close(): void;
  }
}
