var fs = require("fs");
var path = require("path");
var puppeteer = require("puppeteer");
var net = require('net');

const events = [];
const url = process.argv[2].match(/\w+\:\/\//) ? process.argv[2] : 'http://' + process.argv[2];
const bundlePath = path.resolve(__dirname, '../dist/rrweb.min.js');
const code = fs.readFileSync(bundlePath, 'utf8');
const injectCode = `;${code}
        window.__RR__windowProps = ['screenX', 'screenY', 'outerHeight', 'outerWidth', 'innerHeight', 'innerWidth'];
        window.__IS_RECORDING__ = true
        rrweb.record({
                emit: event => window._replLog({...event, _windowProps: window.__RR__windowProps.reduce((w, p) => ({ ...w, [p]: window[p] }), {})})
        });
`;
const recordingsFolder = path.join(__dirname, '../recordings');
const time = new Date().toISOString().replace(/[-|:]/g, '_').replace(/\..+/, '');
const normalizedUrl = url.replace(/^\w+\:\/\/([^\/]+).*/, '$1');
const storingFile = type => path.resolve(recordingsFolder, `${time}__${normalizedUrl}__${type}`);

if (!fs.existsSync(recordingsFolder)) {
        fs.mkdirSync(recordingsFolder);
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
        if(process.argv[4]){
                var customcode = fs.readFileSync(path.resolve(__dirname, '../'+process.argv[4]+'.js'), 'utf8');
                page.evaluate(customcode);
                page.on('framenavigated', async () => {
                        page.evaluate(customcode);
                });
        }
        if(process.argv[5]){
                var customcss = fs.readFileSync(path.resolve(__dirname, '../'+process.argv[5]+'.css'), 'utf8');
                page.addStyleTag({content: customcss});
                page.on('response', async () => {
                        page.addStyleTag({content: customcss});
                });
                page.on('load', async () => {
                        page.addStyleTag({content: customcss});
                });
        }
        await page.goto(url);
        if(process.argv[3] && parseInt(process.argv[3],10)){
                setTimeout(() => browser.close(), parseInt(process.argv[3], 10)*1000);
        }
        await page.exposeFunction('_replLog', event => {
                events.push(event);
                writeStream.write(JSON.stringify(event) + "\n");
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
                
                var client = new net.Socket();
                client.connect(8087, '127.0.0.1', function() {
                        client.write("R;1;0000123;SLIDESHOWNEXT\r\n");
                        client.end();
                });
        });
})();