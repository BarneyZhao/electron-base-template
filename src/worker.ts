import { StaticPool } from 'node-worker-threads-pool';

import { Project } from 'types';
import { POOL_SIZE } from './config';

const staticPool = new StaticPool({
    size: POOL_SIZE,
    task({
        folderPath,
        jsonFile,
        projectFolders,
    }: {
        folderPath: string;
        jsonFile: string;
        projectFolders: string[];
    }) {
        const _fs = this.require('fs');
        const videoReg = new RegExp(/video/i);
        return projectFolders.map((projectFolder) => {
            const jsonPath = `${folderPath}/${projectFolder}/${jsonFile}`;
            let jsonObj: Project = {} as Project;
            let createTime: number = Date.now();
            try {
                createTime = _fs.statSync(jsonPath).ctimeMs;
                jsonObj = JSON.parse(_fs.readFileSync(jsonPath, { encoding: 'utf8' }));
            } catch (error) {
                console.log(error);
            }
            if (!jsonObj.type || !videoReg.test(jsonObj.type)) {
                return { projectFolder };
            }
            const { file, preview, title } = jsonObj;

            return {
                projectFolder,
                file,
                preview,
                title,
                createTime,
            };
        });
    },
});

export default staticPool;
