import { StaticPool } from 'node-worker-threads-pool';

import { Project } from 'types';
import { POOL_SIZE } from './config';

const staticPool = new StaticPool({
    size: POOL_SIZE,
    task({
        folderPath,
        relativeProjectJsons,
    }: {
        folderPath: string;
        relativeProjectJsons: string[];
    }) {
        const _fs = this.require('fs');
        return relativeProjectJsons.map((relativeJsonPath) => {
            const jsonPath = folderPath + relativeJsonPath;
            let jsonObj: Project = {} as Project;
            let createTime: number = Date.now();
            try {
                createTime = _fs.statSync(jsonPath).ctimeMs;
                jsonObj = JSON.parse(_fs.readFileSync(jsonPath, { encoding: 'utf8' }));
            } catch (error) {
                console.log(error);
            }
            const projectFolder = relativeJsonPath.slice(0, relativeJsonPath.lastIndexOf('/'));
            if (!jsonObj.type || jsonObj.type !== 'video') {
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
