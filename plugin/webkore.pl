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
								["packet_selfChat", \&parse_chat],
								["packet_pubMsg", \&parse_chat],
								["packet_partyMsg", \&parse_chat],
								["packet_guildMsg", \&parse_chat],
								["packet_privMsg", \&parse_chat]);

sub unload
{
	Plugins::delHooks($hooks);
}

sub webkore_connect
{
	my $server = ($config{webkore_server}) ? $config{webkore_server} : '127.0.0.1';
	$remote = IO::Socket::INET->new(Proto => 'tcp', PeerAddr => $server, PeerPort => 1338, Reuse => 1);
}

sub webkore_debug
{
    my($command, $message) = @_;

	if($remote)
	{
		print $remote $message . "\n";
	}
}

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

sub loop
{
	if(Network::DirectConnection::getState() == Network::IN_GAME and $remote and $timeout < time())
	{
		# Check connection status
		if($remote->connected())
		{
		
		}

		# Check for new messages
		#while(@queue)
		#{
		#	print $remote shift(@queue) . "\n";
		#}
		
		# End our data with a new line
		print $remote to_json({'event' => 'character', 'data' => character_export()}) . "\n";
		$timeout = time() + 1;
	}
}

sub parse_chat
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


1;