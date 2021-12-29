import sqlite3, { Database } from 'sqlite3';

const DB_FILE = './app.db';

const sqlite = sqlite3.verbose();
let db: Database;

export const SCAN_PATH_TABLE_NAME = 't_scan_paths';
export const PROJECT_TABLE_NAME = 't_projects';

export interface ScanPathTableRow {
    id: number;
    path: string;
}

export interface ProjectTableRow {
    scan_path_id: number;
    project_folder: string;
    file: string;
    preview: string;
    title: string;
    create_time: string;
}

// CREATE TABLE "" (
// 	"Field1"	INTEGER NOT NULL UNIQUE,
// 	"Field2"	TEXT NOT NULL UNIQUE,
// 	PRIMARY KEY("Field1" AUTOINCREMENT)
// );

export async function getDb() {
    if (db) return db;

    db = new sqlite.Database(DB_FILE);

    return new Promise<Database>((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `CREATE TABLE IF NOT EXISTS ${SCAN_PATH_TABLE_NAME} (
                    "id"    INTEGER NOT NULL UNIQUE,
                    "path"  TEXT NOT NULL UNIQUE,
                    PRIMARY KEY("id" AUTOINCREMENT)
                )`,
                function (err) {
                    if (err) reject(err);
                }
            );
            db.run(
                `CREATE TABLE IF NOT EXISTS ${PROJECT_TABLE_NAME} (
                    "scan_path_id"      INTEGER NOT NULL,
                    "project_folder"    TEXT NOT NULL UNIQUE,
                    "file"              TEXT,
                    "preview"           TEXT,
                    "title"             TEXT,
                    "create_time"       DATE,
                    PRIMARY KEY("project_folder")
                )`,
                function (err) {
                    if (err) reject(err);
                }
            );
            resolve(db);
        });
    });
}

export function closeDb() {
    if (db) {
        db.close();
    }
}
