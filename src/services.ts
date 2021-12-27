import { dialog, shell } from 'electron';
import glob from 'glob';
import { chunk } from 'lodash';

import workerPool from './worker';
import workerPool2 from './worker2';
import { POOL_SIZE } from './config';
import { TABLE_NAME, TABLE_SETS, getDb } from './db';

const getProjectJsons = (folderPath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        console.log('running glob...');
        glob(`${folderPath}/**/project.json`, { nodir: true }, (err, filesPath) => {
            if (!err) {
                resolve(filesPath.filter((file) => !file.includes('@eaDir')));
            } else {
                reject(err);
            }
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
    getProjects: async (folderPath: string) => {
        const projectJsons = await getProjectJsons(folderPath);
        const threadsTaskPromiseList = chunk(
            projectJsons,
            Math.ceil(projectJsons.length / POOL_SIZE)
        ).map((chunkJsons) => workerPool.exec({ projectJsons: chunkJsons, folderPath }));

        const projectArr = await Promise.all(threadsTaskPromiseList);
        // 时间降序
        return projectArr.flat().sort((a, b) => {
            if (a && b) return b.createTime - a.createTime;
            return 0;
        });
    },
    initProjectsDb2: async (folderPath: string) => {
        const projectJsons = await getProjectJsons(folderPath);
        const db = await getDb();

        return new Promise((resolve) => {
            db.serialize(() => {
                const stmt = db.prepare(
                    `INSERT OR IGNORE INTO ${TABLE_NAME} (json_path) VALUES (?)`
                );
                projectJsons.forEach((jsonPath) => {
                    stmt.run(jsonPath);
                });
                stmt.finalize();

                resolve({ length: projectJsons.length });
            });
        });
    },
    getProjectsByPage2: async (folderPath: string, pageNo = 1, pageSize = 20) => {
        const limitStr = `${(pageNo - 1) * pageSize}, ${pageSize}`;
        const querySets = `json_path, ${TABLE_SETS.join(',')}`;

        const db = await getDb();

        const list = await new Promise<Record<string, string>[]>((resolve) => {
            db.serialize(() => {
                db.all(
                    `SELECT ${querySets} FROM ${TABLE_NAME} LIMIT ${limitStr}`,
                    function (err: any, data: any) {
                        if (!err) {
                            resolve(data);
                        } else {
                            console.log(err);
                            resolve([]);
                        }
                    }
                );
            });
        });

        const projectList: Record<string, string>[] = [];
        for await (const project of list) {
            let temp: Record<string, any> = project;
            if (!project.file) {
                [temp] = await workerPool2.exec({ projectJsons: [temp.jsonPath] });
            }
            projectList.push(temp);
        }
        return projectList;
    },
    initProjectsDb: async (folderPath: string) => {
        const projectJsons = await getProjectJsons(folderPath);
        const projectInfo = await workerPool2.exec({ projectJsons });

        const insertSets = `json_path, ${TABLE_SETS.join(',')}, create_time`;
        const db = await getDb();

        return new Promise((resolve) => {
            db.serialize(() => {
                const stmt = db.prepare(
                    `INSERT OR IGNORE INTO ${TABLE_NAME} (${insertSets}) VALUES (?,?,?,?,?)`
                );
                projectInfo.forEach(({ jsonPath, file, preview, title, createTime }) => {
                    const param: any[] = [jsonPath];
                    if (file) {
                        param.push(
                            file,
                            preview || '',
                            title || '',
                            createTime && new Date(createTime)
                        );
                    }
                    stmt.run(param);
                });
                stmt.finalize();

                resolve({ length: projectInfo.length });
            });
        });
    },
    getProjectsByPage: async (folderPath: string, pageNo = 1, pageSize = 20) => {
        const limitStr = `${(pageNo - 1) * pageSize}, ${pageSize}`;
        const querySets = `json_path, ${TABLE_SETS.join(',')}`;

        const db = await getDb();

        const list = await new Promise<Record<string, string>[]>((resolve) => {
            db.serialize(() => {
                db.all(
                    `SELECT ${querySets} FROM ${TABLE_NAME} WHERE file NOT NULL ORDER BY create_time DESC LIMIT ${limitStr}`,
                    function (err: any, data: any) {
                        if (!err) {
                            resolve(data);
                        } else {
                            console.log(err);
                            resolve([]);
                        }
                    }
                );
            });
        });

        return list;
    },
};

export default exportApis;
