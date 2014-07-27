package WebKore;
 
# Perl includes
use strict;
use Data::Dumper;
use Time::HiRes;
use List::Util;
use IO::Socket;
use Storable;
use JSON;

# Kore includes
use Settings;
use Plugins;
use Network;
use Globals;
use Utils;


our @queue;
our $timeout;
our $remote;

Commands::register(["wkconnect", "Connect to WebKore", \&webkore_connect]);
Commands::register(["wkc", "Connect to WebKore", \&webkore_connect]);
Commands::register(["wkdisconnect", "Disconnect from WebKore", \&webkore_disconnect]);
Commands::register(["wkdc", "Disconnect from WebKore", \&webkore_disconnect]);
Commands::register(["wkdebug", "Debug stuff!", \&webkore_debug]);
Commands::register(["wkdbg", "Debug stuff!", \&webkore_debug]);

Plugins::register("WebKore", "OpenKore's Web Interface", \&unload);
my $hooks = Plugins::addHooks(['mainLoop_post', \&loop],

                                # Chats
                                ["packet_selfChat", \&chat_handler],
                                ["packet_pubMsg", \&chat_handler],
                                ["packet_partyMsg", \&chat_handler],
                                ["packet_guildMsg", \&chat_handler],
                                ["packet_privMsg", \&chat_handler],
                                ["packet_pre/private_message_sent", \&chat_handler],
                                
                                # Movement
                                ["packet/character_moves", \&movement_handler],
                                
                                # Items
                                ['packet/inventory_item_added', \&item_handler],
                                ['packet_pre/inventory_item_removed', \&item_handler],
                                ['packet_pre/item_used', \&item_handler],
                                
                                # Map packets
                                ['packet/map_loaded', \&map_handler],
                                ['packet/map_change', \&map_handler],
                                ['packet/map_changed', \&map_handler],
                                
                                # Character info
                                ['packet/stat_info', \&info_handler],
                                
                                # Guild packets
                                ['packet/guild_name', \&default_handler],
                                ['packet/guild_member_online_status', \&default_handler],
                                ['packet/guild_notice', \&default_handler],
                                ['packet/guild_member_add', \&default_handler],
                                ['packet/guild_info', \&default_handler],
                                ['packet/guild_member_map_change', \&default_handler],
                                
                                # Deal packets
                                ['packet/deal_request', \&default_handler],
                                ['packet/deal_begin', \&default_handler],
                                ['packet/deal_add_other', \&default_handler],
                                ['packet/deal_add_you', \&default_handler],
                                ['packet/deal_finalize', \&default_handler],
                                ['packet/deal_cancelled', \&default_handler],
                                ['packet/deal_complete', \&default_handler],
                                
                                # NPC packets
                                ['packet/npc_talk', \&default_handler],
                                ['packet/npc_talk_continue', \&default_handler],
                                ['packet/npc_talk_close', \&default_handler],
                                ['packet/npc_talk_responses', \&default_handler],
                                ['packet/npc_store_begin', \&default_handler],
                                ['packet/npc_store_info', \&default_handler],
                                ['packet/npc_sell_list', \&default_handler],
                                ['packet/npc_image', \&default_handler],
                                ['packet/npc_talk_number', \&default_handler],
                                
                                # Storage packets
                                ['packet/storage_opened', \&default_handler],
                                ['packet/storage_item_added', \&default_handler],
                                ['packet/storage_item_removed', \&default_handler],
                                );

sub unload
{
    Plugins::delHooks($hooks);
}

#
# WebKore Functions
#######################

sub webkore_connect
{
    my $server = ($config{webkore_server}) ? $config{webkore_server} : '127.0.0.1';
    $remote = IO::Socket::INET->new(Proto => 'tcp', PeerAddr => $server, PeerPort => 1338, Reuse => 1);

    # Send character export after connecting to the statistics server
    print $remote to_json({'event' => 'character', 'data' => character_export()}) . "\n";
}

sub webkore_disconnect
{
    shutdown($remote, 2) if $remote;
    close($remote) if $remote;
}

sub webkore_debug
{
    my($command, $message) = @_;

    if($remote)
    {
        print $remote $message . "\n";
    }
}

# 
# Hook Handlers
#######################

sub loop
{
    if(Network::DirectConnection::getState() == Network::IN_GAME and $remote and $timeout < time())
    {
        # Check connection status
        if($remote->connected())
        {
        
        }
        
        $timeout = time() + 1;
    }
}

sub default_handler
{
    my($hook, $args) = @_;
    print("Hook: $hook\n");
}

sub verbose_handler
{
    my($hook, $args) = @_;
    print("Hook: $hook\n");
#   print(Dumper($args));

    foreach my $key (@{$args->{KEYS}})
    {
        print("$key : \n");
        print(Dumper($args->{$key}));
        print("============================\n");
    }
}

sub chat_handler
{
    my($hook, $args) = @_;
    my $chat = Storable::dclone($args);
    
    # selfChat returns slightly different arguments, let's fix that
    if($hook eq 'packet_selfChat')
    {
        $chat->{Msg} = $chat->{msg};
        $chat->{MsgUser} = $chat->{user};
    }
    # We have to handle the various error messages PMs can return
    elsif($hook eq 'packet_pre/private_message_sent')
    {
        if($args->{type} == 0)
        {
            $chat->{Msg} = $lastpm[0]{msg};
            $chat->{MsgUser} = $lastpm[0]{user};
        }
        else
        {
            my $message;
            
            if ($args->{type} == 1) {
                $message = $lastpm[0]{user} . " is not online"; } 
            elsif ($args->{type} == 2) {
                $message = $lastpm[0]{user} . " ignored your message"; }
            else {
                $message = $lastpm[0]{user} . " doesn't want to receive messages"; }

            print $remote to_json({
                'event' => 'message',
                'data' => {
                    'message' => $message,
                    'type' => 'warning'
                }
            }) . "\n";

            return;
        }
    }
    
    # A lookup table for chat types
    my $chat_types = {
        'packet_selfChat' => 'self',
        'packet_pubMsg' => 'public',
        'packet_partyMsg' => 'party',
        'packet_guildMsg' => 'guild',
        'packet_privMsg' => 'private_from',
        'packet_pre/private_message_sent' => 'private_to'
    };
    
    # Ensure chat type is supported
    if($remote and $chat_types->{$hook})
    {
        my $type = $chat_types->{$hook};
        
        if($type eq "party" and $chat->{MsgUser} eq $char->{name}) {
            $type = "party_to"; }
        else {
            $type = "party_from"; }
        
        print $remote to_json({
            'event' => 'chat',
            'data' => {
                'user' => $chat->{MsgUser},
                'message' => $chat->{Msg},
                'type' => $type
            }
        }) . "\n";
    }
    
    print("$hook\n");
    print(Dumper($chat));
}

sub movement_handler
{
    my($hook, $args) = @_;
    
    if($remote)
    {
        print $remote to_json({
            'event' => 'move',
            'data' => {
                'from' => $char->{pos},
                'to' => $char->{pos_to},
                'speed' => $char->{walk_speed}
            }
        }) . "\n";
    }
}

sub item_handler
{
    my($hook, $args) = @_;
    
    if($remote)
    {
        my $item = $char->inventory->getByServerIndex($args->{index});
    
        my $actions = {
            'packet/inventory_item_added' => 'add',
            'packet_pre/inventory_item_removed' => 'remove',
            'packet_pre/item_used' => 'remove'
        };
    
        # If an item was used, we need to calculate the quantity used based on the amount remaining
        if($hook eq 'packet_pre/item_used')
        {
            $args->{amount} = $item->{amount} - $args->{remaining};
        }
    
        print $remote to_json({
            'event' => 'item',
            'data' => {
                'action' => $actions->{$hook},
                'item_id' => $item->{nameID},
                'quantity' => $args->{amount}
            }
        }) . "\n";
    }
}

sub map_handler
{
    my($hook, $args) = @_;
    my $pos = calcPosition($char);
    
    if($remote)
    {
        # TODO: Include map IP for added fun :)
        print $remote to_json({
            'event' => 'map',
            'data' => {
                'map' => {
                    'name' => $field->{baseName}, 
                    'width' => $field->{width}, 
                    'height' => $field->{height}
                },
                
                'pos' => $pos
            }
        }) . "\n";
    }
}

sub info_handler
{
    my($hook, $args) = @_;
    
    if($remote)
    {
        print $remote to_json({
            'event' => 'info',
            'data' => {
                'type' => $args->{type},
                'value' => $args->{val}
            }
        }) . "\n";
    }
}

#
# Helper Functions
#######################

sub character_export
{
    my $export = {"inventory" => [], "storage" => []};
    
    # Inventory
    ########################
    
    foreach my $item (@{$char->inventory->getItems()})
    {
        push(@{$export->{inventory}}, {item => $item->{nameID}, quantity => $item->{amount}});	
    }

    # Storage
    ########################
    
    for(my $i = 0; $i < @storageID; $i++)
    {
        next if ($storageID[$i] eq "");
        my $item = $storage{$storageID[$i]};
    
        push(@{$export->{storage}}, {item => $item->{nameID}, quantity => $item->{amount}});	
    }

    # Character information
    ########################
    
    my $pos = calcPosition($char);
    
    $export->{character} = {
        name => $char->{'name'},
        class => $jobs_lut{$char->{'jobID'}},
        hp => {current => $char->{'hp'}, total => $char->{'hp_max'}},
        sp => {current => $char->{'sp'}, total => $char->{'sp_max'}},
        level => {base => $char->{'lv'}, job => $char->{'lv_job'}},
        exp => {base => {current => $char->{'exp'}, total => $char->{'exp_max'}},
                job => {current => $char->{'exp_job'}, total => $char->{'exp_job_max'}}},
        weight => {current => $char->{'weight'}, total => $char->{'weight_max'}},
        zeny => $char->{'zeny'},
        map => {name => $field->{baseName}, width => $field->{width}, height => $field->{height}},
        pos => $pos,
        look => $char->{look}->{body}
    };
    
    return $export;
}

1;
