addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

const FILE_LIST_KEY = 'file_list';

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // 处理CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    try {
        switch (url.pathname) {
            case '/upload':
                return await handleUpload(request);
            case '/files':
                return await handleGetFiles();
            case '/download':
                return await handleDownload(url);
            case '/rename':
                return await handleRename(request);
            default:
                return new Response('Not Found', { status: 404 });
        }
    } catch (error) {
        return new Response(error.stack, { status: 500 });
    }
}

async function handleUpload(request) {
    const formData = await request.formData();
    const file = formData.get('file');
    
    // 保存文件内容
    await FILE_STORAGE.put(file.name, file.stream());
    
    // 更新文件列表
    const files = JSON.parse(await FILE_STORAGE.get(FILE_LIST_KEY) || [];
    if (!files.includes(file.name)) {
        files.push(file.name);
        await FILE_STORAGE.put(FILE_LIST_KEY, JSON.stringify(files));
    }

    return new Response('OK', {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        }
    });
}

async function handleGetFiles() {
    const files = JSON.parse(await FILE_STORAGE.get(FILE_LIST_KEY)) || [];
    return new Response(JSON.stringify(files), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleDownload(url) {
    const filename = url.searchParams.get('filename');
    const file = await FILE_STORAGE.get(filename, 'arrayBuffer');
    
    if (!file) return new Response('File not found', { status: 404 });

    return new Response(file, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleRename(request) {
    const { oldName, newName } = await request.json();
    
    // 获取旧文件内容
    const oldFile = await FILE_STORAGE.get(oldName, 'arrayBuffer');
    if (!oldFile) return new Response('File not found', { status: 404 });

    // 保存新文件并删除旧文件
    await FILE_STORAGE.put(newName, oldFile);
    await FILE_STORAGE.delete(oldName);

    // 更新文件列表
    const files = JSON.parse(await FILE_STORAGE.get(FILE_LIST_KEY)) || [];
    const index = files.indexOf(oldName);
    if (index > -1) {
        files[index] = newName;
        await FILE_STORAGE.put(FILE_LIST_KEY, JSON.stringify(files));
    }

    return new Response('OK', {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        }
    });
}
