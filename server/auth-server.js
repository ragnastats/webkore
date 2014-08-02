/* Webkore Authentication Server! */

var express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app);

server.listen(1339);
console.log("Authentication server running on port 1339");

app.get('/', function(req, res)
{
    console.log("Page requested.");
    console.log(req.query);
    res.sendfile(__dirname + '/index.html');
});

