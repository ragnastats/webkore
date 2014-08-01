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
    socket = io.connect(window.location.host);
    
    socket.on('refresh', function()
    {
        // Reload character data when refresh event is recieved
        ragnarok.ui.load('/character');
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
        ragnarok.data.chat.messsages.push(chat);
        
        if(ragnarok.data.chat.messages.length > 100) ragnarok.data.chat.messages.shift();
        ragnarok.ui.populate.chat();
    });
    
    socket.on('move', function(move)
    {
        ragnarok.character.pos = move.to;
        ragnarok.ui.populate.map();
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
        ragnarok.character.map = map.map;
        ragnarok.character.pos = map.pos;
        ragnarok.ui.populate.map();
    });
    
    socket.on('info', function(info)
    {
        // Ensure the server didn't send us something we can't handle
        if(typeof ragnarok.lookup.info_types[info.type] != "undefined" &&
            typeof ragnarok.lookup.info_types[info.type].process == "function")
        {
            ragnarok.lookup.info_types[info.type].process(info.value);
            ragnarok.ui.populate.character();
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

            // Start by clearing out the slot
            ragnarok.ui.unequip(slot);
            
            // Now equip our new item!
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
});
