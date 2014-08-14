var ragnarok = require('../bootstrap/_shared/js/ragnarok-bootstrap.js'),
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
    authed  = {},
    connections = [];

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

app.get('/player', function(req, res)
{    
    res.end(JSON.stringify({
        player: ragnarok.player,
        storage: ragnarok.storage.items,
        inventory: ragnarok.inventory.items,
        characters: ragnarok.data.characters
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

io.sockets.on('connection', function(websocket)
{
    var cookies = cookie.parse(websocket.handshake.headers.cookie);
    var decrypted = cookieParser.signedCookies(cookies, random);
    var sessionID = decrypted['connect.sid'];

    websocket.on('input', function(input)
    {
        if(authed[sessionID])
        {
            console.log("Authed: " + input.message);
            
            for(var i = 0, l = connections.length; i < l; i++)
            {
                connections[i].write(input.message + "\n");
            }
        }
        else
        {
            console.log("Anonymous: " + input.message);
        }
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
    connections.push(socket);
    
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
                if(buffer_array[$i] == '') continue;
                
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
                        
                    case "player":
                        // Save player data
                        ragnarok.player = buffered.data.player;
                        ragnarok.storage.items = buffered.data.storage;
                        ragnarok.inventory.items = buffered.data.inventory;
                        io.sockets.emit('refresh');
                        break;
                        
                    case "move":
                        ragnarok.player.pos = buffered.data.to;
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
                        ragnarok.player.map = buffered.data.map;
                        ragnarok.player.pos = buffered.data.pos;
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
                        
                    case "message":
                        io.sockets.emit('message', buffered.data);
                        break;

                    case "character":
                        var character = buffered.data;

                        if(typeof ragnarok.data.characters == "undefined") ragnarok.data.characters = {};                        
                        if(character.action == "display")   ragnarok.data.characters[character.id] = character;
                        else                                delete(ragnarok.data.characters[character.id]);
                                            
                        io.sockets.emit('character', character);
                        break;

                    case "vendor":
                        var vendor = buffered.data;

                        if(typeof ragnarok.data.characters[vendor.id] != "undefined")
                        {
                            if(vendor.action == "display")  ragnarok.data.characters[vendor.id]['shop'] = vendor;
                            else                            delete(ragnarok.data.characters[vendor.id]['shop']);
                        }
                        
                        io.sockets.emit('vendor', vendor);
                        break;

                    case "chat_window":
                        var chat = buffered.data;

                        if(typeof ragnarok.data.characters[chat.id] != "undefined")
                        {
                            if(chat.action == "display")    ragnarok.data.characters[chat.id]['chat'] = chat;
                            else                            delete(ragnarok.data.characters[chat.id]['chat']);
                        }
                        
                        io.sockets.emit('chat_window', chat);
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
