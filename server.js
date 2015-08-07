var PORT = 3000;

var http = require('http');
var connect = require('./app');
var server = http.createServer(connect);

server.listen(PORT);
