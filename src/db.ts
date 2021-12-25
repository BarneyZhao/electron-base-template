import fs from 'fs/promises';
import sqlite3, { Database } from 'sqlite3';

const DB_FILE = './file.db';

const sqlite = sqlite3.verbose();
let db: Database;

export const TABLE_NAME = 't_files';
export const TABLE_SETS = ['file', 'preview', 'title'];

export async function getDb() {
    if (db) return db;
    const isDbExist = await fs.stat(DB_FILE).catch(() => false);

    db = new sqlite.Database(DB_FILE);
    if (!isDbExist) {
        const tableSets = TABLE_SETS.map((n) => `${n} TEXT`).join(',');
        db.run(
            `CREATE TABLE ${TABLE_NAME} (json_path TEXT NOT NULL UNIQUE, ${tableSets}, create_time DATE)`
        );
    }
    return db;
}

export function closeDb() {
    if (db) {
        db.close();
    }
}
