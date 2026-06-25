declare module "sql.js" {
  interface SqlJsStatic {
    Database: new (data: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
    close(): void;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
  export type { Database };
}
