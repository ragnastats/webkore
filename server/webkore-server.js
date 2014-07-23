var express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server),
    current = {},
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
    res.end(JSON.stringify(current));
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
            try
            {
                // Parse our buffer to see what's inside
                var buffered = JSON.parse(buffer);
            }
            catch(error)
            {
                var buffered = {'event': 'error', 'message': error};
            }
            
            switch(buffered.event)
            {
                case "chat":
                    buffered.data.timestamp = new Date();
                
                    // Emit chat message
                    io.sockets.emit('chat', buffered.data);
                    break;
                    
                case "character":
                    // Save character data
                    current = buffered.data;
                    break;
                    
                case "move":
                    current.character.pos = buffered.data.to;
                    io.sockets.emit('move', buffered.data);
                    break;
                    
                default:
                    console.log('Unhandled event recieved: ' + buffered.event);
                    console.log(buffered);
                    console.log("\n");
                    break;
            }
            
            buffer = '';
        }
        
        console.log('From ' + socket.remoteAddress + ': ' + data);
    });
    
    socket.on('close', function(data) {
        console.log('Socket connection closed... ');
    });
    
    socket.on("error", function(error) {
        console.log("Socket had an error!")
        console.log(error)
    });
    
}).listen(PORT, HOST);

console.log("Statistics server running on " + PORT);
