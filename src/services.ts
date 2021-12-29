import { dialog, shell } from 'electron';
import glob from 'glob';
import { chunk } from 'lodash';

import workerPool from './worker';
import { POOL_SIZE } from './config';
import {
    SCAN_PATH_TABLE_NAME,
    PROJECT_TABLE_NAME,
    ScanPathTableRow,
    ProjectTableRow,
    getDb,
} from './db';

const getProjectJsons = (folderPath: string, isRelative?: boolean): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        console.log('running glob...');
        glob(`${folderPath}/**/project.json`, { nodir: true }, (err, filesPath) => {
            if (!err) {
                resolve(
                    filesPath
                        .filter((file) => !file.includes('@eaDir'))
                        .map((file) => (isRelative ? file.replace(folderPath, '') : file))
                );
            } else {
                reject(err);
            }
        });
    });
};

const getScanPathId = async (folderPath: string) => {
    const db = await getDb();
    return new Promise<ScanPathTableRow['id']>((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `INSERT OR IGNORE INTO ${SCAN_PATH_TABLE_NAME} (path) VALUES (?)`,
                [folderPath],
                function (err) {
                    if (err) reject(err);
                }
            );
            db.get(
                `SELECT id FROM ${SCAN_PATH_TABLE_NAME} WHERE path=?`,
                [folderPath],
                function (err, row: ScanPathTableRow) {
                    if (!err) {
                        resolve(row.id);
                    } else {
                        reject(err);
                    }
                }
            );
        });
    });
};

const exportApis = {
    selectFolder: async () => {
        const pathRes = dialog.showOpenDialogSync({
            properties: ['openDirectory'],
        });
        if (!pathRes || pathRes.length === 0) return;
        return pathRes[0].replace(/\\/g, '/');
    },
    openFile: async (file: string) => {
        shell.openPath(file);
    },
    scanProjectsToDb: async (folderPath: string) => {
        const scanPathId = await getScanPathId(folderPath);
        const relativeProjectJsons = await getProjectJsons(folderPath, true);

        const threadsTaskPromiseList = chunk(
            relativeProjectJsons,
            Math.ceil(relativeProjectJsons.length / POOL_SIZE)
        ).map((chunkJsons) => workerPool.exec({ folderPath, relativeProjectJsons: chunkJsons }));

        const projectArr = (await Promise.all(threadsTaskPromiseList)).flat();
        const thisRoundFolders = projectArr.map(({ projectFolder }) => projectFolder).join('","');

        const db = await getDb();

        const invalidCount = await new Promise<number>((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) AS count FROM ${PROJECT_TABLE_NAME}
                    WHERE scan_path_id=? AND project_folder NOT IN ("${thisRoundFolders}")
                `,
                [scanPathId],
                function (err, row: { count: number }) {
                    if (!err) {
                        resolve(row.count);
                    } else {
                        reject(err);
                    }
                }
            );
        });
        const existCountAfterDelete = await new Promise<number>((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    `DELETE FROM ${PROJECT_TABLE_NAME}
                        WHERE scan_path_id=? AND project_folder NOT IN ("${thisRoundFolders}")
                    `,
                    [scanPathId],
                    function (err) {
                        if (err) reject(err);
                    }
                );

                db.get(
                    `SELECT COUNT(*) AS count FROM ${PROJECT_TABLE_NAME} WHERE scan_path_id=?`,
                    [scanPathId],
                    function (err, row: { count: number }) {
                        if (!err) {
                            resolve(row.count);
                        } else {
                            reject(err);
                        }
                    }
                );
            });
        });
        const newCount = projectArr.length - existCountAfterDelete;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                const stmt = db.prepare(
                    `INSERT OR IGNORE INTO ${PROJECT_TABLE_NAME} (
                        scan_path_id,
                        project_folder,
                        file,
                        preview,
                        title,
                        create_time
                    ) VALUES (
                        $scan_path_id,
                        $project_folder,
                        $file,
                        $preview,
                        $title,
                        $create_time
                    )`
                );
                projectArr.forEach(({ projectFolder, file, preview, title, createTime }) => {
                    const param: Record<string, string | number> = {
                        $scan_path_id: scanPathId,
                        $project_folder: projectFolder,
                    };
                    if (file) {
                        Object.assign(param, {
                            $file: file,
                            $preview: preview,
                            $title: title,
                            $create_time: createTime,
                        });
                    }
                    stmt.run(param);
                });
                stmt.finalize(function (err) {
                    if (err) reject(err);
                });

                resolve({ length: projectArr.length, invalidCount, newCount });
            });
        });
    },
    getProjectsByPage: async (folderPath: string, pageNo = 1, pageSize = 20) => {
        const scanPathId = await getScanPathId(folderPath);
        const limitStr = `${(pageNo - 1) * pageSize}, ${pageSize}`;
        const querySets = `project_folder, file, preview, title`;

        const db = await getDb();

        const total = await new Promise<number>((resolve) => {
            db.get(
                `SELECT COUNT(*) AS total FROM ${PROJECT_TABLE_NAME}
                    WHERE scan_path_id=? AND file NOT NULL
                    ORDER BY create_time DESC
                `,
                [scanPathId],
                function (err, row: { total: number }) {
                    if (!err) {
                        resolve(row.total);
                    } else {
                        console.log(err);
                        resolve(0);
                    }
                }
            );
        });

        return new Promise<any>((resolve) => {
            db.all(
                `SELECT ${querySets} FROM ${PROJECT_TABLE_NAME}
                    WHERE scan_path_id=? AND file NOT NULL
                    ORDER BY create_time DESC
                    LIMIT ${limitStr}
                `,
                [scanPathId],
                function (err, data: ProjectTableRow[]) {
                    if (!err) {
                        resolve({ total, list: data });
                    } else {
                        console.log(err);
                        resolve({ total, list: [] });
                    }
                }
            );
        });
    },
};

export default exportApis;
