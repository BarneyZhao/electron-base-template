import { dialog, shell } from 'electron';
import fg from 'fast-glob';
import { chunk } from 'lodash';

import workerPool from './worker';
import { POOL_SIZE, JSON_FILE } from './config';
import {
    SCAN_PATH_TABLE_NAME,
    PROJECT_TABLE_NAME,
    ScanPathTableRow,
    ProjectTableRow,
    getDb,
} from './db';

const getProjectFolders = async (folderPath: string): Promise<string[]> => {
    const filesPath = await fg(`${folderPath}/**/${JSON_FILE}`);
    return (
        filesPath
            .filter((file) => !file.includes('@eaDir'))
            // 最后得到文件夹名
            .map((file) => file.replace(`${folderPath}/`, '').replace(`/${JSON_FILE}`, ''))
    );
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
        const processInfo = {
            scanTime: 0,
            globTime: 0,
            invalidCountTime: 0,
            deleteAndSelectTime: 0,
            needToCheckProjectsCount: 0,
            projectCheckTime: 0,
            insertTime: 0,
        };
        let timestamp = 0;

        timestamp = Date.now();
        const scanPathId = await getScanPathId(folderPath);
        processInfo.scanTime = Date.now() - timestamp;

        timestamp = Date.now();
        const projectFolders = await getProjectFolders(folderPath);
        processInfo.globTime = Date.now() - timestamp;

        timestamp = Date.now();
        const thisRoundFolders = projectFolders.join('","');

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
        processInfo.invalidCountTime = Date.now() - timestamp;

        timestamp = Date.now();
        const existFoldersAfterDelete = await new Promise<string[]>((resolve, reject) => {
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

                db.all(
                    `SELECT project_folder FROM ${PROJECT_TABLE_NAME} WHERE scan_path_id=?`,
                    [scanPathId],
                    function (err, data: { project_folder: string }[]) {
                        if (!err) {
                            resolve(data.map(({ project_folder }) => project_folder));
                        } else {
                            reject(err);
                        }
                    }
                );
            });
        });
        processInfo.deleteAndSelectTime = Date.now() - timestamp;

        timestamp = Date.now();
        const needToCheckProjects = projectFolders.filter(
            (f) => !existFoldersAfterDelete.includes(f)
        );
        const threadsTaskPromiseList = chunk(
            needToCheckProjects,
            Math.ceil(needToCheckProjects.length / POOL_SIZE)
        ).map((chunkJsons) =>
            workerPool.exec({ folderPath, jsonFile: JSON_FILE, projectFolders: chunkJsons })
        );
        const projectArr = (await Promise.all(threadsTaskPromiseList)).flat();
        processInfo.needToCheckProjectsCount = needToCheckProjects.length;
        processInfo.projectCheckTime = Date.now() - timestamp;

        timestamp = Date.now();
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

                processInfo.insertTime = Date.now() - timestamp;
                resolve({
                    length: projectFolders.length,
                    invalidCount,
                    newCount: needToCheckProjects.length,
                    processInfo,
                });
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

        return new Promise<{ total: number; list: ProjectTableRow[] }>((resolve) => {
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
