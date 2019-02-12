var http = require("http");
var fs = require("fs");
var path = require("path");

var source_dir = path.join(__dirname, '../temp/');

var recs = fs.readdirSync(source_dir).filter(s => s.substr(-4) == '.rec').sort();
file = source_dir + recs[recs.length - 1];
console.log(file);

var server = http.createServer(function (request, response) {
        fs.readFile(file, function (error, content) {
                if (error) {
                        response.writeHead(500);
                        response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                        response.end();
                } else {
                        response.writeHead(200, {
                                'Content-Type': 'text/plain',
                                'Access-Control-Allow-Origin': "*"
                        });
                        response.end(content, 'utf-8');
                }
        });
});
server.listen(1337, function () {
        console.log("listening at ", new Date());
}); 