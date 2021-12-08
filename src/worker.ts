import { StaticPool } from 'node-worker-threads-pool';

import { Project } from 'types';
import { POOL_SIZE } from './config';

const staticPool = new StaticPool({
    size: POOL_SIZE,
    task({ projectJsons, folderPath }: { projectJsons: string[]; folderPath: string }) {
        const _fs = this.require('fs');
        return projectJsons
            .map((jsonPath) => {
                let jsonObj: Project = {} as Project;
                let createTime: number = Date.now();
                try {
                    createTime = _fs.statSync(jsonPath).ctimeMs;
                    jsonObj = JSON.parse(_fs.readFileSync(jsonPath, { encoding: 'utf8' }));
                } catch (error) {
                    console.log(error);
                }
                if (!jsonObj.type || jsonObj.type !== 'video') {
                    return false;
                }
                const { file, preview, title } = jsonObj;

                return {
                    relativeJsonPath: jsonPath.replace(folderPath, ''),
                    file,
                    preview,
                    title,
                    createTime,
                };
            })
            .filter(Boolean);
    },
});

export default staticPool;
