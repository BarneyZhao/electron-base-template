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
    initProjectsDb: async (folderPath: string) => {
        const projectJsons = await getProjectJsons(folderPath);
        const projectInfo = await workerPool2.exec({ projectJsons });
        const db = await getDb();

        return new Promise((resolve) => {
            db.serialize(() => {
                const stmt = db.prepare(
                    `INSERT OR IGNORE INTO ${TABLE_NAME} (json_path, ${TABLE_SETS.join(
                        ','
                    )}, create_time) VALUES (?,?,?,?,?)`
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
        const db = await getDb();

        return new Promise((resolve) => {
            db.serialize(() => {
                db.all(
                    `SELECT json_path,${TABLE_SETS.join(
                        ','
                    )} FROM ${TABLE_NAME} WHERE file NOT NULL ORDER BY create_time desc limit 0,10`,
                    function (err: any, data: any) {
                        if (!err) {
                            resolve(data);
                        }
                    }
                );
            });
        });
    },
};

export default exportApis;
