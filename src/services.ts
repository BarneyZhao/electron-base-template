import { dialog, shell } from 'electron';

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
};

export default exportApis;
