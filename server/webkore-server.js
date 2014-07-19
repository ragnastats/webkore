var express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server),
    character = '',
    buffer = '',
    complete = false;

server.listen(1337);
console.log("Web server running on port 1337");

// Create routes for static content and the index
app.use(express.static(__dirname + '/static'));

app.get('/', function(req, res)
{
    console.log("Page requested.");
    res.sendfile(__dirname + '/index.html');
});


app.get('/character', function(req, res)
{
    res.end(character);
});

var net = require('net');

var HOST = '0.0.0.0';
var PORT = 1338;

// Create a server instance
net.createServer(function(socket) {
    console.log('CONNECTED: ' + socket.remoteAddress +':'+ socket.remotePort);
    
    socket.on('data', function(data) {
        var chunk = data.toString();

        // We use newlines to deliminate the end of our data
        if(chunk.indexOf("\n") == -1)
            complete = false;
        else
            complete = true;
        
        // Always add the current chunk to our buffer
        buffer += chunk;
        
        if(complete)
        {
            // Set our character data to the current buffer and clear it out!
            character = buffer;
            buffer = '';
        }
        
        console.log('From ' + socket.remoteAddress + ': ' + data);
        socket.write(data);
    });
    
    socket.on('close', function(data) {
        console.log('Socket connection closed... ');
    });
}).listen(PORT, HOST);

console.log("Statistics server running on " + PORT);
