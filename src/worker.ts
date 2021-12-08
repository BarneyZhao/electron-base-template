import { StaticPool } from 'node-worker-threads-pool';

import { POOL_SIZE } from './config';

const staticPool = new StaticPool({
    size: POOL_SIZE,
    task({ someParams }: { someParams: any }) {
        const _fs = this.require('fs');
        return null; // something
    },
});

export default staticPool;
