var ragnarok = require('../bootstrap/js/ragnarok-bootstrap.js'),
    express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server),
    crypto  = require('crypto'),
    cookie  = require('cookie'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    config  = require('./config'),
    buffer  = '',
    complete = false,
    authed  = {};

server.listen(1337);
console.log("Web server running on port 1337");

// Create routes for static content and the index
app.use(express.static(__dirname + '/static'));

// Generate some random bytes to use as our session secret
var random = crypto.randomBytes(256).toString('hex');
app.use(cookieParser());
app.use(session({secret: random}))


app.get('/', function(req, res)
{
    console.log("Page requested.");
    res.sendfile(__dirname + '/index.html');
});

app.get('/character', function(req, res)
{    
    res.end(JSON.stringify({
        character: ragnarok.character,
        storage: ragnarok.storage.items,
        inventory: ragnarok.inventory.items
    }));
});


// TODO: Include session ID in authentication token
// TODO: Add check to ensure tokens can only be used once
// TODO: USE HTTPS LOL
app.get('/auth', function(req, res)
{
    // Take the query and see if it matches our saved data
    var date = req.query.date,
        username = req.query.username;
    
    var password = config.users[username];

    // Hash it all together!
    var token = crypto.createHmac("sha256", config.secret).update(date + username + password).digest("hex");
        
    if(token == req.query.token)
    {
        console.log('Authentication token validated.');
        authed[req.sessionID] = true;
        req.session.authed = true;
    }
    
    res.end();
});


// WebSocket specific events
////////////////////////////////

// TODO: Figure out how to not use this old deprecated function
io.set('authorization', function (data, accept)
{
    // check if there's a cookie header
    if (data.headers.cookie)
    {
        var cookies = cookie.parse(data.headers.cookie);
        var decrypted = cookieParser.signedCookies(cookies, random);
        data.session_BUTTS = decrypted['connect.sid'];
    }
    else
    {
       return accept('No cookie transmitted.', false);
    }
    
    // accept the incoming connection
    accept(null, true);
});

io.sockets.on('connection', function (socket)
{
    var cookies = cookie.parse(socket.handshake.headers.cookie);
    var decrypted = cookieParser.signedCookies(cookies, random);
    var sessionID = decrypted['connect.sid'];

    socket.on('input', function(input)
    {
        if(authed[sessionID]) console.log("Authed: " + input.message);
        else                  console.log("Not Authed!");
    });
});



// Statistics server
//////////////////////

var net = require('net');

var HOST = '0.0.0.0';
var PORT = 1338;

// Create a server instance
net.createServer(function(socket)
{
    console.log('CONNECTED: ' + socket.remoteAddress +':'+ socket.remotePort);
    
    socket.on('data', function(data)
    {
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
            var buffer_array = buffer.split("\n");
            var length = buffer_array.length;
            
            for($i = 0; $i < length; $i++)
            {
                // Skip empty buffers
                if(buffer_array[$i] == '')
                    continue;
                
                try
                {
                    // Parse our buffer to see what's inside
                    var buffered = JSON.parse(buffer_array[$i]);
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
                        ragnarok.character = buffered.data.character;
                        ragnarok.storage.items = buffered.data.storage;
                        ragnarok.inventory.items = buffered.data.inventory;
                        io.sockets.emit('refresh');
                        break;
                        
                    case "move":
                        ragnarok.character.pos = buffered.data.to;
                        io.sockets.emit('move', buffered.data);
                        break;
                        
                    case "item":
                        if(buffered.data.action == 'add' || buffered.data.action == 'remove')
                        {
                            ragnarok.inventory[buffered.data.action](buffered.data.item_id, buffered.data.quantity);
                        }

                        io.sockets.emit('item', buffered.data);
                        break;
                        
                    case "map":
                        ragnarok.character.map = buffered.data.map;
                        ragnarok.character.pos = buffered.data.pos;
                        io.sockets.emit('map', buffered.data);
                        break;
                        
                    case "info":
                        // The server starts types at 1, but arrays are... well you know.
                        buffered.data.type--;
                    
                        // Only try to process recieved data if it has a handler function
                        if(typeof ragnarok.lookup.info_types[buffered.data.type] != "undefined" &&
                            typeof ragnarok.lookup.info_types[buffered.data.type].process == "function")
                        {
                            ragnarok.lookup.info_types[buffered.data.type].process(buffered.data.value);
                            io.sockets.emit('info', buffered.data);
                        }
                        break;
                        
                    case "storage":
                        io.sockets.emit('storage', buffered.data);
                        break;
                        
                    case "equip":
                        ragnarok.inventory.equip(buffered.data.item, buffered.data.equipped);
                        io.sockets.emit('equip', buffered.data);
                        break;
                        
                    default:
                        console.log('Unhandled event recieved: ' + buffered.event);
                        console.log(buffered);
                        console.log("\n");
                        break;
                }
                
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
