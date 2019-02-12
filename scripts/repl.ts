import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { eventWithTime } from '../src/types';
var http = require("http");
var WebSocketServer = require("websocket").server;

var server = http.createServer(function (request, response) {
});
server.listen(1337, function () {
        console.log("listening at ", new Date());
});
const wsServer = new WebSocketServer({
        httpServer: server
        //autoAcceptConnections: true
});

wsServer.on("request", function (request) {
        var connection = request.accept(null, request.origin);
        console.log("request at ", new Date());

        connection.on("message", function (message) {
                if (message.type === "utf8") {
                        console.log(message.utf8Data);
                }
        });
});

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
