var http = require('http');
var fs = require('fs');
var dt = require('./module.js');
var yuri = require('url')


http.createServer(function (req, res) {
    var q = yuri.parse(req.url, true);
    var filename = "public" + q.pathname + ".html";
    console.log(filename);
    fs.readFile(filename, function(err, data) {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/html'});
            return res.end("404 Not Found");
          }  
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    //res.write("The date and time are currently: " + dt.dateTime() + "and you chose it to be" + q.year + " " + q.month);
    res.end();
    });    
}).listen(8080);
