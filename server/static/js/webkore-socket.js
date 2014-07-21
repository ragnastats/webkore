var socket;

$(document).ready(function()
{
    if(typeof ragnarok.data == "undefined")
        ragnarok.data = {};
    
    socket = io.connect(window.location.host);
    
    socket.on('chat', function(chat)
    {
        if(typeof ragnarok.data.chat == "undefined")
            ragnarok.data.chat = [];
            
        ragnarok.data.chat.push(chat);
        
        if(ragnarok.data.chat.length > 100)
            ragnarok.data.chat.shift();
        
        ragnarok.ui.populate.chat();
    });
});
