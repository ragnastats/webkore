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

Commands::register(["remote", "To a land far far away", \&remote]);
Commands::register(["connect", "Connect to WebKore", \&connect]);
Plugins::register("WebKore", "OpenKore's Web Interface", \&unload);
my $hooks = Plugins::addHooks(['mainLoop_post', \&loop],
								['packet/public_chat', \&chatHandler],
								['packet/self_chat', \&chatHandler],
								['packet/emoticon', \&chatHandler],
								['packet/party_chat', \&chatHandler],
								['packet/guild_chat', \&chatHandler]);

sub unload
{
	Plugins::delHooks($hooks);
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
		print $remote to_json(character_export()) . "\n";
		$timeout = time() + 1;
	}
}

sub chatHandler
{
    my($packet, $args) = @_;
	#push(@queue, $args->{message});
	print(Dumper($args));
}

sub remote
{
    my($command, $message) = @_;
	#push(@queue, $message);
}

sub connect
{
	my $server = ($config{webkore_server}) ? $config{webkore_server} : '127.0.0.1';
	$remote = IO::Socket::INET->new(Proto => 'tcp', PeerAddr => $server, PeerPort => 1338, Reuse => 1);
}

1;