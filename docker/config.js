let config = {
    backendUrl: null,
    wsUrl: null,
    globalUploadTaskLimit: 3,
    maxConcurrentChunks: 5,
    maxChunkRetries: 3,
    MD5ChunkSize: 1024 * 1024 * 2,
    prod: true,
    allowHost: ['localhost:5780', 'localhost:5173', 'localhost'],
}

config.backendUrl = config.prod === true ? 'http://localhost:8078' : 'http://localhost:8080';
config.wsUrl = config.prod === true ? 'ws://localhost:8078/ws' : 'ws://localhost:8080/ws';


export default config;