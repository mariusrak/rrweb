import * as fs from 'fs';
import * as path from 'path';
import * as EventEmitter from 'events';
import * as puppeteer from 'puppeteer';
import { eventWithTime } from '../src/types';

process
        .on('uncaughtException', error => {
                console.error(error);
        })
        .on('unhandledRejection', error => {
                console.error(error);
        });


function getCode(): string {
        const bundlePath = path.resolve(__dirname, '../dist/rrweb.min.js');
        return fs.readFileSync(bundlePath, 'utf8');
}

function saveEvents(events: eventWithTime[]) {
        const tempFolder = path.join(__dirname, '../temp');

        if (!fs.existsSync(tempFolder)) {
                fs.mkdirSync(tempFolder);
        }
        const time = new Date()
                .toISOString()
                .replace(/[-|:]/g, '_')
                .replace(/\..+/, '');

        const content = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="X-UA-Compatible" content="ie=edge" />
                <title>Record @${time}</title>
                <link rel="stylesheet" href="../dist/rrweb.min.css" />
                </head>
                <body>
                <script src="../dist/rrweb.min.js"></script>
                <script>
                /*<!--*/
                const events = ${JSON.stringify(events).replace(
                /<\/script>/g,
                '<\\/script>',
        )};
                /*-->*/
                const replayer = new rrweb.Replayer(events);
                replayer.play();
                </script>
                </body>
                </html>  
                `;

        fs.writeFileSync(path.resolve(tempFolder, `replay_${time}.html`), content);

        fs.writeFileSync(path.resolve(tempFolder, `events_${time}.json`), JSON.stringify(events));

        console.log(`Saved at ${tempFolder} -> ${time}`);
}

/*
var connection: WebSocket;
var toSend: eventWithTime[] = [];

function send(event: eventWithTime) {
        if (connection === undefined || connection.readyState > 1) {
                console.info('socket close', connection === undefined, connection && connection.readyState < 1);
                openRRsocket();
                toBuffer(event);
                return;
        }
        try {
                connection.send(JSON.stringify(event));
                console.log("Sent: ", event);
        } catch (err) {
                if (typeof connection === 'undefined' || connection.readyState !== 0) {
                        openRRsocket();
                }
                toBuffer(event);
                console.log('ErSn: ', err);
        }
}
function toBuffer(event: eventWithTime) {
        toSend.push(event);
        console.log("Buff: ", event);
}
function flush() {
        console.info('flushing');
        while (1) {
                var event = toSend.shift();
                if (!event) {
                        break;
                }
                send(event);
        }
}
function openRRsocket() {
        if (connection !== undefined && connection.readyState === 1) {
                console.info('socket opening');
                return;
        }
        var newConn = new WebSocket('ws://127.0.0.1:1337');
        newConn.onopen = function () {
                console.info('socket open');
                flush();
        };
        newConn.onerror = function (error: Object) {
                console.error('socket error', error);
        };
        connection = newConn;
};*/










/*
let events: eventWithTime[] = [];
var connection: WebSocket;
var sentEvent = -1;
function openRRsocket() {
        if (connection !== undefined && connection.readyState <= 1) {
                console.info('socket opening');
                return;
        }
        var newConn = new WebSocket('ws://127.0.0.1:1337');
        newConn.onopen = function () {
                console.info('socket open');
                flush();
        };
        newConn.onerror = function (error: Object) {
                console.error('socket error', error);
        };
        connection = newConn;
};
function flush() {
        if (connection === undefined || connection.readyState > 1) {
                console.info('socket close');
                openRRsocket();
                return;
        }
        if (sentEvent === events.length - 1) {
                return;
        }
        try {
                const event = events[sentEvent + 1];
                connection.send(JSON.stringify(event));
                console.log("Sent: %d/%d", sentEvent, events.length);//event);
                ++sentEvent;
                flush();
        } catch (err) {
                if (typeof connection === 'undefined' || connection.readyState !== 0) {
                        openRRsocket();
                } else if (connection) {
                        console.log("ErSn: %d/%d", sentEvent, events.length, connection, err);
                }
                return;
        }
}



*/

var writeStream = fs.createWriteStream(path.join(__dirname, '../rec'), {
        flags: 'a'
});
function write(event: eventWithTime) {
        writeStream.write(JSON.stringify(event) + "\n");
}


(async () => {
        let events: eventWithTime[] = [];
        const code = getCode();
        const url = process.argv[2].match(/\w+\:\/\//) ? process.argv[2] : 'http://' + process.argv[2];
        const injectCode = `;${code}
                window.__IS_RECORDING__ = true
                rrweb.record({
                        emit: event => window._replLog(event)
                });
        `;

        const browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: ['--start-maximized'],
        });

        const pages = await browser.pages();
        const page = pages[0];
        await page.goto(url/*, {
                waitUntil: 'domcontentloaded',
        }*/);
        await page.exposeFunction('_replLog', (event: eventWithTime) => {
                events.push(event);
                write(event);
        });
        await page.evaluate(injectCode);
        page.on('framenavigated', async () => {
                const isRecording = await page.evaluate('window.__IS_RECORDING__');
                if (!isRecording) {
                        await page.evaluate(injectCode);
                }
        });

        browser.once('disconnected', async () => {
                saveEvents(events);
                writeStream.close();
                //process.exit();
        });


})();
