var socket;
var chat_colors = {
    self: 'lime',
    public: 'white',
    party_from: 'pink',
    party_to: 'orange',
    guild: 'lightgreen',
    private_from: 'yellow',
    private_to: 'yellow'
};

$(document).ready(function()
{
    socket = io.connect();
    
    socket.on('refresh', function(response)
    {
        // Reload player data when refresh event is recieved
        ragnarok.ui.load('/player');
        populate_map(response.characters);
    });
    
    socket.on('chat', function(chat)
    {
        chat.color = chat_colors[chat.type];
    
        if(chat.type == "private_from")     chat.user = "( From: " + chat.user + " )";
        else if(chat.type == "private_to")  chat.user = "( To: " + chat.user + " )";
    
        var date = new Date(chat.timestamp);
        var dateString = date.getUTCFullYear() +"/"+
                          ("0" + (date.getUTCMonth()+1)).slice(-2) +"/"+
                          ("0" + date.getUTCDate()).slice(-2) + " " +
                          ("0" + date.getUTCHours()).slice(-2) + ":" +
                          ("0" + date.getUTCMinutes()).slice(-2) + ":" +
                          ("0" + date.getUTCSeconds()).slice(-2);
                    
        chat.timestamp = date;
        ragnarok.data.chat.messages.push(chat);
        
        if(ragnarok.data.chat.messages.length > 100) ragnarok.data.chat.messages.shift();
        ragnarok.ui.populate.chat();
    });
    
    socket.on('move', function(move)
    {
        ragnarok.player.pos = move.to;
        ragnarok.ui.populate.map();

        ragnarok.map.move(move.to);
    });
    
    socket.on('item', function(item)
    {
        if(item.action == 'add')
        {
            ragnarok.inventory.add(item.item_id, item.quantity);
            ragnarok.ui.event.item_obtained(item.item_id, item.quantity);
        }
        else if(item.action == 'remove')
        {
            ragnarok.inventory.remove(item.item_id, item.quantity);
        }
        
        ragnarok.ui.clear.inventory('.inventory .ro-items');
        ragnarok.ui.populate.inventory('.inventory .ro-items', $('.ragnarok-tab-inventory.active, .ro-tab-inv.active').attr('tab'));
    });
    
    socket.on('map', function(map)
    {
        ragnarok.player.map = map.map;
        ragnarok.player.pos = map.pos;
        ragnarok.ui.populate.map();

        ragnarok.map.position(map.pos);
    });
    
    socket.on('info', function(info)
    {
        // Ensure the server didn't send us something we can't handle
        if(typeof ragnarok.lookup.info_types[info.type] != "undefined" &&
            typeof ragnarok.lookup.info_types[info.type].process == "function")
        {
            ragnarok.lookup.info_types[info.type].process(info.value);
            ragnarok.ui.populate.player();
        }
    });
    
    socket.on('storage', function(storage)
    {
        if(storage.status == "open")
        {
            ragnarok.window.open('storage');

            ragnarok.ui.clear.storage('.storage .ro-items');
            ragnarok.ui.populate.storage('.storage .ro-items', $('.ragnarok-tab-storage.active, .ro-tab-stor.active').attr('tab'));
        }
        else
        {
            ragnarok.window.close('storage');
        }
        
        if(storage.action == 'add')
        {
            ragnarok.storage.add(storage.item_id, storage.quantity);
        }
        else if(storage.action == 'remove')
        {
            ragnarok.storage.remove(storage.item_id, storage.quantity);
        }
        
        ragnarok.ui.clear.storage('.storage .ro-items');
        ragnarok.ui.populate.storage('.storage .ro-items', $('.ragnarok-tab-storage.active, .ro-tab-stor.active').attr('tab'));
    });
    
    socket.on('equip', function(equip)
    {
        if(equip.equipped)
        {
            var slot = ragnarok.lookup.equipment_slots[equip.type.equip],
                item_id = equip.item;
            
            ragnarok.ui.equip(item_id, slot);
        }
        else
        {
            var slot = ragnarok.lookup.equipment_slots[equip.type.equip];
            ragnarok.ui.unequip(slot);
        }

        ragnarok.inventory.equip(equip.item, equip.equipped);
        ragnarok.ui.clear.inventory('.inventory .ro-items');
        ragnarok.ui.populate.inventory('.inventory .ro-items', $('.ragnarok-tab-inventory.active, .ro-tab-inv.active').attr('tab'));
    });
    
    socket.on('message', function(message)
    {
        // Construct chat messages from message value
        var messages = message.value.split('\n');
        
        for(var i = 0, l = messages.length; i < l; i++)
        {
            var chat = {
                color: chat_colors.party_from,
                user: '|',
                message: messages[i].replace(/ /g, ' ')
            };

            ragnarok.data.chat.messages.push(chat);        
            if(ragnarok.data.chat.messages.length > 100) ragnarok.data.chat.messages.shift();
        }
        
        ragnarok.ui.populate.chat();
    });

    socket.on('character', function(character)
    {
        // Display a character
        if(character.action == "display")
        {
            // If the character doesn't exist 
            if($('#'+character.id).length == 0)
            {
                ragnarok.map.character.add(character.id, character.name, character.type, character.pos.from);
            }

            // If the character is moving
            if(character.pos.from.x != character.pos.to.x || character.pos.from.y != character.pos.to.y)
            {
                // TODO: Include character speed
                ragnarok.map.character.move(character.id, character.pos.to);
            }
        }
        else
        {
            ragnarok.map.character.remove(character.id);
        }
    });

    socket.on('vendor', function(vendor)
    {
        if(vendor.action == "display")
        {
            var title = ragnarok.template.clone('vendor-title', vendor);
            $('#'+vendor.id).append(title);
        }
        else if(vendor.action == "list")
        {
            vendor.name = $('#'+vendor.id).find('.name').text();

            for(var i = 0, l = vendor.items.length; i < l; i++)
            {
                var item_id = vendor.items[i].id;
                var item = ragnarok.items[item_id];
                
                vendor.items[i].name = item.name;
            }
            
            ragnarok.template.update('vendor-window', vendor);
            ragnarok.window.open('vendor-window');
            $('#vendor-window').css('height', 'auto');
            console.log(vendor);
        }
        else
        {
            console.log(vendor);
        }
    });

    socket.on('chat_window', function(chat)
    {
        if(chat.action == "display")
        {
            var title = ragnarok.template.clone('chat-title', chat);
            $('#'+chat.id).append(title);
        }
        else
        {
            
        }
    });

});
