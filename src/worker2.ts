import { StaticPool } from 'node-worker-threads-pool';

import { Project } from 'types';
import { POOL_SIZE } from './config';

const staticPool = new StaticPool({
    size: POOL_SIZE,
    task({ projectJsons }: { projectJsons: string[] }) {
        const _fs = this.require('fs');
        return projectJsons.map((jsonPath) => {
            let jsonObj: Project = {} as Project;
            let createTime: number = Date.now();
            try {
                createTime = _fs.statSync(jsonPath).ctimeMs;
                jsonObj = JSON.parse(_fs.readFileSync(jsonPath, { encoding: 'utf8' }));
            } catch (error) {
                console.log(error);
            }
            if (!jsonObj.type || jsonObj.type !== 'video') {
                return {
                    jsonPath,
                };
            }
            const { file, preview, title } = jsonObj;

            return {
                jsonPath,
                file,
                preview,
                title,
                createTime,
            };
        });
    },
});

export default staticPool;
