var express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server);

server.listen(1337);
console.log("Server running!");

// Create routes for static content and the index
app.use(express.static(__dirname + '/static'));

app.get('/', function (req, res)
{
    console.log("Page requested.");
    res.sendfile(__dirname + '/index.html');
});
