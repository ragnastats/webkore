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
Commands::register(["wkdebug", "Debug stuff!", \&webkore_debug]);

Plugins::register("WebKore", "OpenKore's Web Interface", \&unload);
my $hooks = Plugins::addHooks(['mainLoop_post', \&loop],

								# Chats
								["packet_selfChat", \&chat_handler],
								["packet_pubMsg", \&chat_handler],
								["packet_partyMsg", \&chat_handler],
								["packet_guildMsg", \&chat_handler],
								["packet_privMsg", \&chat_handler],
								
								# Movement
								["packet/character_moves", \&movement_handler],
								
								# Items
								['packet/inventory_item_added', \&item_handler],
								['packet_pre/inventory_item_removed', \&item_handler],
								['packet_pre/item_used', \&item_handler],
								
								# Misc testing
								["packet/actor_display", \&default_handler]);

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
#	print(Dumper($args));

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
	
	# A lookup table for chat types
	my $chat_types = {
		'packet_selfChat' => 'self',
		'packet_pubMsg' => 'public',
		'packet_partyMsg' => 'party',
		'packet_guildMsg' => 'guild',
		'packet_privMsg' => 'private'
	};
	
	if($remote)
	{
		print $remote to_json({
			'event' => 'chat',
			'data' => {
				'user' => $chat->{MsgUser},
				'message' => $chat->{Msg},
				'type' => $chat_types->{$hook}
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