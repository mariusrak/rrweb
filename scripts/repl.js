var fs = require("fs");
var path = require("path");
var puppeteer = require("puppeteer");

const events = [];
const url = process.argv[2].match(/\w+\:\/\//) ? process.argv[2] : 'http://' + process.argv[2];
const replLog = (event) => {
        events.push(event);
        writeStream.write(JSON.stringify(event) + "\n");
};
const bundlePath = path.resolve(__dirname, '../dist/rrweb.min.js');
const code = fs.readFileSync(bundlePath, 'utf8');
const injectCode = `;${code}
        window.__IS_RECORDING__ = true
        rrweb.record({
                emit: event => window._replLog(event)
        });
`;
const tempFolder = path.join(__dirname, '../temp');
const time = new Date().toISOString().replace(/[-|:]/g, '_').replace(/\..+/, '');
const storingFile = type => path.resolve(tempFolder, `${time}__${type}`);

if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder);
}
const writeStream = fs.createWriteStream(storingFile(`conti.rec`), { flags: 'a' });

process
        .on('uncaughtException', error => { console.error(error); })
        .on('unhandledRejection', error => { console.error(error); });

function saveEvents(events) {
        fs.writeFileSync(storingFile(`events.json`), JSON.stringify(events));

        const eventsString = JSON.stringify(events).replace(/<\/script>/g, '<\\/script>');
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
                const events = ${eventsString};
                /*-->*/
                const replayer = new rrweb.Replayer(events);
                replayer.play();
                </script>
                </body>
                </html>  
        `;
        fs.writeFileSync(storingFile('replay.html'), content);
}

(async () => {
        const browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: ['--start-maximized'],
        });

        const pages = await browser.pages();
        const page = pages[0];
        await page.goto(url);
        await page.exposeFunction('_replLog', replLog);
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
        });
})();