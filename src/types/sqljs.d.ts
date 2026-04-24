declare module 'sql.js' {
  export interface Statement {
    free(): void;
    getAsObject(): Record<string, unknown>;
    run(values?: unknown[] | Record<string, unknown>): void;
    step(): boolean;
  }

  export interface Database {
    close(): void;
    export(): Uint8Array;
    prepare(sql: string): Statement;
    run(sql: string): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | Buffer | ArrayLike<number>) => Database;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}
