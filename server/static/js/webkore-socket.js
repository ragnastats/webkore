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
