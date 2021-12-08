import { dialog, shell } from 'electron';
import glob from 'glob';
import { chunk } from 'lodash';

import workerPool from './worker';
import { POOL_SIZE } from './config';

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
};

export default exportApis;
