// @ts-check
import http from 'node:http';
import path from 'node:path';

const mimeTypes = new Map(
    Object.entries({
        '.css': 'text/css',
        '.html': 'text/html',
        '.jpg': 'image/jpeg',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
    }),
);

/**
 * We reuse a single listener for each of exit and SIGINT events to
 * avoid warnings about possible event listener leaks.
 * @type {Array<() => Promise<void>>}
 */
const terminationListeners = [];
const terminationListener = () => {
    terminationListeners.forEach((listener) => listener());
};

export function generateRandomId() {
    return Math.floor(Math.random() * 2 ** 55).toString();
}

/**
 * @param {number} port
 */
export async function createTestServer(port) {
    /** @type {import('http').Server} */
    let server;
    /** @type {{[path: string]: string | import('http').RequestListener}} */
    const paths = {};
    /** @type {Set<import('net').Socket>} */
    const sockets = new Set();

    /** @type {import('http').RequestListener} */
    function handleRequest(req, res) {
        const parsedURL = new URL(req.url, 'https://localhost');
        const pathName = parsedURL.pathname;

        if (!paths.hasOwnProperty(pathName)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        const contentOrListener = paths[pathName];

        if (typeof contentOrListener === 'function') {
            const listener = contentOrListener;
            return listener(req, res);
        }

        const content = contentOrListener;
        const ext = pathName === '/' ? '.html' : path.extname(pathName);
        const contentType = mimeTypes.get(ext) || 'text/plain';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(content, 'utf8');
    }

    /**
     * @param {number} [retries=20]
     * @returns {Promise<void>}
     */
    function start(retries = 20) {
        return new Promise((resolve, reject) => {
            const currentServer = http.createServer(handleRequest);

            currentServer.on('error', (err) => {
                if (/** @type {any} */ (err)?.code === 'EADDRINUSE' && retries > 0) {
                    try {
                        currentServer.close();
                    } catch {}
                    setTimeout(() => {
                        start(retries - 1).then(resolve, reject);
                    }, 250);
                } else {
                    reject(err);
                }
            });

            currentServer.on('connection', (socket) => {
                sockets.add(socket);
                socket.on('close', () => sockets.delete(socket));
            });

            currentServer.listen(port, () => {
                server = currentServer;
                resolve();
            });
        });
    }

    /**
     * @param {{[path: string]: string | import('http').RequestListener}} newPaths
     */
    function setPaths(newPaths) {
        Object.assign(paths, newPaths);
    }

    /**
     * @returns {Promise<void>}
     */
    function close() {
        if (!server) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const currentServer = server;
            server = null;
            const idx = terminationListeners.indexOf(close);
            if (idx !== -1) {
                terminationListeners.splice(idx, 1);
            }
            if (typeof currentServer.closeAllConnections === 'function') {
                try {
                    currentServer.closeAllConnections();
                } catch {}
            }
            sockets.forEach((socket) => {
                try {
                    socket.destroy();
                } catch {}
            });
            sockets.clear();
            currentServer.close((err) => {
                if (err) {
                    console.error(err);
                }
                resolve();
            });
        });
    }

    if (terminationListeners.length === 0) {
        process.on('exit', terminationListener);
        process.on('SIGINT', terminationListener);
    }
    terminationListeners.push(close);

    await start();

    return {
        setPaths,
        close,
        url: `http://localhost:${port}`,
    };
}
