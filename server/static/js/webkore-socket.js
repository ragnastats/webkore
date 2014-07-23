var socket;
var chat_colors = {
    self: 'lime',
    public: 'white',
    party: 'pink',
    party_self: 'orange',
    guild: 'lightgreen',
    private: 'yellow'
};

$(document).ready(function()
{
    if(typeof ragnarok.data == "undefined")
        ragnarok.data = {};
    
    socket = io.connect(window.location.host);
    
    socket.on('chat', function(chat)
    {
        if(typeof ragnarok.data.chat == "undefined")
            ragnarok.data.chat = [];
    
        chat.color = chat_colors[chat.type];
    
        // Override color for self party chat
        if(chat.type == 'party' && chat.user == ragnarok.character.name)
            chat.color = chat_colors.party_self;
  
        var date = new Date(chat.timestamp);
        var dateString = date.getUTCFullYear() +"/"+
                          ("0" + (date.getUTCMonth()+1)).slice(-2) +"/"+
                          ("0" + date.getUTCDate()).slice(-2) + " " +
                          ("0" + date.getUTCHours()).slice(-2) + ":" +
                          ("0" + date.getUTCMinutes()).slice(-2) + ":" +
                          ("0" + date.getUTCSeconds()).slice(-2);
                    
        chat.timestamp = date;
    
        ragnarok.data.chat.push(chat);
        
        if(ragnarok.data.chat.length > 100)
            ragnarok.data.chat.shift();
        
        ragnarok.ui.populate.chat();
    });
    
    socket.on('move', function(move)
    {
        ragnarok.character.pos = move.to;
        ragnarok.ui.populate.map();
    });
});
